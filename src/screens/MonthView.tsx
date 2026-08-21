import { useEffect, useMemo, useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ExpenseModal, type ExpensePrefill } from '../components/ExpenseModal'
import { PrintReport } from '../components/PrintReport'
import { PromptDialog } from '../components/PromptDialog'
import { SwipeRow } from '../components/SwipeRow'
import { UndoSnackbar } from '../components/UndoSnackbar'
import { collectNameStats } from '../lib/history'
import {
  categoryTotals,
  fmt,
  personRemaining,
  personSpend,
  sectionFullyPaid,
  sectionSpend,
  sectionTransfers,
} from '../lib/compute'
import { useApp } from '../store/AppContext'
import type { ExpenseItem, Month, Person, SectionInstance } from '../types'
import { PEOPLE, PERSON_LABELS } from '../types'

export function MonthView({ month }: { month: Month }) {
  const { settings, updateMonth, monthIds, months, loadAllMonths } = useApp()
  const [person, setPerson] = useState<Person>('sush')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [prefill, setPrefill] = useState<ExpensePrefill | null>(null)
  const [editing, setEditing] = useState<{ sectionId: string; item: ExpenseItem } | null>(null)
  const [showAddSection, setShowAddSection] = useState(false)
  const [editingSalary, setEditingSalary] = useState(false)
  const [confirmRemoveSectionId, setConfirmRemoveSectionId] = useState<string | null>(null)
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [pendingUndo, setPendingUndo] = useState<{ person: Person; sectionId: string; item: ExpenseItem; index: number } | null>(
    null,
  )

  useEffect(() => {
    void loadAllMonths()
  }, [loadAllMonths])

  // One pass over history per person, reused by every section's quick-add row.
  const statsBySection = useMemo(() => {
    const map = new Map<string, ReturnType<typeof collectNameStats>>()
    for (const sectionId of new Set(month.people[person].sections.map((s) => s.sectionId))) {
      map.set(sectionId, collectNameStats(monthIds, months, { sectionId, person }))
    }
    return map
  }, [monthIds, months, month, person])

  if (!settings) return null
  const pm = month.people[person]
  const locked = !!month.locked

  const sectionName = (id: string) => settings.sections.find((s) => s.id === id)?.name ?? '(deleted)'
  const categoryName = (id: string) => settings.categories.find((c) => c.id === id)?.name ?? '(deleted)'

  // Parameterized on the target person so undo can restore into whichever
  // person's sections the item was deleted from, even if the tab has changed since.
  function patchPersonOf(targetPerson: Person, update: (sections: SectionInstance[]) => SectionInstance[]) {
    if (month.locked) return
    const target = month.people[targetPerson]
    updateMonth({
      ...month,
      people: { ...month.people, [targetPerson]: { ...target, sections: update(target.sections) } },
    })
  }

  function patchPerson(update: (sections: SectionInstance[]) => SectionInstance[]) {
    patchPersonOf(person, update)
  }

  function saveItem(sectionId: string, item: ExpenseItem) {
    patchPerson((sections) =>
      sections.map((s) => {
        if (s.sectionId !== sectionId) return s
        const exists = s.items.some((i) => i.id === item.id)
        return { ...s, items: exists ? s.items.map((i) => (i.id === item.id ? item : i)) : [...s.items, item] }
      }),
    )
    closeExpenseModal()
  }

  function deleteItem(sectionId: string, itemId: string) {
    const section = pm.sections.find((s) => s.sectionId === sectionId)
    const index = section?.items.findIndex((i) => i.id === itemId) ?? -1
    const item = section?.items[index]

    patchPerson((sections) =>
      sections.map((s) => (s.sectionId === sectionId ? { ...s, items: s.items.filter((i) => i.id !== itemId) } : s)),
    )
    if (item) setPendingUndo({ person, sectionId, item, index })
    closeExpenseModal()
  }

  function undoDelete() {
    if (!pendingUndo) return
    const { person: targetPerson, sectionId, item, index } = pendingUndo
    patchPersonOf(targetPerson, (sections) =>
      sections.map((s) => {
        if (s.sectionId !== sectionId) return s
        const items = [...s.items]
        items.splice(Math.min(index, items.length), 0, item)
        return { ...s, items }
      }),
    )
    setPendingUndo(null)
  }

  function closeExpenseModal() {
    setAddingTo(null)
    setEditing(null)
    setPrefill(null)
  }

  function togglePaid(sectionId: string, itemId: string) {
    patchPerson((sections) =>
      sections.map((s) =>
        s.sectionId === sectionId
          ? { ...s, items: s.items.map((i) => (i.id === itemId ? { ...i, paid: !i.paid } : i)) }
          : s,
      ),
    )
  }

  function markSectionPaid(sectionId: string) {
    patchPerson((sections) =>
      sections.map((s) =>
        s.sectionId === sectionId ? { ...s, items: s.items.map((i) => ({ ...i, paid: true })) } : s,
      ),
    )
  }

  function addSection(sectionId: string) {
    patchPerson((sections) => [...sections, { sectionId, items: [] }])
    setShowAddSection(false)
    setExpanded((e) => ({ ...e, [sectionId]: true }))
  }

  function removeSection(sectionId: string) {
    patchPerson((sections) => sections.filter((s) => s.sectionId !== sectionId))
    setConfirmRemoveSectionId(null)
  }

  function setSalary(value: number) {
    if (month.locked) return
    updateMonth({ ...month, people: { ...month.people, [person]: { ...pm, salary: value } } })
  }

  function lockMonth() {
    updateMonth({ ...month, locked: true })
  }

  function submitUnlock(pw: string) {
    if (pw !== settings?.monthLockPassword) {
      setUnlockError('Incorrect password.')
      return
    }
    updateMonth({ ...month, locked: false })
    setShowUnlockPrompt(false)
    setUnlockError(null)
  }

  /** Frequently used names for this section that aren't in it yet this month. */
  function quickAddsFor(section: SectionInstance) {
    const used = new Set(section.items.map((i) => i.name.toLowerCase()))
    return (statsBySection.get(section.sectionId) ?? []).filter((s) => !used.has(s.name.toLowerCase())).slice(0, 5)
  }

  const availableSections = settings.sections.filter(
    (s) => (s.owner === person || s.owner === 'shared') && !pm.sections.some((inst) => inst.sectionId === s.id),
  )

  const spend = personSpend(pm)
  const remaining = personRemaining(pm)

  // Budgets are household-wide (categories are shared), so they read from the
  // whole month rather than the selected person.
  const budgets = settings.budgets ?? {}
  const spentByCategory = categoryTotals(month)
  const budgetRows = Object.entries(budgets)
    .filter(([, limit]) => limit > 0)
    .map(([categoryId, limit]) => ({
      categoryId,
      name: categoryName(categoryId),
      limit,
      spent: spentByCategory.get(categoryId) ?? 0,
    }))
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit)

  return (
    <div className="pb-24">
      <PrintReport month={month} settings={settings} />

      <div className="no-print">
        {/* Person tabs */}
        <div className="flex gap-2 p-4 pb-0">
          {PEOPLE.map((p) => (
            <button
              key={p}
              className={`flex-1 rounded-full py-2 text-sm font-semibold ${
                person === p ? 'bg-indigo-600 text-white' : 'surface text-slate-600 dark:text-slate-300'
              }`}
              onClick={() => setPerson(p)}
            >
              {PERSON_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Summary card */}
        <div className="card m-4 p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs muted">Salary</div>
              {editingSalary && !locked ? (
                <input
                  className="input mt-1 px-1 py-1 text-center text-sm"
                  type="number"
                  inputMode="numeric"
                  defaultValue={pm.salary || ''}
                  autoFocus
                  onBlur={(e) => {
                    setSalary(Number(e.target.value) || 0)
                    setEditingSalary(false)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
              ) : (
                <button className="font-semibold disabled:cursor-default" disabled={locked} onClick={() => setEditingSalary(true)}>
                  {fmt(pm.salary)}
                </button>
              )}
            </div>
            <div>
              <div className="text-xs muted">Spent</div>
              <div className="font-semibold text-rose-600">{fmt(spend)}</div>
            </div>
            <div>
              <div className="text-xs muted">Save</div>
              <div className={`font-semibold ${remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(remaining)}</div>
            </div>
          </div>
          {pm.salary > 0 && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={`h-full ${spend > pm.salary ? 'bg-red-500' : 'bg-indigo-500'}`}
                style={{ width: `${Math.min(100, (spend / pm.salary) * 100)}%` }}
              />
            </div>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
            <span className={`text-xs font-medium ${locked ? 'text-amber-600' : 'muted'}`}>
              {locked ? '🔒 Locked — no edits allowed' : 'Unlocked'}
            </span>
            <span className="flex gap-4">
              <button className="text-xs font-semibold text-indigo-600" onClick={() => window.print()}>
                Print / PDF
              </button>
              <button
                className="text-xs font-semibold text-indigo-600"
                onClick={locked ? () => setShowUnlockPrompt(true) : lockMonth}
              >
                {locked ? 'Unlock' : 'Lock this month'}
              </button>
            </span>
          </div>
        </div>

        {/* Budgets */}
        {budgetRows.length > 0 && (
          <div className="card mx-4 mb-4 p-4">
            <h3 className="mb-3 text-sm font-semibold">Budgets this month</h3>
            <div className="flex flex-col gap-2.5">
              {budgetRows.map((b) => {
                const pct = Math.min(100, (b.spent / b.limit) * 100)
                const over = b.spent > b.limit
                const near = !over && pct >= 80
                return (
                  <div key={b.categoryId}>
                    <div className="flex justify-between text-xs">
                      <span className={over ? 'font-semibold text-red-600' : near ? 'font-semibold text-amber-600' : ''}>
                        {b.name}
                        {over && ' · over'}
                      </span>
                      <span className="muted">
                        {fmt(b.spent)} / {fmt(b.limit)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full ${over ? 'bg-red-500' : near ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Sections */}
        <div className="flex flex-col gap-3 px-4">
          {pm.sections.map((section) => {
            const spendTotal = sectionSpend(section)
            const transferTotal = sectionTransfers(section)
            const allPaid = sectionFullyPaid(section)
            const isOpen = expanded[section.sectionId] ?? false
            const quickAdds = isOpen && !locked ? quickAddsFor(section) : []
            return (
              <div key={section.sectionId} className="card overflow-hidden">
                <button
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                  onClick={() => setExpanded((e) => ({ ...e, [section.sectionId]: !isOpen }))}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-lg ${allPaid ? '' : 'opacity-30'}`}>{allPaid ? '✅' : '⬜'}</span>
                    <span className="font-medium">{sectionName(section.sectionId)}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{spendTotal > 0 || section.items.length > 0 ? fmt(spendTotal) : '—'}</div>
                    {transferTotal > 0 && <div className="text-xs text-sky-600">+ {fmt(transferTotal)} pass-through</div>}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                    {section.items.map((item) => (
                      <SwipeRow
                        key={item.id}
                        disabled={locked}
                        contentClassName="bg-slate-50 dark:bg-slate-800"
                        onDelete={() => deleteItem(section.sectionId, item.id)}
                      >
                        <div className="flex items-center gap-3 py-2.5 pl-7 pr-4">
                          <input
                            type="checkbox"
                            className="h-4 w-4 shrink-0"
                            checked={item.paid}
                            disabled={locked}
                            onChange={() => togglePaid(section.sectionId, item.id)}
                          />
                          <button
                            className="flex flex-1 items-center justify-between text-left disabled:cursor-default"
                            disabled={locked}
                            onClick={() => setEditing({ sectionId: section.sectionId, item })}
                          >
                            <div>
                              <div
                                className={
                                  item.paid
                                    ? 'text-slate-400 line-through dark:text-slate-500'
                                    : 'text-slate-600 dark:text-slate-300'
                                }
                              >
                                {item.name}
                              </div>
                              <div className="text-xs muted">
                                {categoryName(item.categoryId)}
                                {item.isTransfer && ' · pass-through'}
                                {item.carryToNextMonth && ' · carries over'}
                              </div>
                            </div>
                            <div className={`font-medium ${item.isTransfer ? 'text-sky-600' : 'text-slate-700 dark:text-slate-300'}`}>
                              {fmt(item.amount)}
                              {item.isTransfer && <span className="text-xs"> (T)</span>}
                            </div>
                          </button>
                        </div>
                      </SwipeRow>
                    ))}

                    {quickAdds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-4 py-2.5 pl-7 dark:border-slate-800">
                        {quickAdds.map((q) => (
                          <button
                            key={q.name}
                            className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 active:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300"
                            onClick={() => {
                              setAddingTo(section.sectionId)
                              setPrefill({ name: q.name, amount: q.lastAmount, categoryId: q.categoryId })
                            }}
                          >
                            + {q.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {!locked && (
                      <div className="flex justify-between border-t border-slate-100 px-4 py-2 dark:border-slate-800">
                        <button
                          className="text-sm font-medium text-indigo-600"
                          onClick={() => {
                            setAddingTo(section.sectionId)
                            setPrefill(null)
                          }}
                        >
                          + Add expense
                        </button>
                        <span className="flex gap-4">
                          {section.items.some((i) => !i.paid) && (
                            <button className="text-sm text-emerald-600" onClick={() => markSectionPaid(section.sectionId)}>
                              Mark all paid
                            </button>
                          )}
                          {section.items.length === 0 && (
                            <button className="text-sm muted" onClick={() => setConfirmRemoveSectionId(section.sectionId)}>
                              Remove
                            </button>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {!locked && (
            <button className="btn-secondary" onClick={() => setShowAddSection(true)}>
              + Add section
            </button>
          )}
        </div>
      </div>

      {/* Add-section picker (settings-driven, no free text) */}
      {showAddSection && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={() => setShowAddSection(false)}>
          <div className="w-full rounded-t-2xl bg-white p-4 pb-6 dark:bg-slate-900 sm:max-w-md sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-lg font-semibold">Add section</h3>
            {availableSections.length > 0 ? (
              <div className="flex flex-col divide-y divider">
                {availableSections.map((s) => (
                  <button key={s.id} className="py-3 text-left font-medium active:bg-slate-50 dark:active:bg-slate-800" onClick={() => addSection(s.id)}>
                    {s.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-4 text-sm muted">All your sections are already in this month.</p>
            )}
            <p className="mt-2 text-xs muted">Don’t see what you need? Add it in Settings → Sections first.</p>
          </div>
        </div>
      )}

      {(addingTo || editing) && (
        <ExpenseModal
          settings={settings}
          initial={editing?.item ?? null}
          prefill={prefill}
          onSave={(item) => saveItem(editing?.sectionId ?? addingTo!, item)}
          onDelete={editing ? () => deleteItem(editing.sectionId, editing.item.id) : undefined}
          onClose={closeExpenseModal}
        />
      )}

      {confirmRemoveSectionId && (
        <ConfirmDialog
          message={`Remove ${sectionName(confirmRemoveSectionId)} from this month? Its expenses will be deleted.`}
          confirmLabel="Remove"
          danger
          onConfirm={() => removeSection(confirmRemoveSectionId)}
          onCancel={() => setConfirmRemoveSectionId(null)}
        />
      )}

      {showUnlockPrompt && (
        <PromptDialog
          title="Unlock this month"
          message="Enter the password to allow edits again."
          type="password"
          placeholder="Password"
          confirmLabel="Unlock"
          error={unlockError}
          onSubmit={submitUnlock}
          onCancel={() => {
            setShowUnlockPrompt(false)
            setUnlockError(null)
          }}
        />
      )}

      {pendingUndo && (
        <UndoSnackbar
          message={`Deleted “${pendingUndo.item.name}”`}
          onUndo={undoDelete}
          onDismiss={() => setPendingUndo(null)}
        />
      )}
    </div>
  )
}
