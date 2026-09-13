'use client'

import { useLocale } from 'next-intl'
import { RadialBar, RadialBarChart, ResponsiveContainer, PolarAngleAxis } from 'recharts'

/**
 * Monochrome radial gauge for the average CSAT rating (0–5). The arc fills
 * proportionally to the score; the numeric score is centered inside.
 */
export function SatisfactionGauge({
  value,
  count,
  label,
}: {
  value: number | null
  count: number
  label: string
}) {
  const locale = useLocale()
  const numberLocale = locale === 'fa' ? 'fa-IR' : 'en-US'
  const score = value ?? 0
  const pct = Math.max(0, Math.min(100, (score / 5) * 100))
  const data = [{ name: 'csat', value: pct, fill: 'rgb(var(--ink-rgb))' }]

  return (
    <div className="relative h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="72%"
          outerRadius="100%"
          data={data}
          startAngle={220}
          endAngle={-40}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar
            background={{ fill: 'rgba(var(--ink-rgb),0.06)' }}
            dataKey="value"
            cornerRadius={8}
            isAnimationActive={false}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-light tabular-nums text-[var(--text-primary)]">
          {value ? value.toLocaleString(numberLocale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}
        </span>
        <span className="text-xs tabular-nums text-[var(--text-secondary)]">
          {count.toLocaleString(numberLocale)} {label}
        </span>
      </div>
    </div>
  )
}
