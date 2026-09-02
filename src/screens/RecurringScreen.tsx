import { useEffect, useMemo, useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NameSuggestInput } from '../components/NameSuggestInput'
import { fmt } from '../lib/compute'
import { collectNameStats, type NameStat } from '../lib/history'
import { uuid } from '../lib/uuid'
import { useApp } from '../store/AppContext'
import type { Category, Person, RecurringItem, SectionDef } from '../types'
import { PERSON_LABELS } from '../types'

export function RecurringScreen() {
  const { settings, updateSettings, monthIds, months, loadAllMonths, canEdit } = useApp()
  const [editing, setEditing] = useState<RecurringItem | 'new' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  // Suggestions should match what's already used in real months.
  useEffect(() => {
    void loadAllMonths()
  }, [loadAllMonths])

  const nameStats = useMemo(() => collectNameStats(monthIds, months), [monthIds, months])

  if (!settings) return null
  const recurring = settings.recurring ?? []

  function save(item: RecurringItem) {
    if (!settings) return
    const exists = recurring.some((r) => r.id === item.id)
    updateSettings({
      ...settings,
      recurring: exists ? recurring.map((r) => (r.id === item.id ? item : r)) : [...recurring, item],
    })
    setEditing(null)
  }

  function remove(id: string) {
    if (!settings) return
    updateSettings({ ...settings, recurring: recurring.filter((r) => r.id !== id) })
    setPendingDelete(null)
    setEditing(null)
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <p className="text-sm muted">
        Fixed amounts like rent, EMIs and salaries paid out. These are created automatically — unpaid — in every new
        month.
      </p>

      <div className="card divide-y divider">
        {recurring.length === 0 ? (
          <p className="p-4 text-sm muted">Nothing recurring yet.</p>
        ) : (
          recurring.map((r) => (
            <button
              key={r.id}
              className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800 disabled:active:bg-transparent"
              disabled={!canEdit}
              onClick={() => setEditing(r)}
            >
              <div>
                <div className={`font-medium ${r.active ? '' : 'line-through opacity-50'}`}>{r.name}</div>
                <div className="text-xs muted">
                  {PERSON_LABELS[r.person]} · {settings.sections.find((s) => s.id === r.sectionId)?.name ?? '(deleted)'}
                  {!r.active && ' · paused'}
                </div>
              </div>
              <span className="font-semibold">{fmt(r.amount)}</span>
            </button>
          ))
        )}
      </div>

      {canEdit && (
        <button className="btn-secondary" onClick={() => setEditing('new')}>
          + Add recurring expense
        </button>
      )}

      {editing && canEdit && (
        <RecurringEditor
          initial={editing === 'new' ? null : editing}
          sections={settings.sections}
          categories={settings.categories}
          nameStats={nameStats}
          onSave={save}
          onDelete={editing !== 'new' ? () => setPendingDelete(editing.id) : undefined}
          onClose={() => setEditing(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          message="Delete this recurring expense? Months already created keep their copy."
          confirmLabel="Delete"
          danger
          onConfirm={() => remove(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}

function RecurringEditor({
  initial,
  sections,
  categories,
  nameStats,
  onSave,
  onDelete,
  onClose,
}: {
  initial: RecurringItem | null
  sections: SectionDef[]
  categories: Category[]
  nameStats: NameStat[]
  onSave: (item: RecurringItem) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [person, setPerson] = useState<Person>(initial?.person ?? 'sush')
  const [sectionId, setSectionId] = useState(initial?.sectionId ?? '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [active, setActive] = useState(initial?.active ?? true)

  const options = sections.filter((s) => s.owner === person || s.owner === 'shared')
  const valid = name.trim() && Number(amount) > 0 && sectionId && categoryId

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={onClose}>
      <div className="w-full rounded-t-2xl bg-white p-4 pb-6 dark:bg-slate-900 sm:max-w-md sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-lg font-semibold">{initial ? 'Edit recurring' : 'New recurring expense'}</h3>
        <p className="mb-3 text-sm muted">Added to every new month automatically, marked unpaid.</p>
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">
            Name
            <NameSuggestInput
              value={name}
              stats={nameStats}
              placeholder="e.g. House Rent"
              onChange={setName}
              onPick={(s) => {
                // Reuse how this expense has historically been filed.
                if (!amount && s.lastAmount) setAmount(String(s.lastAmount))
                if (!categoryId && s.categoryId) setCategoryId(s.categoryId)
                if (s.person) setPerson(s.person)
                if (s.sectionId) setSectionId(s.sectionId)
              }}
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
            />
          </label>
          <label className="text-sm font-medium">
            Whose salary
            <select
              className="input mt-1"
              value={person}
              onChange={(e) => {
                setPerson(e.target.value as Person)
                setSectionId('')
              }}
            >
              <option value="sush">{PERSON_LABELS.sush}</option>
              <option value="khush">{PERSON_LABELS.khush}</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Section
            <select className="input mt-1" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="" disabled>
                Select a section…
              </option>
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Category
            <select className="input mt-1" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="" disabled>
                Select a category…
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="h-4 w-4" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active (uncheck to pause without deleting)
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
                  sectionId,
                  person,
                  active,
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
