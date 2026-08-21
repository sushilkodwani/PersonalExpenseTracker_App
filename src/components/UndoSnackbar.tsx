import { useEffect } from 'react'

const AUTO_DISMISS_MS = 5000

/**
 * Bottom snackbar for reversing the last delete. Auto-dismisses so it never
 * lingers, but a tap on Undo before then restores the item.
 */
export function UndoSnackbar({
  message,
  onUndo,
  onDismiss,
}: {
  message: string
  onUndo: () => void
  onDismiss: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="no-print fixed inset-x-0 bottom-16 z-50 flex justify-center px-4">
      <div className="flex w-full max-w-md items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
        <span className="truncate">{message}</span>
        <button
          className="shrink-0 font-semibold text-indigo-300 dark:text-indigo-600"
          onClick={() => {
            onUndo()
            onDismiss()
          }}
        >
          Undo
        </button>
      </div>
    </div>
  )
}
