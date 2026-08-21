import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  categoryTotals,
  financialYearOf,
  fmt,
  monthLabel,
  monthSalary,
  monthShortLabel,
  monthSpend,
  monthsOfFinancialYear,
  percentChange,
  personSpend,
  prevMonthId,
  sectionSpend,
  walkItems,
} from '../lib/compute'
import { useApp } from '../store/AppContext'
import { useTheme } from '../store/ThemeContext'
import type { Month, Person, SectionType, Settings } from '../types'
import { PEOPLE, PERSON_LABELS, SECTION_TYPE_LABELS } from '../types'

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16', '#06b6d4', '#a855f7']

type ChartsTab = 'month' | 'year' | 'all' | 'range'

function useAxisStyle() {
  const { isDark } = useTheme()
  return {
    tick: { fontSize: 12, fill: isDark ? '#94a3b8' : '#475569' },
    grid: isDark ? '#1e293b' : '#e2e8f0',
    tooltip: isDark
      ? { backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }
      : undefined,
  }
}

export function ChartsScreen({ monthId }: { monthId: string | null }) {
  const { settings, monthIds, months, loadMonth, loadAllMonths } = useApp()
  const [tab, setTab] = useState<ChartsTab>('month')
  const sortedIds = useMemo(() => [...monthIds].sort(), [monthIds])

  const [selectedMonthId, setSelectedMonthId] = useState<string | null>(monthId)
  useEffect(() => {
    if (!selectedMonthId && monthId) setSelectedMonthId(monthId)
  }, [monthId, selectedMonthId])

  const allFYs = useMemo(() => [...new Set(sortedIds.map(financialYearOf))].sort(), [sortedIds])
  const [selectedFY, setSelectedFY] = useState<string | null>(null)
  useEffect(() => {
    if (!selectedFY && allFYs.length > 0) setSelectedFY(allFYs.at(-1)!)
  }, [allFYs, selectedFY])

  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  useEffect(() => {
    if (sortedIds.length && !rangeFrom) setRangeFrom(sortedIds[0])
    if (sortedIds.length && !rangeTo) setRangeTo(sortedIds.at(-1)!)
  }, [sortedIds, rangeFrom, rangeTo])

  const fyMonthIds = useMemo(
    () => (selectedFY ? monthsOfFinancialYear(selectedFY).filter((id) => monthIds.includes(id)) : []),
    [selectedFY, monthIds],
  )

  const rangeMonthIds = useMemo(
    () => sortedIds.filter((id) => (!rangeFrom || id >= rangeFrom) && (!rangeTo || id <= rangeTo)),
    [sortedIds, rangeFrom, rangeTo],
  )

  useEffect(() => {
    if (tab === 'month' && selectedMonthId) {
      void loadMonth(selectedMonthId)
      // Previous month powers the month-over-month comparison.
      void loadMonth(prevMonthId(selectedMonthId))
    } else {
      void loadAllMonths()
    }
  }, [tab, selectedMonthId, loadMonth, loadAllMonths])

  if (!settings || monthIds.length === 0) {
    return <p className="p-8 text-center text-sm muted">Create a month first to see charts.</p>
  }

  const month = selectedMonthId ? months[selectedMonthId] : null

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <div className="flex gap-1.5">
        {(
          [
            ['month', 'Month'],
            ['year', 'Year'],
            ['all', 'All Time'],
            ['range', 'Range'],
          ] as [ChartsTab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            className={`flex-1 rounded-full py-2 text-xs font-semibold ${
              tab === t ? 'bg-indigo-600 text-white' : 'surface text-slate-600 dark:text-slate-300'
            }`}
            onClick={() => setTab(t)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'month' && (
        <>
          <select className="input" value={selectedMonthId ?? ''} onChange={(e) => setSelectedMonthId(e.target.value)}>
            {[...sortedIds].reverse().map((id) => (
              <option key={id} value={id}>
                {monthLabel(id)}
              </option>
            ))}
          </select>
          {month ? (
            <MonthCharts month={month} previous={months[prevMonthId(month.id)] ?? null} settings={settings} />
          ) : (
            <p className="p-8 text-center text-sm muted">Loading…</p>
          )}
        </>
      )}

      {tab === 'year' && (
        <>
          <select className="input" value={selectedFY ?? ''} onChange={(e) => setSelectedFY(e.target.value)}>
            {allFYs.map((fy) => (
              <option key={fy} value={fy}>
                FY {fy}
              </option>
            ))}
          </select>
          <AggregateCharts
            title={`FY ${selectedFY}`}
            monthIds={fyMonthIds}
            months={months}
            settings={settings}
            goal={settings.savingsGoalPerYear}
          />
        </>
      )}

      {tab === 'all' && (
        <AggregateCharts title="all time" monthIds={sortedIds} months={months} settings={settings} showBiggest />
      )}

      {tab === 'range' && (
        <>
          <div className="flex gap-2">
            <select className="input" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)}>
              {sortedIds.map((id) => (
                <option key={id} value={id}>
                  From {monthLabel(id)}
                </option>
              ))}
            </select>
            <select className="input" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)}>
              {sortedIds.map((id) => (
                <option key={id} value={id}>
                  To {monthLabel(id)}
                </option>
              ))}
            </select>
          </div>
          <AggregateCharts
            title={`${monthLabel(rangeFrom || sortedIds[0])} – ${monthLabel(rangeTo || sortedIds.at(-1)!)}`}
            monthIds={rangeMonthIds}
            months={months}
            settings={settings}
            showBiggest
          />
        </>
      )}
    </div>
  )
}

function MonthCharts({ month, previous, settings }: { month: Month; previous: Month | null; settings: Settings }) {
  const axis = useAxisStyle()

  const byCategory = new Map<string, number>()
  const bySection = new Map<string, number>()
  let paidTotal = 0
  let unpaidTotal = 0
  for (const person of PEOPLE) {
    for (const s of month.people[person].sections) {
      const spend = sectionSpend(s)
      if (spend > 0) {
        const name = settings.sections.find((d) => d.id === s.sectionId)?.name ?? '(deleted)'
        bySection.set(name, (bySection.get(name) ?? 0) + spend)
      }
      for (const i of s.items) {
        if (i.isTransfer) continue
        const name = settings.categories.find((c) => c.id === i.categoryId)?.name ?? '(deleted)'
        byCategory.set(name, (byCategory.get(name) ?? 0) + i.amount)
        if (i.paid) paidTotal += i.amount
        else unpaidTotal += i.amount
      }
    }
  }
  const categoryData = [...byCategory.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  const sectionData = [...bySection.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  const paidVsUnpaid = [
    { name: 'Paid', value: paidTotal },
    { name: 'Pending', value: unpaidTotal },
  ].filter((d) => d.value > 0)

  const peopleData = PEOPLE.map((p) => {
    const spend = personSpend(month.people[p])
    return {
      name: PERSON_LABELS[p],
      Spent: spend,
      Saved: Math.max(0, month.people[p].salary - spend),
    }
  })

  const salary = monthSalary(month)
  const spend = monthSpend(month)
  const saveRate = salary > 0 ? Math.round(((salary - spend) / salary) * 100) : 0

  // Month-over-month movement per category.
  const current = categoryTotals(month)
  const prior = previous ? categoryTotals(previous) : null
  const momRows = prior
    ? [...new Set([...current.keys(), ...prior.keys()])]
        .map((categoryId) => {
          const now = current.get(categoryId) ?? 0
          const before = prior.get(categoryId) ?? 0
          return {
            name: settings.categories.find((c) => c.id === categoryId)?.name ?? '(deleted)',
            now,
            before,
            change: percentChange(now, before),
          }
        })
        .filter((r) => r.now > 0 || r.before > 0)
        .sort((a, b) => b.now - a.now)
    : []

  // Budget usage for the categories that have a limit.
  const budgets = settings.budgets ?? {}
  const budgetData = Object.entries(budgets)
    .filter(([, limit]) => limit > 0)
    .map(([categoryId, limit]) => ({
      name: settings.categories.find((c) => c.id === categoryId)?.name ?? '(deleted)',
      Spent: current.get(categoryId) ?? 0,
      Budget: limit,
    }))
    .sort((a, b) => b.Spent / b.Budget - a.Spent / a.Budget)

  return (
    <>
      <div className="card p-4 text-center">
        <div className="text-xs muted">Household save rate</div>
        <div className={`text-3xl font-bold ${saveRate >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{saveRate}%</div>
        <div className="mt-1 text-xs muted">
          {fmt(salary - spend)} saved of {fmt(salary)} salary
        </div>
        {previous && (
          <div className="mt-2 text-xs muted">
            Spending {spendDeltaLabel(spend, monthSpend(previous))} vs {monthLabel(previous.id)}
          </div>
        )}
      </div>

      {budgetData.length > 0 && (
        <ChartCard title="Budget vs actual">
          <ResponsiveContainer width="100%" height={Math.max(180, budgetData.length * 44)}>
            <BarChart data={budgetData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={100} tick={axis.tick} />
              <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={axis.tooltip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Budget" fill="#cbd5e1" radius={[0, 6, 6, 0]} />
              <Bar dataKey="Spent" radius={[0, 6, 6, 0]}>
                {budgetData.map((d, i) => (
                  <Cell key={i} fill={d.Spent > d.Budget ? '#ef4444' : '#10b981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {categoryData.length > 0 && (
        <ChartCard title="Spend by category">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={axis.tooltip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {sectionData.length > 0 && (
        <ChartCard title="Spend by section">
          <ResponsiveContainer width="100%" height={Math.max(200, sectionData.length * 36)}>
            <BarChart data={sectionData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={110} tick={axis.tick} />
              <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={axis.tooltip} />
              <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {momRows.length > 0 && (
        <ChartCard title={`vs ${monthLabel(previous!.id)}`}>
          <div className="flex flex-col divide-y divider">
            {momRows.map((r) => (
              <div key={r.name} className="flex items-center justify-between py-2 text-sm">
                <span>{r.name}</span>
                <span className="flex items-center gap-3">
                  <span className="muted">{fmt(r.now)}</span>
                  <span
                    className={`w-16 text-right font-medium ${
                      r.change === null ? 'muted' : r.change > 0 ? 'text-red-600' : r.change < 0 ? 'text-emerald-600' : 'muted'
                    }`}
                  >
                    {r.change === null ? 'new' : `${r.change > 0 ? '+' : ''}${Math.round(r.change)}%`}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {paidVsUnpaid.length > 0 && (
        <ChartCard title="Paid vs pending">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={paidVsUnpaid} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={70} tick={axis.tick} />
              <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={axis.tooltip} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {paidVsUnpaid.map((d, i) => (
                  <Cell key={i} fill={d.name === 'Paid' ? '#10b981' : '#f59e0b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <ChartCard title="Sush vs Khush">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={peopleData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={axis.grid} />
            <XAxis dataKey="name" tick={axis.tick} />
            <YAxis tick={axis.tick} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
            <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={axis.tooltip} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Spent" fill="#f43f5e" radius={[6, 6, 0, 0]} />
            <Bar dataKey="Saved" fill="#10b981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  )
}

function spendDeltaLabel(now: number, before: number): string {
  const change = percentChange(now, before)
  if (change === null) return 'unchanged'
  const rounded = Math.round(change)
  if (rounded === 0) return 'flat'
  return rounded > 0 ? `up ${rounded}%` : `down ${Math.abs(rounded)}%`
}

/** Shared multi-month view used by the Year, All Time and Range tabs. */
function AggregateCharts({
  title,
  monthIds,
  months,
  settings,
  goal,
  showBiggest,
}: {
  title: string
  monthIds: string[]
  months: Record<string, Month>
  settings: Settings
  goal?: number
  showBiggest?: boolean
}) {
  const axis = useAxisStyle()
  const loaded = monthIds.filter((id) => months[id])

  if (loaded.length === 0) {
    return <p className="p-8 text-center text-sm muted">No months with data in this period yet.</p>
  }

  const trend = loaded.map((id) => {
    const m = months[id]
    const salary = monthSalary(m)
    const spend = monthSpend(m)
    return { name: `${monthShortLabel(id)} ${id.slice(2, 4)}`, Salary: salary, Spent: spend, Saved: salary - spend }
  })

  const byCategory = new Map<string, number>()
  const bySectionType = new Map<SectionType, number>()
  const byPerson: Record<Person, { spend: number; salary: number }> = {
    sush: { spend: 0, salary: 0 },
    khush: { spend: 0, salary: 0 },
  }
  const allExpenses: { name: string; amount: number; monthId: string; person: Person }[] = []

  for (const id of loaded) {
    const m = months[id]
    for (const person of PEOPLE) {
      byPerson[person].salary += m.people[person].salary
      byPerson[person].spend += personSpend(m.people[person])
      for (const s of m.people[person].sections) {
        const spend = sectionSpend(s)
        if (spend > 0) {
          const type = settings.sections.find((d) => d.id === s.sectionId)?.type ?? 'extras'
          bySectionType.set(type, (bySectionType.get(type) ?? 0) + spend)
        }
      }
    }
    for (const { item, person } of walkItems(m)) {
      if (item.isTransfer) continue
      const catName = settings.categories.find((c) => c.id === item.categoryId)?.name ?? '(deleted)'
      byCategory.set(catName, (byCategory.get(catName) ?? 0) + item.amount)
      allExpenses.push({ name: item.name, amount: item.amount, monthId: id, person })
    }
  }

  const categoryData = [...byCategory.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  const sectionTypeData = [...bySectionType.entries()]
    .map(([type, value]) => ({ name: SECTION_TYPE_LABELS[type], value }))
    .sort((a, b) => b.value - a.value)
  const peopleData = PEOPLE.map((p) => ({
    name: PERSON_LABELS[p],
    Spent: byPerson[p].spend,
    Saved: Math.max(0, byPerson[p].salary - byPerson[p].spend),
  }))
  const top10 = [...allExpenses].sort((a, b) => b.amount - a.amount).slice(0, 10)

  const totalSalary = trend.reduce((s, t) => s + t.Salary, 0)
  const totalSaved = totalSalary - trend.reduce((s, t) => s + t.Spent, 0)
  const goalPct = goal && goal > 0 ? Math.max(0, Math.min(100, (totalSaved / goal) * 100)) : null

  return (
    <>
      <div className="card p-4 text-center">
        <div className="text-xs muted">Saved {title}</div>
        <div className={`text-3xl font-bold ${totalSaved >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(totalSaved)}</div>
        <div className="mt-1 text-xs muted">
          of {fmt(totalSalary)} total salary · {loaded.length} month{loaded.length === 1 ? '' : 's'}
        </div>
        {goalPct !== null && (
          <div className="mt-3">
            <div className="flex justify-between text-xs muted">
              <span>Savings goal</span>
              <span>
                {Math.round(goalPct)}% of {fmt(goal!)}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full bg-emerald-500" style={{ width: `${goalPct}%` }} />
            </div>
          </div>
        )}
      </div>

      <ChartCard title="Salary vs spend vs savings">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={axis.grid} />
            <XAxis dataKey="name" tick={{ ...axis.tick, fontSize: 11 }} />
            <YAxis tick={{ ...axis.tick, fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
            <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={axis.tooltip} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="Salary" stroke="#6366f1" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Spent" stroke="#f43f5e" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Saved" stroke="#10b981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {categoryData.length > 0 && (
        <ChartCard title="Category totals">
          <ResponsiveContainer width="100%" height={Math.max(200, categoryData.length * 32)}>
            <BarChart data={categoryData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={110} tick={axis.tick} />
              <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={axis.tooltip} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {sectionTypeData.length > 0 && (
        <ChartCard title="Spend by section type">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={sectionTypeData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                {sectionTypeData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={axis.tooltip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <ChartCard title="Sush vs Khush">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={peopleData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={axis.grid} />
            <XAxis dataKey="name" tick={axis.tick} />
            <YAxis tick={{ ...axis.tick, fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
            <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={axis.tooltip} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Spent" fill="#f43f5e" radius={[6, 6, 0, 0]} />
            <Bar dataKey="Saved" fill="#10b981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {showBiggest && top10.length > 0 && (
        <ChartCard title="Biggest expenses">
          <div className="flex flex-col divide-y divider">
            {top10.map((e, i) => (
              <div key={i} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-medium">{e.name}</div>
                  <div className="text-xs muted">
                    {monthLabel(e.monthId)} · {PERSON_LABELS[e.person]}
                  </div>
                </div>
                <div className="font-semibold">{fmt(e.amount)}</div>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <h3 className="mb-2 font-semibold">{title}</h3>
      {children}
    </div>
  )
}
