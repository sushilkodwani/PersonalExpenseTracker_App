import { useEffect, useMemo, useState } from 'react'
import { fmt, monthLabel, walkItems } from '../lib/compute'
import { useApp } from '../store/AppContext'
import type { Person } from '../types'
import { PERSON_LABELS } from '../types'

type PaidFilter = 'all' | 'paid' | 'unpaid'

export function SearchScreen({ onOpenMonth }: { onOpenMonth: (monthId: string) => void }) {
  const { settings, monthIds, months, loadAllMonths } = useApp()
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [person, setPerson] = useState<Person | ''>('')
  const [paid, setPaid] = useState<PaidFilter>('all')
  const [fromMonth, setFromMonth] = useState('')
  const [toMonth, setToMonth] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    void loadAllMonths()
  }, [loadAllMonths])

  const sorted = useMemo(() => [...monthIds].sort().reverse(), [monthIds])

  const results = useMemo(() => {
    if (!settings) return []
    const q = query.trim().toLowerCase()
    const out: {
      monthId: string
      person: Person
      sectionId: string
      name: string
      amount: number
      categoryId: string
      paid: boolean
      isTransfer: boolean
      id: string
    }[] = []

    for (const monthId of sorted) {
      if (fromMonth && monthId < fromMonth) continue
      if (toMonth && monthId > toMonth) continue
      const month = months[monthId]
      if (!month) continue
      for (const walked of walkItems(month)) {
        const { item } = walked
        if (q && !item.name.toLowerCase().includes(q)) continue
        if (categoryId && item.categoryId !== categoryId) continue
        if (sectionId && walked.sectionId !== sectionId) continue
        if (person && walked.person !== person) continue
        if (paid === 'paid' && !item.paid) continue
        if (paid === 'unpaid' && item.paid) continue
        out.push({
          monthId,
          person: walked.person,
          sectionId: walked.sectionId,
          name: item.name,
          amount: item.amount,
          categoryId: item.categoryId,
          paid: item.paid,
          isTransfer: item.isTransfer,
          id: item.id,
        })
      }
    }
    return out
  }, [settings, sorted, months, query, categoryId, sectionId, person, paid, fromMonth, toMonth])

  if (!settings) return null

  const sectionName = (id: string) => settings.sections.find((s) => s.id === id)?.name ?? '(deleted)'
  const categoryName = (id: string) => settings.categories.find((c) => c.id === id)?.name ?? '(deleted)'

  const total = results.filter((r) => !r.isTransfer).reduce((sum, r) => sum + r.amount, 0)
  const hasFilters = categoryId || sectionId || person || paid !== 'all' || fromMonth || toMonth

  return (
    <div className="flex flex-col gap-3 p-4 pb-24">
      <input
        className="input"
        placeholder="Search every expense…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />

      <button
        className="self-start text-sm font-medium text-indigo-600"
        onClick={() => setShowFilters((s) => !s)}
      >
        {showFilters ? 'Hide filters' : 'Filters'}
        {hasFilters && !showFilters && ' · on'}
      </button>

      {showFilters && (
        <div className="card flex flex-col gap-2 p-3">
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Any category</option>
            {settings.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="input" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">Any section</option>
            {settings.sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.owner})
              </option>
            ))}
          </select>
          <select className="input" value={person} onChange={(e) => setPerson(e.target.value as Person | '')}>
            <option value="">Both people</option>
            <option value="sush">{PERSON_LABELS.sush}</option>
            <option value="khush">{PERSON_LABELS.khush}</option>
          </select>
          <select className="input" value={paid} onChange={(e) => setPaid(e.target.value as PaidFilter)}>
            <option value="all">Paid and pending</option>
            <option value="paid">Paid only</option>
            <option value="unpaid">Pending only</option>
          </select>
          <div className="flex gap-2">
            <select className="input" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)}>
              <option value="">From: earliest</option>
              {[...sorted].reverse().map((id) => (
                <option key={id} value={id}>
                  From {monthLabel(id)}
                </option>
              ))}
            </select>
            <select className="input" value={toMonth} onChange={(e) => setToMonth(e.target.value)}>
              <option value="">To: latest</option>
              {sorted.map((id) => (
                <option key={id} value={id}>
                  To {monthLabel(id)}
                </option>
              ))}
            </select>
          </div>
          {hasFilters && (
            <button
              className="text-sm text-red-500"
              onClick={() => {
                setCategoryId('')
                setSectionId('')
                setPerson('')
                setPaid('all')
                setFromMonth('')
                setToMonth('')
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between px-1 text-sm">
        <span className="muted">
          {results.length} {results.length === 1 ? 'result' : 'results'}
        </span>
        <span className="font-semibold">{fmt(total)}</span>
      </div>

      <div className="card divide-y divider">
        {results.length === 0 ? (
          <p className="p-6 text-center text-sm muted">
            {query || hasFilters ? 'Nothing matches.' : 'Start typing to search across every month.'}
          </p>
        ) : (
          results.slice(0, 300).map((r) => (
            <button
              key={`${r.monthId}-${r.id}`}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left active:bg-slate-50 dark:active:bg-slate-800"
              onClick={() => onOpenMonth(r.monthId)}
            >
              <div className="min-w-0">
                <div className={`truncate ${r.paid ? '' : 'font-medium'}`}>{r.name}</div>
                <div className="truncate text-xs muted">
                  {monthLabel(r.monthId)} · {PERSON_LABELS[r.person]} · {sectionName(r.sectionId)} ·{' '}
                  {categoryName(r.categoryId)}
                  {!r.paid && ' · pending'}
                </div>
              </div>
              <div className={`ml-3 shrink-0 font-medium ${r.isTransfer ? 'text-sky-600' : ''}`}>
                {fmt(r.amount)}
                {r.isTransfer && <span className="text-xs"> (T)</span>}
              </div>
            </button>
          ))
        )}
      </div>
      {results.length > 300 && (
        <p className="text-center text-xs muted">Showing the first 300 — narrow the search to see more.</p>
      )}
    </div>
  )
}
