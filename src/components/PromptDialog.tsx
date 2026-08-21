import { useState } from 'react'

export function PromptDialog({
  title,
  message,
  placeholder,
  defaultValue = '',
  type = 'text',
  confirmLabel = 'Save',
  error,
  onSubmit,
  onCancel,
}: {
  title: string
  message?: string
  placeholder?: string
  defaultValue?: string
  type?: 'text' | 'password'
  confirmLabel?: string
  error?: string | null
  onSubmit: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(defaultValue)

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={onCancel}>
      <div
        className="w-full rounded-t-2xl bg-white p-4 pb-6 dark:bg-slate-900 sm:max-w-sm sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-lg font-semibold">{title}</h3>
        {message && <p className="mb-3 text-sm muted">{message}</p>}
        <input
          className="input"
          type={type}
          inputMode={type === 'password' ? 'numeric' : undefined}
          value={value}
          placeholder={placeholder}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit(value)}
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button className="btn-primary flex-1" onClick={() => onSubmit(value)}>
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
