'use client'

import { Area, AreaChart, ResponsiveContainer } from 'recharts'

/**
 * Tiny inline sparkline for a per-agent metric trend. Monochrome, axis-free —
 * designed to sit inside a table row or compact card.
 */
export function AgentSparkline({
  data,
  width = 96,
  height = 32,
}: {
  data: number[]
  width?: number
  height?: number
}) {
  const points = data.map((value, i) => ({ i, value }))
  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke="#ffffff"
            strokeWidth={1.25}
            fill="url(#sparkFill)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
