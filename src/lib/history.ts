import type { Month, Person } from '../types'
import { PEOPLE } from '../types'

export interface NameStat {
  name: string
  count: number
  /** Most recently used amount for this name — used to prefill quick-add. */
  lastAmount: number
  /** Most frequently paired category id. */
  categoryId: string
  /** Most frequently used section id, so pickers can fill that in too. */
  sectionId: string
  /** Whose salary this name is usually paid from. */
  person: Person
  lastUsedMonthId: string
}

export interface CollectOptions {
  sectionId?: string
  person?: Person
  excludeItemId?: string
}

function topKey<T>(counts: Map<T, number>): T | undefined {
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

/**
 * Roll up every expense name ever recorded, so the app can suggest names,
 * prefill amounts and guess categories/sections from real history.
 * `monthIds` is expected sorted ascending so "last used" wins correctly.
 */
export function collectNameStats(
  monthIds: string[],
  months: Record<string, Month>,
  opts: CollectOptions = {},
): NameStat[] {
  const acc = new Map<
    string,
    {
      count: number
      lastAmount: number
      lastUsedMonthId: string
      categories: Map<string, number>
      sections: Map<string, number>
      people: Map<Person, number>
    }
  >()

  for (const monthId of [...monthIds].sort()) {
    const month = months[monthId]
    if (!month) continue
    for (const person of PEOPLE) {
      if (opts.person && person !== opts.person) continue
      for (const section of month.people[person].sections) {
        if (opts.sectionId && section.sectionId !== opts.sectionId) continue
        for (const item of section.items) {
          const name = item.name.trim()
          if (!name || item.id === opts.excludeItemId) continue
          const entry = acc.get(name) ?? {
            count: 0,
            lastAmount: item.amount,
            lastUsedMonthId: monthId,
            categories: new Map<string, number>(),
            sections: new Map<string, number>(),
            people: new Map<Person, number>(),
          }
          entry.count++
          entry.lastAmount = item.amount
          entry.lastUsedMonthId = monthId
          entry.categories.set(item.categoryId, (entry.categories.get(item.categoryId) ?? 0) + 1)
          entry.sections.set(section.sectionId, (entry.sections.get(section.sectionId) ?? 0) + 1)
          entry.people.set(person, (entry.people.get(person) ?? 0) + 1)
          acc.set(name, entry)
        }
      }
    }
  }

  return [...acc.entries()]
    .map(([name, e]) => ({
      name,
      count: e.count,
      lastAmount: e.lastAmount,
      lastUsedMonthId: e.lastUsedMonthId,
      categoryId: topKey(e.categories) ?? '',
      sectionId: topKey(e.sections) ?? '',
      person: topKey(e.people) ?? 'sush',
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** Best-guess category for a name, based on what it was filed under before. */
export function guessCategoryId(name: string, stats: NameStat[]): string | undefined {
  const q = name.trim().toLowerCase()
  if (!q) return undefined
  return (stats.find((s) => s.name.toLowerCase() === q) ?? stats.find((s) => s.name.toLowerCase().includes(q)))?.categoryId
}

/** Names matching what's been typed so far, most-used first. */
export function matchNames(query: string, stats: NameStat[], limit = 6): NameStat[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return stats.filter((s) => s.name.toLowerCase().includes(q) && s.name.toLowerCase() !== q).slice(0, limit)
}
