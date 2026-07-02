'use client'

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface TrendPoint {
  label: string
  value: number
}

/** Monochrome area chart for a daily metric trend. */
export function ConversationChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--ink-rgb))" stopOpacity={0.18} />
            <stop offset="100%" stopColor="rgb(var(--ink-rgb))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          tick={{ fill: 'rgba(var(--ink-rgb),0.65)', fontSize: 11, fontWeight: 500 }}
          tickLine={false}
          axisLine={{ stroke: 'rgba(var(--ink-rgb),0.12)' }}
          interval="preserveStartEnd"
        />
        <YAxis
          allowDecimals={false}
          width={32}
          tick={{ fill: 'rgba(var(--ink-rgb),0.65)', fontSize: 11, fontWeight: 500 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ stroke: 'rgba(var(--ink-rgb),0.16)' }}
          contentStyle={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-hover)',
            borderRadius: 12,
            fontSize: 12,
            color: 'var(--text-primary)',
          }}
          labelStyle={{ color: 'var(--text-secondary)' }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="rgb(var(--ink-rgb))"
          strokeWidth={1.5}
          fill="url(#trendFill)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
