import type { Settings } from '../types'
import { uuid } from './uuid'

/**
 * Seed value for the month-unlock password, written into the data store on
 * first load. It lives in the store from then on and is changed in Settings —
 * this constant is only the one-time starting point for existing data.
 */
const INITIAL_MONTH_LOCK_PASSWORD = '435120'

// Seeded on first run from the user's existing Apple Notes structure.
// Everything here is editable in Settings afterwards.
export function defaultSettings(): Settings {
  const s = (name: string, owner: Settings['sections'][0]['owner'], type: Settings['sections'][0]['type'], defaultInTemplate = true) => ({
    id: uuid(),
    name,
    owner,
    type,
    defaultInTemplate,
  })
  const c = (name: string) => ({ id: uuid(), name })
  return {
    sections: [
      s('Fixed Expenses', 'sush', 'fixed'),
      s('Sush SBI', 'sush', 'bank'),
      s('Khush HDFC', 'sush', 'bank'),
      s('Aarchi HDFC', 'sush', 'bank'),
      s('Khush Extras', 'sush', 'extras'),
      s('Axis CC', 'sush', 'credit_card'),
      s('ICICI CC', 'sush', 'credit_card'),
      s('Kotak CC', 'sush', 'credit_card'),
      s('Amex CC', 'sush', 'credit_card'),
      s('HDFC CC', 'sush', 'credit_card'),
      s('Extras', 'sush', 'extras'),
      s('Fixed Expenses', 'khush', 'fixed'),
      s('Home EMI', 'khush', 'fixed'),
      s('Extras', 'khush', 'extras'),
    ],
    categories: [
      c('Food'),
      c('Groceries'),
      c('Shopping'),
      c('Fuel'),
      c('Travel'),
      c('Recharge'),
      c('Subscriptions'),
      c('Utilities'),
      c('Rent'),
      c('EMI'),
      c('Medical'),
      c('Kids'),
      c('Family'),
      c('Party / Social'),
      c('Electronics'),
      c('Insurance'),
      c('Other'),
    ],
    recurring: [],
    budgets: {},
    monthLockPassword: INITIAL_MONTH_LOCK_PASSWORD,
  }
}

/**
 * Settings files written before recurring items / budgets / the month-lock
 * password existed are still valid on disk; fill in the gaps so the rest of the
 * app can assume the fields are present. Existing data keeps the password it
 * was already using.
 */
export function normalizeSettings(loaded: Settings): Settings {
  return {
    ...loaded,
    recurring: loaded.recurring ?? [],
    budgets: loaded.budgets ?? {},
    monthLockPassword: loaded.monthLockPassword ?? INITIAL_MONTH_LOCK_PASSWORD,
    userAccess: loaded.userAccess ?? [],
  }
}
