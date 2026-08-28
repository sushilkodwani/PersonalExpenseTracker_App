import { useState } from 'react'
import { monthLabel } from '../lib/compute'
import type { Month } from '../types'

export function MonthEditDialog({
  month,
  onSave,
  onClose,
}: {
  month: Month
  onSave: (sushSalary: number, khushSalary: number) => void
  onClose: () => void
}) {
  const [sushSalary, setSushSalary] = useState(String(month.people.sush.salary || ''))
  const [khushSalary, setKhushSalary] = useState(String(month.people.khush.salary || ''))

  function handleSave() {
    onSave(Number(sushSalary) || 0, Number(khushSalary) || 0)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={onClose}>
      <div className="w-full rounded-t-2xl bg-white p-4 pb-6 dark:bg-slate-900 sm:max-w-md sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-lg font-semibold">Edit {monthLabel(month.id)}</h3>
        <p className="mb-4 text-sm muted">Update salaries for this month.</p>
        <div className="flex flex-col gap-3">
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
          <div className="mt-1 flex gap-2">
            <button className="btn-primary flex-1" onClick={handleSave}>
              Save
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
