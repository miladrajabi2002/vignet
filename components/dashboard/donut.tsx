'use client'

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'

export interface NamedPoint {
  label: string
  value: number
}

// Theme-aware palette — uses CSS variables for the ink channel so it
// inverts correctly between light and dark themes.
const COLORS = [
  'var(--text-primary)',
  'var(--text-secondary)',
  'var(--text-muted)',
  'var(--text-hint)',
  '#22c55e',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#a855f7',
  '#06b6d4',
]

/**
 * Theme-aware donut chart for the user dashboard.
 * Renders a donut + a legend list on the side.
 */
export function DashboardDonut({
  data,
  height = 180,
  centerLabel,
  centerValue,
}: {
  data: NamedPoint[]
  height?: number
  centerLabel?: string
  centerValue?: string | number
}) {
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative shrink-0"
        style={{
          width: `clamp(9rem, 46vw, ${height}px)`,
          height: `clamp(9rem, 46vw, ${height}px)`,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={2}
              isAnimationActive={false}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 12,
                fontSize: 12,
                color: 'var(--text-primary)',
              }}
              labelStyle={{ color: 'var(--text-secondary)', fontWeight: 600 }}
              formatter={(v, n) => [
                `${Number(v).toLocaleString('fa-IR')} (${total > 0 ? Math.round((Number(v) / total) * 100) : 0}٪)`,
                n,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        {centerValue !== undefined && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-[var(--text-primary)]">
              {typeof centerValue === 'number' ? centerValue.toLocaleString('fa-IR') : centerValue}
            </span>
            {centerLabel && (
              <span className="text-[10px] text-[var(--text-muted)]">{centerLabel}</span>
            )}
          </div>
        )}
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="truncate text-[var(--text-secondary)]">{d.label}</span>
            <span className="ms-auto font-semibold text-[var(--text-primary)]">
              {d.value.toLocaleString('fa-IR')}
            </span>
            <span className="w-10 text-end text-[var(--text-muted)]">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}٪
            </span>
          </li>
        ))}
        {data.length === 0 && (
          <li className="py-4 text-center text-xs text-[var(--text-muted)]">داده‌ای نیست</li>
        )}
      </ul>
    </div>
  )
}
