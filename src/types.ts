export type Person = 'sush' | 'khush'
export type SectionOwner = Person | 'shared'
export type SectionType = 'fixed' | 'bank' | 'credit_card' | 'extras'

export interface SectionDef {
  id: string
  name: string
  owner: SectionOwner
  type: SectionType
  defaultInTemplate: boolean
}

export interface Category {
  id: string
  name: string
}

/** A fixed expense that repeats every month (rent, EMI, maid) and is seeded into new months. */
export interface RecurringItem {
  id: string
  name: string
  amount: number
  categoryId: string
  sectionId: string
  person: Person
  active: boolean
}

export interface Settings {
  sections: SectionDef[]
  categories: Category[]
  // Fields below were added after the first release, so they are optional on
  // disk and normalized on load — existing settings.json files stay valid.
  recurring?: RecurringItem[]
  /** Monthly spend limit per category id. */
  budgets?: Record<string, number>
  /** Household savings target for a financial year. */
  savingsGoalPerYear?: number
  /** Soft app-open lock. Not a security boundary — single-user app. */
  appPin?: string
  /** Password required to unlock a finalized month for editing. */
  monthLockPassword?: string
}

export interface ExpenseItem {
  id: string
  name: string
  amount: number
  categoryId: string
  paid: boolean
  isTransfer: boolean
  carryToNextMonth: boolean
}

export interface SectionInstance {
  sectionId: string
  items: ExpenseItem[]
}

export interface PersonMonth {
  salary: number
  sections: SectionInstance[]
}

export interface Month {
  id: string // YYYY-MM
  people: Record<Person, PersonMonth>
  locked?: boolean
}

/** Someone outside the household you either owe money to or are owed by. */
export interface LedgerContact {
  id: string
  name: string
}

export interface LedgerEntry {
  id: string
  contactId: string
  /** 'give' = money you owe them (shown green). 'take' = money they owe you (shown red). */
  type: 'give' | 'take'
  amount: number
  note?: string
  date: string // YYYY-MM-DD
}

export interface Ledger {
  contacts: LedgerContact[]
  entries: LedgerEntry[]
}

export const PEOPLE: Person[] = ['sush', 'khush']

export const PERSON_LABELS: Record<Person, string> = {
  sush: 'Sush',
  khush: 'Khush',
}

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  fixed: 'Fixed',
  bank: 'Bank',
  credit_card: 'Credit Card',
  extras: 'Extras',
}
