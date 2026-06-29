'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'

export interface DailyPoint {
  day: string
  value: number
}

/**
 * Dark-themed daily trend chart for the admin area. `variant="bar"` suits
 * counts (conversations/errors); `variant="area"` suits volumes (tokens).
 */
export function TrendChart({
  title,
  data,
  color = '#34d399',
  variant = 'bar',
}: {
  title: string
  data: DailyPoint[]
  color?: string
  variant?: 'bar' | 'area'
}) {
  const axis = { fill: '#71717a', fontSize: 11 }
  const tooltip = {
    contentStyle: {
      background: '#18181b',
      border: '1px solid #27272a',
      borderRadius: 12,
      fontSize: 12,
    },
    labelStyle: { color: '#a1a1aa' },
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="mb-3 text-sm font-medium text-zinc-300">{title}</h2>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          {variant === 'area' ? (
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={axis} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={axis} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
              <Tooltip {...tooltip} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#grad-${title})`}
                isAnimationActive={false}
              />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="day" tick={axis} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={axis} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
              <Tooltip {...tooltip} cursor={{ fill: '#ffffff0a' }} />
              <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
