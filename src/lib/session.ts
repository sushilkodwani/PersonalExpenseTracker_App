// Tracks whether the app-open PIN has been entered for this browser session,
// so navigating around doesn't re-prompt but a fresh launch does.
const SESSION_KEY = 'et.unlocked'

export function isSessionUnlocked(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === '1'
}

export function markSessionUnlocked(): void {
  sessionStorage.setItem(SESSION_KEY, '1')
}

export function clearSessionUnlock(): void {
  sessionStorage.removeItem(SESSION_KEY)
}
