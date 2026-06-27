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
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
          interval="preserveStartEnd"
        />
        <YAxis
          allowDecimals={false}
          width={32}
          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ stroke: 'rgba(255,255,255,0.16)' }}
          contentStyle={{
            background: '#111111',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12,
            fontSize: 12,
            color: '#fff',
          }}
          labelStyle={{ color: 'rgba(255,255,255,0.55)' }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#ffffff"
          strokeWidth={1.5}
          fill="url(#trendFill)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
