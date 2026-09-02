import { useEffect, useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { CommitInfo } from '../lib/github'
import { fmt, monthLabel, monthSalary, monthSpend } from '../lib/compute'
import { useApp } from '../store/AppContext'
import type { Month } from '../types'

/**
 * Every save is a git commit, so the data repo doubles as an undo history.
 * This screen lists those commits and can roll a month back to any of them.
 */
export function HistoryScreen({ onDone }: { onDone: () => void }) {
  const { monthIds, monthHistory, monthAtCommit, restoreMonth, supportsHistory, canEdit } = useApp()
  const [monthId, setMonthId] = useState('')
  const [commits, setCommits] = useState<CommitInfo[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ commit: CommitInfo; month: Month } | null>(null)
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    if (!monthId && monthIds.length) setMonthId([...monthIds].sort().at(-1)!)
  }, [monthIds, monthId])

  useEffect(() => {
    if (!monthId || !supportsHistory) return
    setLoading(true)
    setError(null)
    monthHistory(monthId)
      .then(setCommits)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [monthId, monthHistory, supportsHistory])

  if (!supportsHistory) {
    return (
      <div className="p-6">
        <p className="text-sm muted">
          Version history comes from your data repo’s git commits, so it’s only available when the app is connected to
          GitHub. You’re currently on local-only storage.
        </p>
      </div>
    )
  }

  async function openPreview(commit: CommitInfo) {
    try {
      const month = await monthAtCommit(monthId, commit.sha)
      if (month) setPreview({ commit, month })
      else setError('That version has no saved copy of this month.')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function doRestore() {
    if (!preview || !canEdit) return
    await restoreMonth(preview.month)
    setPreview(null)
    setRestored(true)
    setTimeout(() => setRestored(false), 4000)
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <div>
        <h2 className="text-lg font-semibold">Version history</h2>
        <p className="mt-1 text-sm muted">Every save is a commit in your data repo. Restore any earlier version.</p>
      </div>

      {restored && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          Restored. <button className="font-semibold underline" onClick={onDone}>View month</button>
        </div>
      )}

      <select className="input" value={monthId} onChange={(e) => setMonthId(e.target.value)}>
        {[...monthIds].sort().reverse().map((id) => (
          <option key={id} value={id}>
            {monthLabel(id)}
          </option>
        ))}
      </select>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
      {loading && <p className="text-center text-sm muted">Loading history…</p>}

      {commits && commits.length === 0 && !loading && (
        <p className="card p-4 text-sm muted">No commits recorded for this month yet.</p>
      )}

      {commits && commits.length > 0 && (
        <div className="card divide-y divider">
          {commits.map((c, i) => (
            <button
              key={c.sha}
              className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800"
              onClick={() => openPreview(c)}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {new Date(c.date).toLocaleString()}
                  {i === 0 && <span className="ml-2 text-xs text-emerald-600">current</span>}
                </div>
                <div className="truncate text-xs muted">
                  {c.message.split('\n')[0]} · {c.sha.slice(0, 7)}
                </div>
              </div>
              <span className="ml-3 text-slate-300">›</span>
            </button>
          ))}
        </div>
      )}

      {preview && canEdit && (
        <ConfirmDialog
          title="Restore this version?"
          message={`Saved ${new Date(preview.commit.date).toLocaleString()} — ${fmt(
            monthSalary(preview.month),
          )} salary, ${fmt(monthSpend(preview.month))} spent. This replaces the current ${monthLabel(
            monthId,
          )} data with a new commit; nothing in the history is lost.`}
          confirmLabel="Restore"
          onConfirm={doRestore}
          onCancel={() => setPreview(null)}
        />
      )}

      {preview && !canEdit && (
        <ConfirmDialog
          title="View only"
          message={`Saved ${new Date(preview.commit.date).toLocaleString()} — ${fmt(
            monthSalary(preview.month),
          )} salary, ${fmt(monthSpend(preview.month))} spent. Restoring requires edit access.`}
          confirmLabel="Close"
          onConfirm={() => setPreview(null)}
          onCancel={() => setPreview(null)}
        />
      )}
    </div>
  )
}
