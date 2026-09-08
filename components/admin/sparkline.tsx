'use client'

import { useId } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts'

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

function fa(n: number): string {
  return Number(n).toLocaleString('fa-IR')
}

/** Format the hovered value: plain count or IRR → Toman. */
function formatHoverValue(v: number, kind: 'number' | 'irr'): string {
  if (kind === 'irr') return `${Math.round(v / 10).toLocaleString('fa-IR')} تومان`
  return fa(v)
}

/** Dark rounded hover bubble shared by every sparkline on the site. */
function SparkTooltipBubble({
  label,
  value,
  valueLabel,
  kind,
}: {
  label: string
  value: number
  valueLabel?: string
  kind: 'number' | 'irr'
}) {
  return (
    <div
      dir="rtl"
      className="pointer-events-none -translate-y-1 rounded-xl border border-white/10 bg-zinc-900/95 px-3 py-2 shadow-[0_6px_24px_rgba(0,0,0,0.28)] backdrop-blur-sm"
    >
      {valueLabel && (
        <p className="text-[10px] font-semibold leading-4 text-white/55">{valueLabel}</p>
      )}
      <p className="text-xs font-bold leading-5 tabular-nums text-white">
        {formatHoverValue(value, kind)}
      </p>
      <p className="mt-0.5 text-[10px] leading-4 text-white/60">{label}</p>
    </div>
  )
}

/**
 * Recharts-based sparkline — matches the existing AgentSparkline style
 * (AreaChart with gradient fill) but supports green/red trend coloring.
 *
 * Hover: a subtle column cursor + active dot + a dark rounded bubble that
 * shows the exact day (Persian label) and value — precise and pretty.
 *
 * @param data     numeric series (oldest → newest)
 * @param color    hex color, or "auto" (green for up-trend, red for down,
 *                 neutral gray for flat). Works in both light and dark themes.
 * @param width    rendered width in px (ignored when fluid=true)
 * @param height   rendered height in px
 * @param fluid    when true, the chart fills its container width
 * @param invert   when true, up = bad (red), down = good (green) — for errors
 * @param labels   optional per-point labels (e.g. Persian short dates,
 *                 oldest → newest) shown in the hover bubble
 * @param valueLabel optional metric name shown above the value in the bubble
 * @param valueFormat 'number' (default) or 'irr' (Rial → Toman in the bubble)
 */
export function Sparkline({
  data,
  color = 'auto',
  width = 96,
  height = 32,
  fluid = false,
  invert = false,
  labels,
  valueLabel,
  valueFormat = 'number',
}: {
  data: number[]
  color?: string
  width?: number
  height?: number
  fluid?: boolean
  invert?: boolean
  labels?: string[]
  valueLabel?: string
  valueFormat?: 'number' | 'irr'
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
  const hasLabels = Boolean(labels && labels.length === data.length)

  return (
    <div style={{ width: fluid ? '100%' : width, height }} className="group/spark">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            cursor={{ stroke: 'transparent' }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null
              const point = payload[0]?.payload as { i: number; value: number } | undefined
              if (!point) return null
              const label = hasLabels
                ? labels![point.i]
                : point.i === data.length - 1
                  ? 'امروز'
                  : `${fa(data.length - 1 - point.i)} روز پیش`
              return (
                <SparkTooltipBubble
                  label={label}
                  value={point.value}
                  valueLabel={valueLabel}
                  kind={valueFormat}
                />
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={1.25}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
            activeDot={{
              r: 3,
              fill: stroke,
              strokeWidth: 2,
              stroke: '#ffffff',
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
