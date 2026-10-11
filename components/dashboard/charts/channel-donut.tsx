'use client'

import { useLocale } from 'next-intl'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CHART_COLORS } from '@/components/admin/chart-palette'

export interface DonutSlice {
  label: string
  value: number
}

// The shared chart palette: slices must be told apart at a glance, which a
// ramp of greys never managed for the third slice onwards.
const SHADES = CHART_COLORS

export function ChannelDonut({ data }: { data: DonutSlice[] }) {
  const locale = useLocale()
  const numberLocale = locale === 'fa' ? 'fa-IR' : 'en-US'
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    // One legend, beside the ring when there is room and under it when there
    // is not; every row may shrink, so a count is never cut by the card edge.
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4" role="img" aria-label={data.map((d) => `${d.label}: ${d.value.toLocaleString(numberLocale)}`).join('، ')}>
      <div className="relative h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={58}
              outerRadius={84}
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={SHADES[i % SHADES.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-hover)',
                borderRadius: 12,
                fontSize: 12,
                color: 'var(--text-primary)',
                fontFamily: 'IRANSansWeb',
              }}
              formatter={(value, name) => [
                Number(value ?? 0).toLocaleString(numberLocale),
                String(name ?? ''),
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-light tabular-nums text-[var(--text-primary)]" title={total.toLocaleString(numberLocale)}>
            {total.toLocaleString(numberLocale)}
          </span>
        </div>
      </div>

      <ul className="min-w-[9rem] flex-1 space-y-2">
        {data.map((d, i) => (
          <li key={d.label} className="flex min-w-0 items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: SHADES[i % SHADES.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">
              {d.label}
            </span>
            <span className="shrink-0 tabular-nums text-[var(--text-primary)]">{d.value.toLocaleString(numberLocale)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
