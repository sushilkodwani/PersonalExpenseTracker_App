import { useState } from 'react'

/**
 * Text field that suggests values already used elsewhere, so the same note or
 * name is spelled the same way everywhere. Typing something new is always
 * allowed — the list is a shortcut, not a constraint.
 */
export function TextSuggestInput({
  value,
  suggestions,
  placeholder,
  autoFocus,
  onChange,
}: {
  value: string
  suggestions: string[]
  placeholder?: string
  autoFocus?: boolean
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const q = value.trim().toLowerCase()
  const matches = open && q ? suggestions.filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q).slice(0, 6) : []

  return (
    <div className="relative">
      <input
        className="input mt-1"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
      />
      {matches.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {matches.map((s) => (
            <button
              key={s}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm active:bg-slate-50 dark:active:bg-slate-700"
              // mousedown would blur the input and close the list before the click lands
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(s)
                setOpen(false)
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
