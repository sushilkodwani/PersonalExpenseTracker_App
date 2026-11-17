import { useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useApp } from '../store/AppContext'

/**
 * Shown when GitHub rejects the saved token (expired or replaced). Asks only for
 * the new token — the repo, email and everything else on this device are kept,
 * and edits that failed to save are sent once the new token works.
 *
 * `onLater` is given mid-session so the user can finish looking at the screen;
 * at startup there's nothing to show without a working token.
 */
export function TokenGateScreen({ onLater }: { onLater?: () => void }) {
  const { replaceToken, disconnect } = useApp()
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await replaceToken(token)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[57] overflow-y-auto bg-slate-100 dark:bg-slate-950">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 p-6">
        <div className="text-center">
          <div className="text-4xl">🔑</div>
          <h1 className="mt-2 text-xl font-bold">New access token needed</h1>
          <p className="mt-2 text-sm muted">
            GitHub stopped accepting this device’s access token — it has expired or was replaced. Enter the new token to
            continue. Your data and any unsaved changes are kept.
          </p>
        </div>

        <form
          className="card flex flex-col gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <label className="text-sm font-medium">
            New personal access token
            <input
              className="input mt-1"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="github_pat_…"
              autoFocus
            />
          </label>
          <p className="text-xs muted">
            Create it at{' '}
            <a
              className="text-indigo-600 underline"
              href="https://github.com/settings/personal-access-tokens/new"
              target="_blank"
              rel="noreferrer"
            >
              github.com → Fine-grained tokens
            </a>
            , scoped to only your data repo with <b>Contents: Read and write</b>. Note its expiry date for Settings → Data
            repo.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary" type="submit" disabled={busy || !token.trim()}>
            {busy ? 'Checking…' : 'Use this token'}
          </button>
          {onLater ? (
            <button className="btn-secondary" type="button" onClick={onLater}>
              Not now
            </button>
          ) : (
            <button className="text-sm text-red-500" type="button" onClick={() => setConfirmDisconnect(true)}>
              Disconnect storage instead
            </button>
          )}
        </form>
      </div>

      {confirmDisconnect && (
        <ConfirmDialog
          message="Disconnect storage? Your data stays in the repo, but the app will return to setup."
          confirmLabel="Disconnect"
          danger
          onConfirm={disconnect}
          onCancel={() => setConfirmDisconnect(false)}
        />
      )}
    </div>
  )
}
