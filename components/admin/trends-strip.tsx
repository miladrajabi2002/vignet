'use client'

import { Sparkline } from './sparkline'
import { cn } from '@/lib/utils'

type TrendDirection = 'up' | 'down' | 'flat'

interface TrendTile {
  label: string
  series: number[]
  /**
   * When true, an upward trend is BAD (e.g. errors) → shown in red.
   * Default: upward = good (green).
   */
  invert?: boolean
}

/**
 * Compute trend direction + percentage from a daily series.
 * - Compares last value vs first non-zero value.
 * - >5% change = up/down, otherwise flat.
 */
function computeTrend(series: number[]): { direction: TrendDirection; pct: number } {
  if (!series || series.length === 0) return { direction: 'flat', pct: 0 }
  const firstNonZero = series.find((v) => v > 0) ?? 0
  const last = series[series.length - 1] ?? 0

  if (firstNonZero === 0 && last === 0) return { direction: 'flat', pct: 0 }
  if (firstNonZero === 0 && last > 0) return { direction: 'up', pct: 100 }

  const pct = Math.round(((last - firstNonZero) / firstNonZero) * 100)
  if (pct > 5) return { direction: 'up', pct }
  if (pct < -5) return { direction: 'down', pct }
  return { direction: 'flat', pct }
}

function TrendBadge({
  direction,
  pct,
  invert,
}: {
  direction: TrendDirection
  pct: number
  invert?: boolean
}) {
  // Determine color. For inverted metrics (errors), up = bad = red.
  const isGood =
    direction === 'flat'
      ? null
      : invert
        ? direction === 'down'
        : direction === 'up'

  const cls =
    direction === 'flat'
      ? 'bg-zinc-100 text-zinc-500'
      : isGood
        ? 'bg-emerald-50 text-emerald-600'
        : 'bg-red-50 text-red-600'

  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '─'
  const label = direction === 'flat' ? 'ثابت' : `${arrow} ${Math.abs(pct).toLocaleString('fa-IR')}٪`

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
        cls,
      )}
    >
      {label}
    </span>
  )
}

/**
 * A horizontal strip of compact sparkline tiles — one per KPI.
 * Designed to sit below the stat cards on the admin dashboard so the
 * operator gets an at-a-glance "site pulse": which metrics are trending
 * up (green), flat (gray), or down (red).
 *
 * Each tile shows: label, trend badge, and a fluid sparkline.
 */
export function TrendsStrip({ tiles }: { tiles: TrendTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile, i) => {
        const { direction, pct } = computeTrend(tile.series)
        // Sparkline color follows the trend (respecting invert).
        const isGood =
          direction === 'flat'
            ? null
            : tile.invert
              ? direction === 'down'
              : direction === 'up'
        const sparkColor =
          direction === 'flat'
            ? '#a1a1aa'
            : isGood
              ? '#22c55e'
              : '#ef4444'

        return (
          <div
            key={i}
            className="spatial-surface rounded-[1rem] p-3 transition-[border-color,box-shadow] duration-200 hover:border-black/[0.14] hover:shadow-[var(--shadow-card)]"
          >
            <div className="mb-1.5 flex items-center justify-between gap-1">
              <span className="truncate text-[11px] font-medium text-zinc-500">
                {tile.label}
              </span>
            </div>
            <div className="mb-2">
              <TrendBadge direction={direction} pct={pct} invert={tile.invert} />
            </div>
            <div className="h-8">
              <Sparkline
                data={tile.series}
                color={sparkColor}
                width={120}
                height={32}
                fluid
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
