import { useEffect, useState } from 'react'
import { disablePush, enablePush, isPushEnabled, pushSupport } from '../lib/push'
import { loadStoreConfig } from '../lib/store'
import { useApp } from '../store/AppContext'

/** Settings card for turning change notifications on or off on this device. */
export function NotificationsCard() {
  const { storeKind, currentUserEmail } = useApp()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const support = pushSupport()

  useEffect(() => {
    isPushEnabled()
      .then(setEnabled)
      .catch(() => setEnabled(false))
  }, [])

  const cfg = loadStoreConfig()
  const github = storeKind === 'github' && cfg?.kind === 'github' ? cfg : null

  async function toggle() {
    if (!github) return
    setBusy(true)
    setError(null)
    try {
      if (enabled) {
        await disablePush(github)
        setEnabled(false)
      } else {
        await enablePush(github, currentUserEmail ?? '')
        setEnabled(true)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  let note: string | null = null
  if (!github) note = 'Notifications need GitHub sync — the notifier runs in your data repo.'
  else if (!currentUserEmail) note = 'Reconnect with your email first, so you aren’t notified about your own changes.'
  else if (support === 'needs-install')
    note = 'On iPhone, notifications only work from the Home Screen app. Open it from there (Share → Add to Home Screen first).'
  else if (support === 'not-configured') note = 'Notifications aren’t set up for this app yet (no VAPID public key in the build).'
  else if (support === 'dev') note = 'Notifications only work in the deployed app, not the dev server.'
  else if (support === 'unsupported') note = 'This browser doesn’t support push notifications.'

  const canToggle = !note && enabled !== null

  return (
    <div className="card p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">Change notifications</div>
          <div className="text-xs muted">
            {enabled ? 'On for this device' : 'Get notified when someone else adds or changes expenses.'}
          </div>
        </div>
        {canToggle && (
          <button
            className={enabled ? 'btn-secondary shrink-0 py-1.5 text-sm' : 'btn-primary shrink-0 py-1.5 text-sm'}
            disabled={busy}
            onClick={toggle}
          >
            {busy ? '…' : enabled ? 'Turn off' : 'Turn on'}
          </button>
        )}
      </div>
      {note && <p className="mt-2 text-xs muted">{note}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
