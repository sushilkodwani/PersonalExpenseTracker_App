import { useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ADMIN_EMAIL } from '../lib/auth'
import { useApp } from '../store/AppContext'
import type { UserAccessEntry, UserAccessRole } from '../types'

export function AccessControlScreen() {
  const { settings, updateSettings, isAdmin } = useApp()
  const [adding, setAdding] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<string | null>(null)

  if (!settings) return null
  if (!isAdmin) {
    return <p className="p-6 text-center text-sm muted">Only the admin can manage access.</p>
  }
  const users = settings.userAccess ?? []

  function addUser(email: string, role: UserAccessRole) {
    if (!settings) return
    const normalized = email.trim().toLowerCase()
    if (!normalized || normalized === ADMIN_EMAIL) return
    const withoutExisting = (settings.userAccess ?? []).filter((u) => u.email.toLowerCase() !== normalized)
    updateSettings({ ...settings, userAccess: [...withoutExisting, { email: normalized, role }] })
    setAdding(false)
  }

  function changeRole(email: string, role: UserAccessRole) {
    if (!settings) return
    updateSettings({
      ...settings,
      userAccess: (settings.userAccess ?? []).map((u) => (u.email === email ? { ...u, role } : u)),
    })
  }

  function removeUser(email: string) {
    if (!settings) return
    updateSettings({ ...settings, userAccess: (settings.userAccess ?? []).filter((u) => u.email !== email) })
    setPendingRemove(null)
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <p className="text-sm muted">
        Only these emails can open this data. Each person enters their email when connecting — view-only accounts see
        everything but can't add, edit, or delete anything.
      </p>

      <div className="card divide-y divider">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="font-medium">{ADMIN_EMAIL}</div>
            <div className="text-xs muted">Admin · full access</div>
          </div>
        </div>
        {users.length === 0 ? (
          <p className="p-4 text-sm muted">No other accounts added yet.</p>
        ) : (
          users.map((u) => (
            <div key={u.email} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{u.email}</div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <select
                  className="input py-1.5 text-sm"
                  value={u.role}
                  onChange={(e) => changeRole(u.email, e.target.value as UserAccessRole)}
                >
                  <option value="view">View only</option>
                  <option value="edit">Can edit</option>
                </select>
                <button className="text-sm text-red-500" onClick={() => setPendingRemove(u.email)}>
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <button className="btn-secondary" onClick={() => setAdding(true)}>
        + Add person
      </button>

      {adding && <AddUserDialog existing={users} onSave={addUser} onClose={() => setAdding(false)} />}

      {pendingRemove && (
        <ConfirmDialog
          title={`Remove ${pendingRemove}?`}
          message="They won't be able to open this data anymore until added back."
          confirmLabel="Remove"
          danger
          onConfirm={() => removeUser(pendingRemove)}
          onCancel={() => setPendingRemove(null)}
        />
      )}
    </div>
  )
}

function AddUserDialog({
  existing,
  onSave,
  onClose,
}: {
  existing: UserAccessEntry[]
  onSave: (email: string, role: UserAccessRole) => void
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserAccessRole>('view')

  const normalized = email.trim().toLowerCase()
  const isDuplicate = normalized === ADMIN_EMAIL || existing.some((u) => u.email.toLowerCase() === normalized)
  const valid = normalized.includes('@') && !isDuplicate

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={onClose}>
      <div className="w-full rounded-t-2xl bg-white p-4 pb-6 dark:bg-slate-900 sm:max-w-sm sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-lg font-semibold">Add person</h3>
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">
            Email
            <input
              className="input mt-1"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="them@example.com"
              autoCapitalize="none"
              autoFocus
            />
          </label>
          {isDuplicate && normalized && <p className="text-sm text-red-600">This email already has access.</p>}
          <label className="text-sm font-medium">
            Access
            <select className="input mt-1" value={role} onChange={(e) => setRole(e.target.value as UserAccessRole)}>
              <option value="view">View only</option>
              <option value="edit">Can edit</option>
            </select>
          </label>
          <div className="mt-1 flex gap-2">
            <button className="btn-primary flex-1" disabled={!valid} onClick={() => onSave(normalized, role)}>
              Add
            </button>
            <button className="btn-secondary flex-1" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
