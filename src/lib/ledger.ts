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
