import { useRef, useState, type ReactNode } from 'react'

const REVEAL = 88
/** Minimum finger movement, in px, before committing to a swipe direction. */
const DIRECTION_THRESHOLD = 8

/**
 * Row that slides left on touch to reveal a delete action. Pointer devices keep
 * using the edit modal's delete button, so this is additive, not the only path.
 */
export function SwipeRow({
  onDelete,
  disabled,
  className = '',
  contentClassName = 'bg-white dark:bg-slate-900',
  children,
}: {
  onDelete: () => void
  disabled?: boolean
  className?: string
  /** Background of the sliding content — must be opaque to hide the delete button behind it at rest. */
  contentClassName?: string
  children: ReactNode
}) {
  const [dx, setDx] = useState(0)
  const startX = useRef(0)
  const startY = useRef(0)
  const startDx = useRef(0)
  const active = useRef(false)
  // Undecided until the finger has moved enough to tell a scroll from a swipe,
  // so a vertical scroll over a row never nudges it sideways.
  const direction = useRef<'none' | 'horizontal' | 'vertical'>('none')

  function onTouchStart(e: React.TouchEvent) {
    if (disabled) return
    active.current = true
    direction.current = 'none'
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    startDx.current = dx
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!active.current) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - startX.current
    const deltaY = touch.clientY - startY.current

    if (direction.current === 'none') {
      if (Math.abs(deltaX) < DIRECTION_THRESHOLD && Math.abs(deltaY) < DIRECTION_THRESHOLD) return
      direction.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical'
    }

    if (direction.current !== 'horizontal') return
    const next = Math.min(0, Math.max(-REVEAL, startDx.current + deltaX))
    setDx(next)
  }

  function onTouchEnd() {
    if (!active.current) return
    active.current = false
    if (direction.current === 'horizontal') {
      setDx(dx < -REVEAL / 2 ? -REVEAL : 0)
    }
    direction.current = 'none'
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
        className={`relative transition-transform ${contentClassName}`}
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
