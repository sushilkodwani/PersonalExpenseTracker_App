import { useEffect, useMemo, useState } from 'react'
import { fmt, monthLabel } from '../lib/compute'
import { collectNameStats, guessCategoryId } from '../lib/history'
import { parseNotes, type ParsedRow } from '../lib/parse'
import { uuid } from '../lib/uuid'
import { useApp } from '../store/AppContext'
import type { ExpenseItem, Person } from '../types'
import { PERSON_LABELS } from '../types'

interface DraftRow extends ParsedRow {
  key: string
  categoryId: string
  include: boolean
  sectionId: string
}

/** Paste a month straight out of Apple Notes and turn it into real line items. */
export function ImportScreen({ onDone }: { onDone: () => void }) {
  const { settings, monthIds, months, loadAllMonths, loadMonth, updateMonth } = useApp()
  const [text, setText] = useState('')
  const [person, setPerson] = useState<Person>('sush')
  const [monthId, setMonthId] = useState('')
  const [rows, setRows] = useState<DraftRow[] | null>(null)
  const [done, setDone] = useState<number | null>(null)

  useEffect(() => {
    void loadAllMonths()
  }, [loadAllMonths])

  useEffect(() => {
    if (!monthId && monthIds.length) setMonthId([...monthIds].sort().at(-1)!)
  }, [monthIds, monthId])

  const stats = useMemo(() => collectNameStats(monthIds, months), [monthIds, months])

  if (!settings) return null

  const ownedSections = settings.sections.filter((s) => s.owner === person || s.owner === 'shared')
  const fallbackCategoryId = settings.categories.find((c) => c.name === 'Other')?.id ?? settings.categories[0]?.id ?? ''

  function parse() {
    if (!settings) return
    const parsed = parseNotes(text, ownedSections.map((s) => s.name))
    setRows(
      parsed.map((r, i) => ({
        ...r,
        key: `${i}-${r.name}`,
        include: true,
        categoryId: guessCategoryId(r.name, stats) ?? fallbackCategoryId,
        sectionId: ownedSections.find((s) => s.name.toLowerCase() === r.sectionName?.toLowerCase())?.id ?? '',
      })),
    )
  }

  async function runImport() {
    if (!rows || !monthId) return
    const month = months[monthId] ?? (await loadMonth(monthId))
    if (!month) return

    const pm = month.people[person]
    const sections = pm.sections.map((s) => ({ ...s, items: [...s.items] }))
    let added = 0

    for (const row of rows) {
      if (!row.include || !row.sectionId) continue
      let target = sections.find((s) => s.sectionId === row.sectionId)
      if (!target) {
        target = { sectionId: row.sectionId, items: [] }
        sections.push(target)
      }
      const item: ExpenseItem = {
        id: uuid(),
        name: row.name,
        amount: row.amount,
        categoryId: row.categoryId,
        paid: row.paid,
        isTransfer: row.isTransfer,
        carryToNextMonth: false,
      }
      target.items.push(item)
      added++
    }

    updateMonth({ ...month, people: { ...month.people, [person]: { ...pm, sections } } })
    setDone(added)
    setRows(null)
    setText('')
  }

  const importable = rows?.filter((r) => r.include && r.sectionId).length ?? 0
  const unassigned = rows?.filter((r) => r.include && !r.sectionId).length ?? 0

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <div>
        <h2 className="text-lg font-semibold">Import from Apple Notes</h2>
        <p className="mt-1 text-sm muted">
          Paste a month exactly as it appears in your note. Section headings are matched by name, and checkboxes become
          paid status. Amounts marked “(T)” are treated as pass-through.
        </p>
      </div>

      {done !== null && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          Imported {done} {done === 1 ? 'expense' : 'expenses'} into {monthLabel(monthId)}.
          <button className="ml-2 font-semibold underline" onClick={onDone}>
            View month
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <select className="input" value={monthId} onChange={(e) => setMonthId(e.target.value)}>
          {[...monthIds].sort().reverse().map((id) => (
            <option key={id} value={id}>
              {monthLabel(id)}
            </option>
          ))}
        </select>
        <select className="input" value={person} onChange={(e) => setPerson(e.target.value as Person)}>
          <option value="sush">{PERSON_LABELS.sush}</option>
          <option value="khush">{PERSON_LABELS.khush}</option>
        </select>
      </div>

      <textarea
        className="input h-48 font-mono text-sm"
        placeholder={'- [x] Axis CC - 6097\n    - [x] Recharge - 200\n    - [x] Petrol - 3000'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <button className="btn-primary" disabled={!text.trim() || !monthId} onClick={parse}>
        Preview
      </button>

      {rows && (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="muted">
              {importable} ready{unassigned > 0 && `, ${unassigned} need a section`}
            </span>
            <span className="font-semibold">
              {fmt(rows.filter((r) => r.include && !r.isTransfer).reduce((s, r) => s + r.amount, 0))}
            </span>
          </div>

          {rows.length === 0 && <p className="card p-4 text-sm muted">Nothing recognisable in that text.</p>}

          <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <div key={row.key} className={`card p-3 ${row.include ? '' : 'opacity-50'}`}>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={row.include}
                    onChange={(e) =>
                      setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, include: e.target.checked } : r)))
                    }
                  />
                  <span className="flex-1 font-medium">{row.name}</span>
                  <span className="font-semibold">
                    {fmt(row.amount)}
                    {row.isTransfer && <span className="text-xs text-sky-600"> (T)</span>}
                  </span>
                </div>
                <div className="mt-2 flex gap-2">
                  <select
                    className="input py-1.5 text-sm"
                    value={row.sectionId}
                    onChange={(e) => setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, sectionId: e.target.value } : r)))}
                  >
                    <option value="">Pick section…</option>
                    {ownedSections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input py-1.5 text-sm"
                    value={row.categoryId}
                    onChange={(e) => setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, categoryId: e.target.value } : r)))}
                  >
                    {settings.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                {row.paid && <div className="mt-1 text-xs text-emerald-600">Marked paid</div>}
              </div>
            ))}
          </div>

          {rows.length > 0 && (
            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={importable === 0} onClick={runImport}>
                Import {importable} into {monthLabel(monthId)}
              </button>
              <button className="btn-secondary" onClick={() => setRows(null)}>
                Cancel
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
