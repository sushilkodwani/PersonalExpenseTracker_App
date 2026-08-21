import { useEffect, useState } from 'react'
import { markSessionUnlocked } from '../lib/session'

/** App-open PIN screen. A soft lock over the data, not a security boundary. */
export function PinGate({ pin, onUnlock }: { pin: string; onUnlock: () => void }) {
  const [entry, setEntry] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (entry.length < pin.length) return
    if (entry === pin) {
      markSessionUnlocked()
      onUnlock()
    } else {
      setError(true)
      setTimeout(() => {
        setEntry('')
        setError(false)
      }, 600)
    }
  }, [entry, pin, onUnlock])

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <div className="text-4xl">🔒</div>
        <h1 className="mt-3 text-xl font-bold">Enter PIN</h1>
        <p className="mt-1 text-sm muted">Expense Tracker is locked.</p>
      </div>

      <div className={`flex gap-3 ${error ? 'animate-pulse' : ''}`}>
        {Array.from({ length: pin.length }).map((_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full ${
              error ? 'bg-red-500' : i < entry.length ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          />
        ))}
      </div>

      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {keys.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              className="card py-4 text-xl font-semibold active:bg-slate-50 dark:active:bg-slate-800"
              onClick={() => {
                if (k === '⌫') setEntry((e) => e.slice(0, -1))
                else setEntry((e) => (e.length < pin.length ? e + k : e))
              }}
            >
              {k}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
