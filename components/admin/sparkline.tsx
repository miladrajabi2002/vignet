'use client'

import { useId } from 'react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'

type TrendDirection = 'up' | 'down' | 'flat'

/**
 * Compute trend direction from a daily series.
 * >5% change = up/down, otherwise flat.
 */
function computeTrend(data: number[]): TrendDirection {
  if (!data || data.length === 0) return 'flat'
  const firstNonZero = data.find((v) => v > 0) ?? 0
  const last = data[data.length - 1] ?? 0
  if (firstNonZero === 0 && last === 0) return 'flat'
  if (firstNonZero === 0 && last > 0) return 'up'
  const pct = ((last - firstNonZero) / firstNonZero) * 100
  if (pct > 5) return 'up'
  if (pct < -5) return 'down'
  return 'flat'
}

/**
 * Recharts-based sparkline — matches the existing AgentSparkline style
 * (AreaChart with gradient fill) but supports green/red trend coloring.
 *
 * @param data     numeric series (oldest → newest)
 * @param color    hex color, or "auto" (green for up-trend, red for down,
 *                 neutral gray for flat). Works in both light and dark themes.
 * @param width    rendered width in px (ignored when fluid=true)
 * @param height   rendered height in px
 * @param fluid    when true, the chart fills its container width
 * @param invert   when true, up = bad (red), down = good (green) — for errors
 */
export function Sparkline({
  data,
  color = 'auto',
  width = 96,
  height = 32,
  fluid = false,
  invert = false,
}: {
  data: number[]
  color?: string
  width?: number
  height?: number
  fluid?: boolean
  invert?: boolean
}) {
  // Stable unique id for the gradient (avoids collisions when multiple
  // sparklines are on the same page).
  const rawId = useId()
  const gradId = `spark-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`

  if (!data || data.length === 0) {
    return <span className="text-[11px] text-[var(--text-muted)]">—</span>
  }

  // Determine stroke color.
  let stroke: string
  if (color === 'auto') {
    const dir = computeTrend(data)
    if (dir === 'flat') {
      stroke = '#71717a' // zinc-500 — visible on both light and dark
    } else {
      const isGood = invert ? dir === 'down' : dir === 'up'
      stroke = isGood ? '#22c55e' : '#ef4444'
    }
  } else {
    stroke = color
  }

  const points = data.map((value, i) => ({ i, value }))

  return (
    <div style={{ width: fluid ? '100%' : width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={1.25}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
