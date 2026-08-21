// Cache-first service worker for the app shell. Data lives in GitHub/localStorage,
// so only static assets are cached here.
const CACHE = 'et-shell-v1'

self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  // Never intercept API calls — only same-origin static assets.
  if (url.origin !== location.origin || e.request.method !== 'GET') return
  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ||
        fetch(e.request).then((res) => {
          const copy = res.clone()
          if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, copy))
          return res
        }),
    ),
  )
})
