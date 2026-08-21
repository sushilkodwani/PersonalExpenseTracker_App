import { fmt, monthLabel, monthSalary, monthSpend } from '../lib/compute'
import type { Conflict } from '../store/AppContext'

/**
 * Shown when another device saved the same month first. Both versions are
 * summarised so the choice isn't blind.
 */
export function ConflictDialog({
  conflict,
  onResolve,
}: {
  conflict: Conflict
  onResolve: (choice: 'mine' | 'remote') => void
}) {
  const summary = (m: typeof conflict.local) =>
    `${fmt(monthSalary(m))} salary · ${fmt(monthSpend(m))} spent`

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/50 sm:items-center sm:justify-center">
      <div className="w-full rounded-t-2xl bg-white p-4 pb-6 dark:bg-slate-900 sm:max-w-sm sm:rounded-2xl">
        <h3 className="text-lg font-semibold">{monthLabel(conflict.monthId)} changed elsewhere</h3>
        <p className="mt-1 text-sm muted">
          This month was also edited on another device. Pick which version to keep — the other one is discarded.
        </p>

        <div className="mt-4 space-y-2">
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="text-sm font-semibold">This device</div>
            <div className="text-xs muted">{summary(conflict.local)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="text-sm font-semibold">Other device (saved first)</div>
            <div className="text-xs muted">{summary(conflict.remote)}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <button className="btn-primary" onClick={() => onResolve('mine')}>
            Keep this device’s version
          </button>
          <button className="btn-secondary" onClick={() => onResolve('remote')}>
            Use the other device’s version
          </button>
        </div>
      </div>
    </div>
  )
}
