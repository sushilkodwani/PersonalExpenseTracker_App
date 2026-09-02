import { useState } from 'react'
import { resolveRole, saveEmail } from '../lib/auth'
import { verifyRepoAccess } from '../lib/github'
import { peekSettings } from '../lib/store'
import { useApp } from '../store/AppContext'

export function SetupScreen() {
  const { configure } = useApp()
  const [mode, setMode] = useState<'choose' | 'github'>('choose')
  const [email, setEmail] = useState('')
  const [owner, setOwner] = useState('')
  const [repo, setRepo] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function connectGitHub() {
    setBusy(true)
    setError(null)
    try {
      const cfg = { token: token.trim(), owner: owner.trim(), repo: repo.trim() }
      const normalizedEmail = email.trim().toLowerCase()
      await verifyRepoAccess(cfg)

      // Check access before connecting — settings.json may not exist yet on a
      // brand-new repo, in which case only the hardcoded admin can proceed.
      const existing = await peekSettings(cfg)
      const role = resolveRole(normalizedEmail, existing)
      if (role === 'denied') {
        setError('Access denied — this email has not been granted access. Ask the admin to add you first.')
        return
      }

      saveEmail(normalizedEmail)
      await configure({ kind: 'github', ...cfg })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div className="text-center">
        <div className="text-4xl">💸</div>
        <h1 className="mt-2 text-2xl font-bold">Expense Tracker</h1>
        <p className="mt-1 text-sm muted">Monthly salary & expense tracking for Sush + Khush</p>
      </div>

      {mode === 'choose' && (
        <div className="flex flex-col gap-3">
          <button className="btn-primary py-3" onClick={() => setMode('github')}>
            Connect GitHub repo (sync across devices)
          </button>
          <button className="btn-secondary py-3" onClick={() => configure({ kind: 'local' })}>
            Local only (this device, no sync)
          </button>
          <p className="text-center text-xs muted">
            You can switch later — GitHub keeps your data in a private repo with full edit history.
          </p>
        </div>
      )}

      {mode === 'github' && (
        <div className="card flex flex-col gap-3 p-4">
          <p className="text-sm muted">
            Create a <b>private</b> repo on GitHub, then a{' '}
            <a
              className="text-indigo-600 underline"
              href="https://github.com/settings/personal-access-tokens/new"
              target="_blank"
              rel="noreferrer"
            >
              fine-grained token
            </a>{' '}
            scoped to only that repo with <b>Contents: Read and write</b> permission.
          </p>
          <label className="text-sm font-medium">
            Your email
            <input
              className="input mt-1"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoCapitalize="none"
            />
          </label>
          <p className="-mt-2 text-xs muted">Used to check what access you've been granted. The admin adds emails in Settings.</p>
          <label className="text-sm font-medium">
            GitHub username
            <input className="input mt-1" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="e.g. kaushik" autoCapitalize="none" />
          </label>
          <label className="text-sm font-medium">
            Data repo name
            <input className="input mt-1" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="e.g. expense-data" autoCapitalize="none" />
          </label>
          <label className="text-sm font-medium">
            Personal access token
            <input className="input mt-1" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" />
          </label>
          <p className="text-xs muted">The token stays in this browser only — it is never sent anywhere except api.github.com.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary" disabled={busy || !email.trim() || !owner || !repo || !token} onClick={connectGitHub}>
            {busy ? 'Checking…' : 'Connect'}
          </button>
          <button className="btn-secondary" onClick={() => setMode('choose')}>
            Back
          </button>
        </div>
      )}
    </div>
  )
}
