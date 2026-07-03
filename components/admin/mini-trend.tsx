'use client'

import { Sparkline } from './sparkline'
import { cn } from '@/lib/utils'

/**
 * Compact stat tile with an inline sparkline.
 * Designed to sit in a grid at the top of admin pages (conversations, errors, etc).
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
        'flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-500">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900">
          {typeof value === 'number' ? value.toLocaleString('fa-IR') : value}
        </p>
        {hint && <p className="mt-0.5 text-[11px] text-zinc-400">{hint}</p>}
      </div>
      <Sparkline data={series} color={color} width={88} height={32} />
    </div>
  )
}
