'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * Card whose radial spotlight follows the cursor inside it. Updates CSS vars
 * (--mx/--my) consumed by the `.spotlight-bg` overlay. Monochrome, B&W-safe.
 */
export function SpotlightCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`)
    el.style.setProperty('--my', `${e.clientY - rect.top}px`)
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] transition-colors hover:border-[var(--border-hover)]',
        className,
      )}
    >
      <div className="spotlight-bg pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
