import { useEffect, useRef, useState } from 'react'
import { APP_VERSION, fetchDeployedVersion, reloadToLatest } from '../lib/version'
import { useApp } from '../store/AppContext'

/** Don't re-check more often than this when the app is reopened repeatedly. */
const MIN_CHECK_GAP_MS = 30_000
/** While the app stays open on screen, look again this often. */
const CHECK_INTERVAL_MS = 30 * 60_000

/**
 * Compares the version this page is running with the deployed one (a ~60 byte
 * version.json) on launch, on return to the foreground and when the connection
 * comes back. On a mismatch it blocks the app until the user updates — after
 * any unsaved edits have been saved.
 */
export function UpdatePrompt() {
  const { flushSaves } = useApp()
  const [latest, setLatest] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastCheck = useRef(0)

  useEffect(() => {
    if (!import.meta.env.PROD) return

    async function check() {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastCheck.current < MIN_CHECK_GAP_MS) return
      lastCheck.current = now
      const deployed = await fetchDeployedVersion()
      if (deployed && deployed !== APP_VERSION) setLatest(deployed)
    }

    void check()
    document.addEventListener('visibilitychange', check)
    window.addEventListener('online', check)
    const timer = setInterval(check, CHECK_INTERVAL_MS)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('online', check)
      clearInterval(timer)
    }
  }, [])

  if (!latest) return null

  async function update() {
    setBusy(true)
    setError(null)
    // Never reload over an edit that hasn't reached storage yet.
    const saved = await flushSaves()
    if (!saved) {
      setError('Your latest change couldn’t be saved yet. Check your connection, then tap Update again.')
      setBusy(false)
      return
    }
    await reloadToLatest()
  }

  return (
    // Above every other sheet (z-50) but below the conflict dialog (z-60), so a
    // save conflict raised while flushing can still be resolved.
    <div className="no-print fixed inset-0 z-[58] flex items-center justify-center bg-black/60 p-6" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl dark:bg-slate-900">
        <div className="text-4xl">✨</div>
        <h2 className="mt-3 text-lg font-semibold">New version available</h2>
        <p className="mt-2 text-sm muted">
          A new version of Expense Tracker is ready. Update to get the latest features and fixes.
        </p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button className="btn-primary mt-5 w-full py-3" disabled={busy} onClick={update}>
          {busy ? 'Updating…' : 'Update now'}
        </button>
        <p className="mt-3 text-xs muted">
          {APP_VERSION} → {latest}
        </p>
      </div>
    </div>
  )
}
