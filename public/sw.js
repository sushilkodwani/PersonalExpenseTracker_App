// Service worker: app-shell caching, update handling and push notifications.
//
// Caching strategy
// - Page loads (navigations, i.e. index.html): NETWORK FIRST. A new deploy is
//   picked up on the next launch; the cached copy is used only when offline or
//   when the network is too slow to answer in time.
// - Built assets under /assets/ have content hashes in their file names, so a
//   given URL never changes: CACHE FIRST is safe and fast.
// - Everything else same-origin (icons, manifest): stale-while-revalidate.
// - Cross-origin requests (api.github.com) are never touched.
//
// Bump VERSION to force every installed copy to drop its old caches.
const VERSION = 'v2'
const SHELL_CACHE = `et-shell-${VERSION}`
const ASSET_CACHE = `et-assets-${VERSION}`
const NAV_TIMEOUT_MS = 4000

self.addEventListener('install', () => {
  // Take over as soon as installed. Safe here because page loads are network
  // first: the next launch always gets the HTML that matches the new assets.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSET_CACHE])
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

function isAsset(url) {
  return url.pathname.includes('/assets/')
}

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL_CACHE)
  const network = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone())
    return res
  })
  network.catch(() => {}) // avoid an unhandled rejection when the timeout wins
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NAV_TIMEOUT_MS))
  try {
    const res = await Promise.race([network, timeout])
    if (res) return res
  } catch {
    // offline — fall through to the cache
  }
  const cached = (await cache.match(request, { ignoreSearch: true })) || (await cache.match('./', { ignoreSearch: true }))
  // Nothing cached yet: wait for the network after all.
  return cached || network
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(ASSET_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const res = await fetch(request)
  if (res.ok) cache.put(request, res.clone())
  return res
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone())
      return res
    })
    .catch(() => cached)
  return cached || network
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // The worker script itself must always come from the network.
  if (url.pathname.endsWith('/sw.js')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request))
  } else if (isAsset(url)) {
    event.respondWith(cacheFirstAsset(request))
  } else {
    event.respondWith(staleWhileRevalidate(request))
  }
})

// ---------- push notifications ----------
// Payload sent by the notifier (see notifier/ in this repo):
// { title, body, tag?, monthId?, view? }

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Expense Tracker'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: './icon.svg',
      // Same tag replaces an older notification instead of stacking.
      tag: data.tag || undefined,
      data: { monthId: data.monthId || null, view: data.view || null },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const { monthId, view } = event.notification.data || {}
  const params = new URLSearchParams()
  if (monthId) params.set('month', monthId)
  if (view) params.set('view', view)
  const query = params.toString()
  const target = new URL(`./${query ? `?${query}` : ''}`, self.registration.scope).href

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows.find((w) => w.url.startsWith(self.registration.scope))
      if (existing) {
        existing.postMessage({ type: 'open', monthId, view })
        return existing.focus()
      }
      return self.clients.openWindow(target)
    })(),
  )
})

// If the browser rotates the subscription, the app re-saves it on next launch
// (see ensureSubscriptionSaved in src/lib/push.ts).
