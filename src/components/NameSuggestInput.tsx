import { useState } from 'react'
import { matchNames, type NameStat } from '../lib/history'

/**
 * Text field that suggests names already used elsewhere in the data, so the same
 * expense is spelled the same way everywhere. Typing something new is always
 * allowed — the list is a shortcut, not a constraint.
 */
export function NameSuggestInput({
  value,
  stats,
  placeholder,
  autoFocus,
  onChange,
  onPick,
}: {
  value: string
  stats: NameStat[]
  placeholder?: string
  autoFocus?: boolean
  onChange: (value: string) => void
  onPick?: (stat: NameStat) => void
}) {
  const [open, setOpen] = useState(false)
  const suggestions = open ? matchNames(value, stats) : []

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
      {suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {suggestions.map((s) => (
            <button
              key={s.name}
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm active:bg-slate-50 dark:active:bg-slate-700"
              // mousedown would blur the input and close the list before the click lands
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(s.name)
                onPick?.(s)
                setOpen(false)
              }}
            >
              <span>{s.name}</span>
              <span className="text-xs muted">₹{s.lastAmount.toLocaleString('en-IN')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
