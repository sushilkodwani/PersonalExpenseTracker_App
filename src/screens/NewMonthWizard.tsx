import { useState } from 'react'
import { currentMonthId, monthLabel, nextMonthId } from '../lib/compute'
import { useApp } from '../store/AppContext'

export function NewMonthWizard({ onCreated, onClose }: { onCreated: (monthId: string) => void; onClose: () => void }) {
  const { monthIds, createMonth } = useApp()
  const latest = monthIds.length ? [...monthIds].sort().at(-1)! : null
  const suggested = latest ? nextMonthId(latest) : currentMonthId()

  const [monthId, setMonthId] = useState(suggested)
  const [sushSalary, setSushSalary] = useState('')
  const [khushSalary, setKhushSalary] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exists = monthIds.includes(monthId)

  async function create() {
    setBusy(true)
    setError(null)
    try {
      await createMonth(monthId, {
        sush: Number(sushSalary) || 0,
        khush: Number(khushSalary) || 0,
      })
      onCreated(monthId)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={onClose}>
      <div className="w-full rounded-t-2xl bg-white p-4 pb-6 dark:bg-slate-900 sm:max-w-md sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-lg font-semibold">Start a new month</h3>
        <p className="mb-4 text-sm muted">
          Template sections, your recurring expenses and any unpaid carry-over items are all created automatically.
        </p>
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">
            Month
            <input className="input mt-1" type="month" value={monthId} onChange={(e) => setMonthId(e.target.value)} />
          </label>
          <label className="text-sm font-medium">
            Sush salary (₹)
            <input
              className="input mt-1"
              type="number"
              inputMode="numeric"
              value={sushSalary}
              onChange={(e) => setSushSalary(e.target.value)}
              placeholder="e.g. 169000"
            />
          </label>
          <label className="text-sm font-medium">
            Khush salary (₹)
            <input
              className="input mt-1"
              type="number"
              inputMode="numeric"
              value={khushSalary}
              onChange={(e) => setKhushSalary(e.target.value)}
              placeholder="e.g. 143400"
            />
          </label>
          {exists && <p className="text-sm text-amber-600">{monthLabel(monthId)} already exists — pick another month.</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="mt-1 flex gap-2">
            <button className="btn-primary flex-1" disabled={busy || exists || !monthId} onClick={create}>
              {busy ? 'Creating…' : `Create ${monthLabel(monthId)}`}
            </button>
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
