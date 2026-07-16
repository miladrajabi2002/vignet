'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
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
  const peak = Math.max(0, ...data.map((point) => point.value))
  const domainMax = Math.max(1, peak)

  return (
    <div
      className="h-[12.5rem] w-full sm:h-60"
      role="img"
      aria-label={`Trend across ${data.length} points; peak value ${peak}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--ink-rgb))" stopOpacity={0.18} />
            <stop offset="100%" stopColor="rgb(var(--ink-rgb))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgba(var(--ink-rgb),0.055)" strokeDasharray="3 4" />
        <XAxis
          dataKey="label"
          tick={{ fill: 'rgba(var(--ink-rgb),0.65)', fontSize: 11, fontWeight: 500 }}
          tickLine={false}
          axisLine={{ stroke: 'rgba(var(--ink-rgb),0.12)' }}
          interval="preserveStartEnd"
        />
        <YAxis
          allowDecimals={false}
          domain={[0, domainMax]}
          tickCount={Math.min(5, domainMax + 1)}
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
            fontFamily: 'IRANSansWeb',
          }}
          labelStyle={{ color: 'var(--text-secondary)' }}
          formatter={(value: number) => [Number(value).toLocaleString('fa-IR'), 'تعداد']}
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
    </div>
  )
}
