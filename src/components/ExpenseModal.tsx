import { useEffect, useMemo, useState } from 'react'
import type { ExpenseItem, Settings } from '../types'
import { uuid } from '../lib/uuid'
import { collectNameStats, type NameStat } from '../lib/history'
import { NameSuggestInput } from './NameSuggestInput'
import { useApp } from '../store/AppContext'

export interface ExpensePrefill {
  name: string
  amount?: number
  categoryId?: string
}

export function ExpenseModal({
  settings,
  initial,
  prefill,
  onSave,
  onDelete,
  onClose,
}: {
  settings: Settings
  initial: ExpenseItem | null
  prefill?: ExpensePrefill | null
  onSave: (item: ExpenseItem) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const { monthIds, months, loadAllMonths } = useApp()
  const [name, setName] = useState(initial?.name ?? prefill?.name ?? '')
  const [amount, setAmount] = useState(
    initial ? String(initial.amount) : prefill?.amount ? String(prefill.amount) : '',
  )
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? prefill?.categoryId ?? '')
  const [paid, setPaid] = useState(initial?.paid ?? false)
  const [isTransfer, setIsTransfer] = useState(initial?.isTransfer ?? false)
  const [carry, setCarry] = useState(initial?.carryToNextMonth ?? false)

  // Suggestions draw on every month ever recorded, not just what's on screen.
  useEffect(() => {
    void loadAllMonths()
  }, [loadAllMonths])

  const stats = useMemo(
    () => collectNameStats(monthIds, months, { excludeItemId: initial?.id }),
    [monthIds, months, initial?.id],
  )

  function selectSuggestion(s: NameStat) {
    if (!categoryId && s.categoryId) setCategoryId(s.categoryId)
    if (!amount && s.lastAmount) setAmount(String(s.lastAmount))
  }

  const valid = name.trim() && Number(amount) > 0 && categoryId

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={onClose}>
      <div
        className="w-full rounded-t-2xl bg-white p-4 pb-6 dark:bg-slate-900 sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-lg font-semibold">{initial ? 'Edit expense' : 'Add expense'}</h3>
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">
            What was it?
            <NameSuggestInput
              value={name}
              stats={stats}
              placeholder="e.g. Zepto, Petrol, Recharge"
              autoFocus={!initial && !prefill}
              onChange={setName}
              onPick={selectSuggestion}
            />
          </label>
          <label className="text-sm font-medium">
            Amount (₹)
            <input
              className="input mt-1"
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              autoFocus={!!prefill}
            />
          </label>
          <label className="text-sm font-medium">
            Category
            <select className="input mt-1" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="" disabled>
                Select a category…
              </option>
              {settings.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs muted">Missing one? Add it in Settings first.</span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            Paid
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={isTransfer} onChange={(e) => setIsTransfer(e.target.checked)} />
            <span>
              Pass-through / transfer <span className="muted">(someone reimburses this — shown on the card but not counted as your spend)</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={carry} onChange={(e) => setCarry(e.target.checked)} />
            <span>
              Carry to next month <span className="muted">(paid from savings — owe it back next month)</span>
            </span>
          </label>

          <div className="mt-2 flex gap-2">
            <button
              className="btn-primary flex-1"
              disabled={!valid}
              onClick={() =>
                onSave({
                  id: initial?.id ?? uuid(),
                  name: name.trim(),
                  amount: Number(amount),
                  categoryId,
                  paid,
                  isTransfer,
                  carryToNextMonth: carry,
                })
              }
            >
              Save
            </button>
            {onDelete && (
              <button className="btn-secondary text-red-500" onClick={onDelete}>
                Delete
              </button>
            )}
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
