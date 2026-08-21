import { useRef, useState, type ReactNode } from 'react'

const REVEAL = 88

/**
 * Row that slides left on touch to reveal a delete action. Pointer devices keep
 * using the edit modal's delete button, so this is additive, not the only path.
 */
export function SwipeRow({
  onDelete,
  disabled,
  className = '',
  children,
}: {
  onDelete: () => void
  disabled?: boolean
  className?: string
  children: ReactNode
}) {
  const [dx, setDx] = useState(0)
  const startX = useRef(0)
  const startDx = useRef(0)
  const active = useRef(false)

  function onTouchStart(e: React.TouchEvent) {
    if (disabled) return
    active.current = true
    startX.current = e.touches[0].clientX
    startDx.current = dx
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!active.current) return
    const delta = e.touches[0].clientX - startX.current
    const next = Math.min(0, Math.max(-REVEAL, startDx.current + delta))
    setDx(next)
  }

  function onTouchEnd() {
    if (!active.current) return
    active.current = false
    setDx(dx < -REVEAL / 2 ? -REVEAL : 0)
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!disabled && (
        <button
          className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-600 px-4 text-sm font-semibold text-white"
          style={{ width: REVEAL }}
          onClick={() => {
            setDx(0)
            onDelete()
          }}
        >
          Delete
        </button>
      )}
      <div
        className="relative bg-white transition-transform dark:bg-slate-900"
        style={{ transform: `translateX(${dx}px)`, transitionDuration: active.current ? '0ms' : '150ms' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}
