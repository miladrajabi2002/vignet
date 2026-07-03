'use client'

import { Sparkline } from './sparkline'
import { cn } from '@/lib/utils'

/**
 * Compact stat tile with an inline sparkline.
 * THEME-AWARE: uses CSS variables (var(--bg-surface), var(--border-default),
 * var(--text-*)) so it renders correctly in BOTH the light admin panel and
 * the dark user dashboard. Works with next-themes light/dark toggle.
 *
 * @param label    short title (e.g. "مکالمات ۷ روز")
 * @param value    big number shown next to the sparkline
 * @param series   7 daily counts for the sparkline
 * @param color    sparkline stroke color (hex, or "auto")
 * @param hint     optional small text under the value
 */
export function MiniTrend({
  label,
  value,
  series,
  color = 'auto',
  hint,
  className,
}: {
  label: string
  value: string | number
  series: number[]
  color?: string
  hint?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-2xl border bg-[var(--bg-surface)] p-4 transition-colors hover:border-[var(--border-hover)]',
        className,
      )}
      style={{ borderColor: 'var(--border-default)' }}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--text-secondary)]">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
          {typeof value === 'number' ? value.toLocaleString('fa-IR') : value}
        </p>
        {hint && <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{hint}</p>}
      </div>
      <Sparkline data={series} color={color} width={88} height={32} />
    </div>
  )
}
