/** Build id of the code running in this page (stamped by vite.config.ts). */
export const APP_VERSION = __APP_VERSION__
export const APP_BUILT_AT = __APP_BUILT_AT__

/**
 * The build id currently deployed. One tiny request; the query string and
 * no-store skip the browser cache and the CDN cache, and the service worker
 * never caches this file. Null when offline or unreadable — treated as "no news".
 */
export async function fetchDeployedVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const body = (await res.json()) as { version?: unknown }
    return typeof body.version === 'string' ? body.version : null
  } catch {
    return null
  }
}

/** Fetch the newest service worker, drop every cache, and reload from the network. */
export async function reloadToLatest(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    await reg?.update()
  } catch {
    // offline or no worker — the reload below still gets the network copy if it can
  }
  try {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
  } catch {
    // caches unavailable
  }
  window.location.reload()
}
