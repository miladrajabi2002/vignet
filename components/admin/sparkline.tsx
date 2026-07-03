'use client'

import { cn } from '@/lib/utils'

/**
 * Tiny inline SVG sparkline for table rows and compact stat cards.
 * Renders a smooth-ish polyline from a small numeric series.
 *
 * @param data     7 daily counts, oldest → newest
 * @param color    hex stroke color (default emerald green). When "auto",
 *                 the line turns green for an up-trend and red for down.
 * @param width    SVG width in px
 * @param height   SVG height in px
 */
export function Sparkline({
  data,
  color = 'auto',
  width = 96,
  height = 28,
  className,
}: {
  data: number[]
  color?: string
  width?: number
  height?: number
  className?: string
}) {
  if (!data || data.length === 0) {
    return <span className="text-[11px] text-zinc-300">—</span>
  }

  const n = data.length
  const max = Math.max(1, ...data)
  const min = Math.min(0, ...data)
  const range = max - min || 1
  const stepX = n > 1 ? (width - 4) / (n - 1) : 0

  const points = data.map((v, i) => {
    const x = 2 + i * stepX
    const y = height - 2 - ((v - min) / range) * (height - 4)
    return [x, y] as const
  })

  const path = points
    .map(([x, y], i) => (i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `L ${x.toFixed(1)} ${y.toFixed(1)}`))
    .join(' ')

  // Determine stroke color.
  let stroke: string
  if (color === 'auto') {
    const firstNonZero = data.find((d) => d > 0) ?? 0
    const last = data[n - 1] ?? 0
    stroke = last >= firstNonZero ? '#22c55e' : '#ef4444'
  } else {
    stroke = color
  }

  // Build a soft area fill below the line.
  const areaPath =
    points.length > 0
      ? `${path} L ${(2 + (n - 1) * stepX).toFixed(1)} ${height - 2} L 2 ${height - 2} Z`
      : ''

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('block', className)}
      aria-hidden
    >
      {areaPath && <path d={areaPath} fill={stroke} fillOpacity={0.08} stroke="none" />}
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1][0]}
          cy={points[points.length - 1][1]}
          r={2}
          fill={stroke}
        />
      )}
    </svg>
  )
}
