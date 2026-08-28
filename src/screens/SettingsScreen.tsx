import { useRef, useState } from 'react'
import { ChangePasswordDialog } from '../components/ChangePasswordDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PromptDialog } from '../components/PromptDialog'
import { downloadFile, fullBackupJson, monthsToCsv, parseBackupJson } from '../lib/export'
import { clearSessionUnlock } from '../lib/session'
import { useApp } from '../store/AppContext'
import { useTheme, type ThemePref } from '../store/ThemeContext'

export type SettingsSubScreen = 'sections' | 'categories' | 'recurring' | 'budgets' | 'import' | 'history'

export function SettingsScreen({ onNavigate }: { onNavigate: (screen: SettingsSubScreen) => void }) {
  const { settings, updateSettings, storeKind, disconnect, monthIds, months, loadAllMonths, importBackup } = useApp()
  const { pref, setPref } = useTheme()
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [settingPin, setSettingPin] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [pendingRestore, setPendingRestore] = useState<ReturnType<typeof parseBackupJson> | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!settings) return null

  const recurringActive = (settings.recurring ?? []).filter((r) => r.active).length
  const budgetCount = Object.keys(settings.budgets ?? {}).length

  function saveMonthLockPassword(next: string) {
    if (!settings) return
    updateSettings({ ...settings, monthLockPassword: next })
    setChangingPassword(false)
  }

  function savePin(value: string) {
    if (!settings) return
    const digits = value.trim()
    if (digits && !/^\d{4,8}$/.test(digits)) return
    updateSettings({ ...settings, appPin: digits || undefined })
    clearSessionUnlock()
    setSettingPin(false)
  }

  async function exportCsv() {
    await loadAllMonths()
    if (!settings) return
    downloadFile(`expenses-${new Date().toISOString().slice(0, 10)}.csv`, monthsToCsv(monthIds, months, settings), 'text/csv')
  }

  async function exportBackup() {
    await loadAllMonths()
    if (!settings) return
    downloadFile(
      `expense-backup-${new Date().toISOString().slice(0, 10)}.json`,
      fullBackupJson(settings, months),
      'application/json',
    )
  }

  function onPickBackup(file: File) {
    setImportError(null)
    file
      .text()
      .then((text) => setPendingRestore(parseBackupJson(text)))
      .catch((e) => setImportError((e as Error).message))
  }

  function hardRefresh() {
    // Clear service worker cache and reload
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name))
      })
    }
    // Force reload from server
    window.location.reload()
  }

  return (
    <div className="flex flex-col gap-6 p-4 pb-24">
      {/* General */}
      <section>
        <h2 className="mb-2 text-lg font-semibold">General</h2>
        <div className="card p-4">
          <button className="w-full text-left font-medium text-indigo-600" onClick={hardRefresh}>
            Refresh app
          </button>
          <p className="mt-2 text-xs muted">Clears cache and reloads. Use this if changes aren't showing up.</p>
        </div>
      </section>

      {/* Master lists — these are the ones that keep growing, so each gets its own screen */}
      <section>
        <h2 className="mb-2 text-lg font-semibold">Master lists</h2>
        <div className="card divide-y divider">
          <MenuRow label="Sections" hint={`${settings.sections.length} sections`} onClick={() => onNavigate('sections')} />
          <MenuRow label="Categories" hint={`${settings.categories.length} categories`} onClick={() => onNavigate('categories')} />
          <MenuRow
            label="Recurring expenses"
            hint={`${recurringActive} active`}
            onClick={() => onNavigate('recurring')}
          />
          <MenuRow
            label="Budgets & savings goal"
            hint={budgetCount > 0 ? `${budgetCount} with a limit` : 'None set'}
            onClick={() => onNavigate('budgets')}
          />
        </div>
      </section>

      {/* Appearance */}
      <section>
        <h2 className="mb-2 text-lg font-semibold">Appearance</h2>
        <div className="card flex gap-2 p-3">
          {(['light', 'dark', 'system'] as ThemePref[]).map((p) => (
            <button
              key={p}
              className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize ${
                pref === p ? 'bg-indigo-600 text-white' : 'border border-slate-300 dark:border-slate-700'
              }`}
              onClick={() => setPref(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      {/* Security */}
      <section>
        <h2 className="mb-2 text-lg font-semibold">Security</h2>
        <div className="card divide-y divider">
          <div className="p-4 text-sm">
            <p className="muted">
              {settings.appPin
                ? 'A PIN is required each time the app is opened.'
                : 'No app PIN set. Anyone with your phone can open the app.'}
            </p>
            <div className="mt-3 flex gap-4">
              <button className="font-medium text-indigo-600" onClick={() => setSettingPin(true)}>
                {settings.appPin ? 'Change PIN' : 'Set a PIN'}
              </button>
              {settings.appPin && (
                <button className="text-red-500" onClick={() => savePin('')}>
                  Remove PIN
                </button>
              )}
            </div>
          </div>
          <div className="p-4 text-sm">
            <p className="muted">Password asked for when unlocking a locked month.</p>
            <button className="mt-3 font-medium text-indigo-600" onClick={() => setChangingPassword(true)}>
              Change month-lock password
            </button>
          </div>
        </div>
      </section>

      {/* Data */}
      <section>
        <h2 className="mb-2 text-lg font-semibold">Data</h2>
        <div className="card divide-y divider">
          <MenuRow label="Import from Apple Notes" onClick={() => onNavigate('import')} />
          <MenuRow
            label="Version history"
            hint={storeKind === 'github' ? 'Restore any earlier save' : 'Needs GitHub storage'}
            onClick={() => onNavigate('history')}
          />
          <button className="w-full px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800" onClick={exportCsv}>
            Export all expenses as CSV
          </button>
          <button className="w-full px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800" onClick={exportBackup}>
            Download full backup (JSON)
          </button>
          <button className="w-full px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800" onClick={() => fileRef.current?.click()}>
            Restore from backup…
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onPickBackup(file)
            e.target.value = ''
          }}
        />
        {importError && <p className="mt-2 text-sm text-red-600">{importError}</p>}
      </section>

      {/* Storage */}
      <section>
        <h2 className="mb-2 text-lg font-semibold">Storage</h2>
        <div className="card p-4 text-sm">
          <p>{storeKind === 'github' ? 'Synced to your private GitHub repo.' : 'Stored locally on this device only.'}</p>
          <button className="mt-3 text-red-500" onClick={() => setConfirmDisconnect(true)}>
            Disconnect storage
          </button>
        </div>
      </section>

      {changingPassword && (
        <ChangePasswordDialog
          currentPassword={settings.monthLockPassword ?? ''}
          onSave={saveMonthLockPassword}
          onCancel={() => setChangingPassword(false)}
        />
      )}

      {settingPin && (
        <PromptDialog
          title={settings.appPin ? 'Change PIN' : 'Set a PIN'}
          message="4 to 8 digits. Required each time the app opens."
          type="password"
          placeholder="e.g. 4821"
          confirmLabel="Save PIN"
          onSubmit={savePin}
          onCancel={() => setSettingPin(false)}
        />
      )}

      {pendingRestore && (
        <ConfirmDialog
          title="Restore this backup?"
          message={`This replaces your current settings and ${
            Object.keys(pendingRestore.months).length
          } month(s) with the contents of the file. Your existing data is overwritten.`}
          confirmLabel="Restore"
          danger
          onConfirm={async () => {
            await importBackup(pendingRestore.settings, pendingRestore.months)
            setPendingRestore(null)
          }}
          onCancel={() => setPendingRestore(null)}
        />
      )}

      {confirmDisconnect && (
        <ConfirmDialog
          message="Disconnect storage? Your data stays in the repo/device, but the app will return to setup."
          confirmLabel="Disconnect"
          danger
          onConfirm={disconnect}
          onCancel={() => setConfirmDisconnect(false)}
        />
      )}
    </div>
  )
}

function MenuRow({ label, hint, onClick }: { label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800"
      onClick={onClick}
    >
      <div>
        <div>{label}</div>
        {hint && <div className="text-xs muted">{hint}</div>}
      </div>
      <span className="text-slate-300">›</span>
    </button>
  )
}
