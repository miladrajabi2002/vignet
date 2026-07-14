'use client'

import { useEffect, useRef } from 'react'

/**
 * Mouse-following radial spotlight. Updates --mx/--my CSS vars on its parent
 * so the `.spotlight-bg` utility can render a soft white glow at the cursor.
 * Wrap a `relative` container; this fills it as an absolute overlay.
 */
export function Spotlight() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current?.parentElement
    if (!el) return
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!finePointer.matches || reducedMotion.matches) return

    let frame = 0
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect()
        el.style.setProperty('--mx', `${e.clientX - rect.left}px`)
        el.style.setProperty('--my', `${e.clientY - rect.top}px`)
      })
    }
    const onLeave = () => {
      el.style.setProperty('--mx', '50%')
      el.style.setProperty('--my', '50%')
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden
      className="spotlight-bg pointer-events-none absolute inset-0 z-0"
    />
  )
}
