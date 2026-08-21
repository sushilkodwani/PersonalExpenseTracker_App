import { useState } from 'react'

/**
 * Changing the month-unlock password requires knowing the current one — the
 * password is stored in the data file, so this is the check that keeps a
 * finalized month from being trivially reopened.
 */
export function ChangePasswordDialog({
  currentPassword,
  onSave,
  onCancel,
}: {
  currentPassword: string
  onSave: (next: string) => void
  onCancel: () => void
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit() {
    if (current !== currentPassword) {
      setError('Current password is incorrect.')
      return
    }
    if (next.trim().length < 4) {
      setError('New password must be at least 4 characters.')
      return
    }
    if (next !== confirm) {
      setError('New passwords don’t match.')
      return
    }
    onSave(next.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={onCancel}>
      <div
        className="w-full rounded-t-2xl bg-white p-4 pb-6 dark:bg-slate-900 sm:max-w-sm sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-lg font-semibold">Change month-lock password</h3>
        <p className="mb-3 text-sm muted">This is the password asked for when unlocking a locked month.</p>
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">
            Current password
            <input
              className="input mt-1"
              type="password"
              value={current}
              autoFocus
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          <label className="text-sm font-medium">
            New password
            <input className="input mt-1" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
          </label>
          <label className="text-sm font-medium">
            Confirm new password
            <input
              className="input mt-1"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="mt-1 flex gap-2">
            <button className="btn-primary flex-1" disabled={!current || !next || !confirm} onClick={submit}>
              Save
            </button>
            <button className="btn-secondary flex-1" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
