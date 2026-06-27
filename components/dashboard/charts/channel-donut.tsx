'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

export interface DonutSlice {
  label: string
  value: number
}

// Monochrome ramp — distinct grey shades, no colour accent.
const SHADES = ['#ffffff', '#bdbdbd', '#8a8a8a', '#5e5e5e', '#3a3a3a', '#262626']

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
                background: '#111111',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12,
                fontSize: 12,
                color: '#fff',
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
