import { useEffect, useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { MonthEditDialog } from '../components/MonthEditDialog'
import { SwipeRow } from '../components/SwipeRow'
import { fmt, monthLabel, monthSalary, monthSpend } from '../lib/compute'
import { useApp } from '../store/AppContext'

export function MonthListScreen({
  onSelect,
  onCreateNew,
}: {
  onSelect: (monthId: string) => void
  onCreateNew: () => void
}) {
  const { monthIds, months, loadAllMonths, deleteMonth, updateMonth } = useApp()
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const sortedIds = [...monthIds].sort().reverse()

  useEffect(() => {
    void loadAllMonths()
  }, [loadAllMonths])

  if (monthIds.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 p-10 text-center">
        <div className="text-5xl">🗓️</div>
        <p className="muted">
          No months yet. Start your first month — enter the salaries and your template sections will be created
          automatically.
        </p>
        <button className="btn-primary" onClick={onCreateNew}>
          Start first month
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4 pb-24">
      <p className="px-1 text-xs muted">Swipe a month left to delete it, or tap the edit button.</p>

      {sortedIds.map((id) => {
        const m = months[id]
        if (!m) {
          return (
            <div key={id} className="card p-4 text-sm muted">
              {monthLabel(id)} — loading…
            </div>
          )
        }
        const salary = monthSalary(m)
        const spend = monthSpend(m)
        const save = salary - spend
        const pct = salary > 0 ? Math.min(100, (spend / salary) * 100) : 0
        return (
          // Locked months can't be swiped away — unlock first, which is the
          // whole point of locking a finalized month.
          <SwipeRow key={id} className="card" disabled={m.locked} onDelete={() => setPendingDelete(id)}>
            <button className="w-full p-4 text-left active:bg-slate-50 dark:active:bg-slate-800" onClick={() => onSelect(id)}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    {monthLabel(id)}
                    {m.locked && <span title="Locked">🔒</span>}
                  </div>
                  <div className="text-xs muted">
                    Salary {fmt(salary)} · Spent {fmt(spend)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs muted">Saved</div>
                  <div className={`font-semibold ${save >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(save)}</div>
                </div>
              </div>
              {salary > 0 && (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className={`h-full ${spend > salary ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                </div>
              )}
            </button>
            <button
              className="shrink-0 border-l border-slate-200 px-4 py-3 text-sm font-medium text-indigo-600 active:bg-slate-50 dark:border-slate-700 dark:active:bg-slate-800"
              onClick={(e) => {
                e.stopPropagation()
                setEditingId(id)
              }}
            >
              Edit
            </button>
          </SwipeRow>
        )
      })}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${monthLabel(pendingDelete)}?`}
          message={`Every expense recorded in ${monthLabel(
            pendingDelete,
          )} is removed. If you're synced to GitHub the file is deleted, but the commit history still holds it.`}
          confirmLabel={busy ? 'Deleting…' : 'Delete month'}
          danger
          onConfirm={async () => {
            setBusy(true)
            try {
              await deleteMonth(pendingDelete)
            } finally {
              setBusy(false)
              setPendingDelete(null)
            }
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {editingId && months[editingId] && (
        <MonthEditDialog
          month={months[editingId]}
          onSave={(sushSalary, khushSalary) => {
            const m = months[editingId]
            updateMonth({
              ...m,
              people: {
                sush: { ...m.people.sush, salary: sushSalary },
                khush: { ...m.people.khush, salary: khushSalary },
              },
            })
            setEditingId(null)
          }}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  )
}
