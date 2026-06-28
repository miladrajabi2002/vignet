'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

export interface DonutSlice {
  label: string
  value: number
}

// Monochrome ramp — distinct ink opacities, no colour accent. Built from the
// theme's foreground "ink" so it inverts cleanly in the light theme.
const SHADES = [
  'rgba(var(--ink-rgb),1)',
  'rgba(var(--ink-rgb),0.72)',
  'rgba(var(--ink-rgb),0.52)',
  'rgba(var(--ink-rgb),0.36)',
  'rgba(var(--ink-rgb),0.24)',
  'rgba(var(--ink-rgb),0.15)',
]

export function ChannelDonut({ data }: { data: DonutSlice[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="flex items-center gap-6">
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
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-light text-[var(--text-primary)]">
            {total}
          </span>
        </div>
      </div>

      <ul className="flex-1 space-y-2">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: SHADES[i % SHADES.length] }}
            />
            <span className="flex-1 truncate text-[var(--text-secondary)]">
              {d.label}
            </span>
            <span className="text-[var(--text-primary)]">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
