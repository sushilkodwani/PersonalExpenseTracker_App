import { useApp } from '../store/AppContext'

export function AccessDeniedScreen() {
  const { currentUserEmail, disconnect } = useApp()

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-5xl">🚫</div>
      <h1 className="text-xl font-bold">Access denied</h1>
      <p className="text-sm muted">
        {currentUserEmail ?? 'This email'} hasn't been granted access to this data. Ask the admin to add you in
        Settings → Access control.
      </p>
      <button className="btn-secondary" onClick={disconnect}>
        Use a different account
      </button>
    </div>
  )
}
