// Local-calendar date helpers. Dates are 'YYYY-MM-DD' in the device's own time
// zone — never derived from toISOString(), which is UTC and gives yesterday's
// date before 05:30 in India.

const pad = (n: number) => String(n).padStart(2, '0')

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return toISO(new Date())
}

export function addDays(iso: string, days: number): string {
  const d = fromISO(iso)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

/** Whole days from `from` to `to` (negative when `to` is earlier). DST-safe. */
export function daysBetween(from: string, to: string): number {
  const a = fromISO(from)
  const b = fromISO(to)
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86_400_000)
}

/** Days before the access token's expiry from which reminders show. */
export const TOKEN_WARN_DAYS = 14

/** "Expires in 12 days" / "Expires today" / "Expired 3 days ago" for a stored expiry date. */
export function tokenExpiryStatus(expiresOn: string): { days: number; text: string } {
  const days = daysBetween(todayISO(), expiresOn)
  const text =
    days < 0
      ? `Expired ${-days} day${days === -1 ? '' : 's'} ago`
      : days === 0
        ? 'Expires today'
        : `Expires in ${days} day${days === 1 ? '' : 's'}`
  return { days, text }
}

export function formatDate(iso: string): string {
  return fromISO(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
