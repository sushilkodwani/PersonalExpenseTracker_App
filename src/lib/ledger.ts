import type { Ledger, LedgerEntry } from '../types'

export function entriesFor(ledger: Ledger, contactId: string): LedgerEntry[] {
  return ledger.entries.filter((e) => e.contactId === contactId).sort((a, b) => b.date.localeCompare(a.date))
}

/** Net balance with one contact. Positive = they owe you. Negative = you owe them. */
export function balanceFor(ledger: Ledger, contactId: string): number {
  return entriesFor(ledger, contactId).reduce((sum, e) => sum + (e.type === 'take' ? e.amount : -e.amount), 0)
}

export function totalOwedToYou(ledger: Ledger): number {
  return ledger.contacts.reduce((sum, c) => sum + Math.max(0, balanceFor(ledger, c.id)), 0)
}

export function totalYouOwe(ledger: Ledger): number {
  return ledger.contacts.reduce((sum, c) => sum + Math.max(0, -balanceFor(ledger, c.id)), 0)
}

export const emptyLedger = (): Ledger => ({ contacts: [], entries: [] })

/** Every note used before, most-used first — so the same note is spelled the same way everywhere. */
export function collectNoteSuggestions(ledger: Ledger): string[] {
  const counts = new Map<string, number>()
  for (const e of ledger.entries) {
    const note = e.note?.trim()
    if (!note) continue
    counts.set(note, (counts.get(note) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([note]) => note)
}
