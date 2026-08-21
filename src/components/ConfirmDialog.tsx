export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onCancel,
}: {
  title?: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={onCancel}>
      <div
        className="w-full rounded-t-2xl bg-white p-4 pb-6 dark:bg-slate-900 sm:max-w-sm sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h3 className="mb-1 text-lg font-semibold">{title}</h3>}
        <p className="mb-4 text-sm muted">{message}</p>
        <div className="flex gap-2">
          <button
            className={`flex-1 rounded-lg px-4 py-2.5 font-medium text-white ${danger ? 'bg-red-600 active:bg-red-700' : 'bg-indigo-600 active:bg-indigo-700'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button className="btn-secondary flex-1" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
