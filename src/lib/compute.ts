import type { ExpenseItem, Month, Person, PersonMonth, SectionInstance } from '../types'
import { PEOPLE } from '../types'

/** Real spend of a section — excludes pass-through/transfer amounts. */
export function sectionSpend(section: SectionInstance): number {
  return section.items.filter((i) => !i.isTransfer).reduce((sum, i) => sum + i.amount, 0)
}

/** Pass-through amount of a section (shown separately, never counted as spend). */
export function sectionTransfers(section: SectionInstance): number {
  return section.items.filter((i) => i.isTransfer).reduce((sum, i) => sum + i.amount, 0)
}

export function sectionFullyPaid(section: SectionInstance): boolean {
  return section.items.length > 0 && section.items.every((i) => i.paid)
}

export function personSpend(pm: PersonMonth): number {
  return pm.sections.reduce((sum, s) => sum + sectionSpend(s), 0)
}

/** Remaining salary = the month's computed savings. */
export function personRemaining(pm: PersonMonth): number {
  return pm.salary - personSpend(pm)
}

export function monthSpend(month: Month): number {
  return personSpend(month.people.sush) + personSpend(month.people.khush)
}

export function monthSalary(month: Month): number {
  return month.people.sush.salary + month.people.khush.salary
}

/** Items that should carry into the next month: flagged and still unpaid. */
export function carryItems(pm: PersonMonth): { sectionId: string; item: ExpenseItem }[] {
  return pm.sections.flatMap((s) =>
    s.items.filter((i) => i.carryToNextMonth && !i.paid).map((item) => ({ sectionId: s.sectionId, item })),
  )
}

export interface WalkedItem {
  person: Person
  sectionId: string
  item: ExpenseItem
}

/** Every expense in a month, flattened — the basis for search, totals and exports. */
export function walkItems(month: Month): WalkedItem[] {
  const out: WalkedItem[] = []
  for (const person of PEOPLE) {
    for (const section of month.people[person].sections) {
      for (const item of section.items) out.push({ person, sectionId: section.sectionId, item })
    }
  }
  return out
}

/** Spend per category id for a month, excluding pass-through amounts. */
export function categoryTotals(month: Month): Map<string, number> {
  const totals = new Map<string, number>()
  for (const { item } of walkItems(month)) {
    if (item.isTransfer) continue
    totals.set(item.categoryId, (totals.get(item.categoryId) ?? 0) + item.amount)
  }
  return totals
}

/** Percentage change from `previous` to `current`; null when there is no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

/** Financial year of a month id, Apr–Mar. "2026-07" → "2026-27". */
export function financialYearOf(monthId: string): string {
  const [y, m] = monthId.split('-').map(Number)
  const startYear = m >= 4 ? y : y - 1
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`
}

/** All 12 month ids of a financial year label like "2026-27". */
export function monthsOfFinancialYear(fy: string): string[] {
  const startYear = Number(fy.split('-')[0])
  const ids: string[] = []
  for (let i = 0; i < 12; i++) {
    const m = ((3 + i) % 12) + 1 // Apr=4 ... Mar=3
    const y = m >= 4 ? startYear : startYear + 1
    ids.push(`${y}-${String(m).padStart(2, '0')}`)
  }
  return ids
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function monthLabel(monthId: string): string {
  const [y, m] = monthId.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

export function monthShortLabel(monthId: string): string {
  const [, m] = monthId.split('-').map(Number)
  return MONTH_NAMES[m - 1]
}

export function nextMonthId(monthId: string): string {
  const [y, m] = monthId.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

export function prevMonthId(monthId: string): string {
  const [y, m] = monthId.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

export function currentMonthId(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export function fmt(n: number): string {
  return `₹${inr.format(n)}`
}
