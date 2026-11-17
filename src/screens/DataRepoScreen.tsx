import { useState } from 'react'
import { addDays, formatDate, TOKEN_WARN_DAYS, todayISO, tokenExpiryStatus } from '../lib/dates'
import { loadStoreConfig } from '../lib/store'
import { useApp } from '../store/AppContext'

export function DataRepoScreen() {
  const { settings, updateSettings, isAdmin, replaceToken } = useApp()
  const cfg = loadStoreConfig()
  const [expiry, setExpiry] = useState(settings?.tokenExpiresOn ?? '')
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const [newToken, setNewToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [tokenDone, setTokenDone] = useState(false)

  if (!settings || cfg?.kind !== 'github') {
    return <p className="p-6 text-center text-sm muted">Only GitHub storage uses an access token.</p>
  }

  const status = settings.tokenExpiresOn ? tokenExpiryStatus(settings.tokenExpiresOn) : null

  function saveExpiry(value: string) {
    if (!settings) return
    updateSettings({ ...settings, tokenExpiresOn: value || undefined })
    setSavedNote(value ? 'Expiry date saved' : 'Expiry date cleared')
    setTimeout(() => setSavedNote(null), 2500)
  }

  async function submitToken() {
    setBusy(true)
    setTokenError(null)
    setTokenDone(false)
    try {
      await replaceToken(newToken)
      setNewToken('')
      setTokenDone(true)
    } catch (e) {
      setTokenError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 pb-24">
      <section>
        <h2 className="mb-2 text-lg font-semibold">Repository</h2>
        <div className="card p-4 text-sm">
          <p className="font-medium">
            {cfg.owner}/{cfg.repo}
          </p>
          <p className="mt-1 muted">Private GitHub repo holding all the data. Connected with a fine-grained access token.</p>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Token expiry</h2>
        <div className="card flex flex-col gap-3 p-4 text-sm">
          {status ? (
            <p className={status.days <= TOKEN_WARN_DAYS ? 'font-semibold text-amber-600' : ''}>
              {formatDate(settings.tokenExpiresOn!)} · {status.text}
            </p>
          ) : (
            <p className="muted">No expiry date set.</p>
          )}

          {isAdmin ? (
            <>
              <label className="font-medium">
                Token expiry date
                <input className="input mt-1" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
              </label>
              <p className="-mt-1 text-xs muted">
                Shown on every device. A reminder appears {TOKEN_WARN_DAYS} days before this date. Find it on GitHub under
                Settings → Developer settings → Fine-grained tokens.
              </p>
              <div className="flex gap-2">
                <button
                  className="btn-primary flex-1"
                  disabled={expiry === (settings.tokenExpiresOn ?? '')}
                  onClick={() => saveExpiry(expiry)}
                >
                  Save date
                </button>
                <button className="btn-secondary" onClick={() => setExpiry(addDays(todayISO(), 365))}>
                  +1 year
                </button>
                {settings.tokenExpiresOn && (
                  <button
                    className="btn-secondary text-red-500"
                    onClick={() => {
                      setExpiry('')
                      saveExpiry('')
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
              {savedNote && <p className="text-xs text-emerald-600">✓ {savedNote}</p>}
            </>
          ) : (
            <p className="text-xs muted">The admin sets this date.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Replace token on this device</h2>
        <form
          className="card flex flex-col gap-3 p-4 text-sm"
          onSubmit={(e) => {
            e.preventDefault()
            void submitToken()
          }}
        >
          <p className="muted">
            After creating a new token on GitHub, enter it here. It’s checked against the repo first, then saved on this
            device only. Every other device needs it too — they’ll be asked when the old one stops working.
          </p>
          <input
            className="input"
            type="password"
            autoComplete="off"
            value={newToken}
            onChange={(e) => setNewToken(e.target.value)}
            placeholder="github_pat_…"
          />
          {tokenError && <p className="text-red-600">{tokenError}</p>}
          {tokenDone && (
            <p className="text-emerald-600">
              ✓ New token saved on this device.{isAdmin && ' Remember to update the expiry date above.'}
            </p>
          )}
          <button className="btn-secondary" type="submit" disabled={busy || !newToken.trim()}>
            {busy ? 'Checking…' : 'Replace token'}
          </button>
        </form>
      </section>
    </div>
  )
}
