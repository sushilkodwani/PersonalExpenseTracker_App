import type { Settings, UserAccessRole } from '../types'

/** The one account that always has full access, regardless of what's in settings.json. */
export const ADMIN_EMAIL = 'sushilkodwani15@gmail.com'

export type AccessRole = 'admin' | UserAccessRole | 'denied'

/**
 * Resolves what an email can do against the current settings. Re-run this on
 * every app load (not cached) so a permission change by the admin takes effect
 * the next time the other person opens the app.
 */
export function resolveRole(email: string, settings: Pick<Settings, 'userAccess'> | null | undefined): AccessRole {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return 'denied'
  if (normalized === ADMIN_EMAIL) return 'admin'
  const entry = settings?.userAccess?.find((u) => u.email.trim().toLowerCase() === normalized)
  return entry?.role ?? 'denied'
}

// The signed-in email persists per device so it isn't re-entered on every
// launch — only the role resolved from it is re-checked each time.
const EMAIL_KEY = 'et.userEmail'

export function getSavedEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY)
}

export function saveEmail(email: string): void {
  localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase())
}

export function clearSavedEmail(): void {
  localStorage.removeItem(EMAIL_KEY)
}
