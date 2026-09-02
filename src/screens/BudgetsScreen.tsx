import { useApp } from '../store/AppContext'

export function BudgetsScreen() {
  const { settings, updateSettings, canEdit } = useApp()
  if (!settings) return null

  const budgets = settings.budgets ?? {}

  function setBudget(categoryId: string, value: string) {
    if (!settings) return
    const amount = Number(value)
    const next = { ...budgets }
    if (!amount || amount <= 0) delete next[categoryId]
    else next[categoryId] = amount
    updateSettings({ ...settings, budgets: next })
  }

  function setGoal(value: string) {
    if (!settings) return
    const amount = Number(value)
    updateSettings({ ...settings, savingsGoalPerYear: amount > 0 ? amount : undefined })
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <div>
        <p className="mb-3 text-sm muted">
          Optional monthly limit per category, across both salaries. Leave blank for no limit.
        </p>
        <div className="card divide-y divider">
          {settings.categories.length === 0 ? (
            <p className="p-4 text-sm muted">Add categories first.</p>
          ) : (
            settings.categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-sm">{c.name}</span>
                <input
                  className="input w-32 py-1.5 text-right text-sm"
                  type="number"
                  inputMode="numeric"
                  placeholder="—"
                  disabled={!canEdit}
                  defaultValue={budgets[c.id] ?? ''}
                  onBlur={(e) => setBudget(c.id, e.target.value)}
                />
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Savings goal</h2>
        <div className="card flex items-center justify-between gap-3 p-4">
          <span className="text-sm">Target for a financial year</span>
          <input
            className="input w-40 py-1.5 text-right text-sm"
            type="number"
            inputMode="numeric"
            placeholder="—"
            disabled={!canEdit}
            defaultValue={settings.savingsGoalPerYear ?? ''}
            onBlur={(e) => setGoal(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
