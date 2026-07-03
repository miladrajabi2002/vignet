'use client'

import { cn } from '@/lib/utils'
import { Sparkline } from './sparkline'

/**
 * Compact stat tile with an inline sparkline — matches the existing
 * StatsCard layout exactly (same padding, fonts, colors), with an added
 * recharts sparkline at the bottom.
 *
 * @param variant   "theme" → CSS variables (user dashboard, dark/light)
 *                  "light" → hardcoded light classes (admin panel)
 * @param label     short title
 * @param value     big number
 * @param series    daily values for the sparkline
 * @param color     sparkline color (hex, or "auto" for green/red trend)
 * @param hint      optional small text under the value
 */
export function MiniTrend({
  label,
  value,
  series,
  color = 'auto',
  hint,
  variant = 'theme',
  className,
}: {
  label: string
  value: string | number
  series: number[]
  color?: string
  hint?: string
  variant?: 'theme' | 'light'
  className?: string
}) {
  // Card container — matches StatsCard in each context.
  const cardCls =
    variant === 'light'
      ? 'rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm'
      : 'rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 transition-colors hover:border-[var(--border-hover)]'

  // Label — same position and style as StatsCard.
  const labelCls =
    variant === 'light'
      ? 'text-xs font-medium text-zinc-500'
      : 'text-sm text-[var(--text-secondary)]'

  // Value — same size and weight as StatsCard.
  const valueCls =
    variant === 'light'
      ? 'mt-2 text-3xl font-semibold tracking-tight text-zinc-900'
      : 'mt-3 text-3xl font-light text-[var(--text-primary)]'

  // Hint — same as StatsCard's sub/hint.
  const hintCls =
    variant === 'light'
      ? 'mt-1 text-xs text-zinc-500'
      : 'mt-1 text-[11px] text-[var(--text-muted)]'

  return (
    <div className={cn(cardCls, className)}>
      <p className={labelCls}>{label}</p>
      <p className={valueCls}>
        {typeof value === 'number' ? value.toLocaleString('fa-IR') : value}
      </p>
      {hint && <p className={hintCls}>{hint}</p>}
      {series && series.length > 0 && (
        <div className="mt-3">
          <Sparkline data={series} color={color} width={200} height={32} fluid />
        </div>
      )}
    </div>
  )
}
