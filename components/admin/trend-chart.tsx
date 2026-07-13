'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

export interface DailyPoint {
  day: string
  value: number
}

export interface NamedPoint {
  label: string
  value: number
}

const AXIS = { fill: '#a1a1aa', fontSize: 11 }
const TOOLTIP = {
  contentStyle: {
    background: '#ffffff',
    border: '1px solid #e4e4e7',
    borderRadius: 12,
    fontSize: 12,
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
  },
  labelStyle: { color: '#71717a', fontWeight: 600 },
  itemStyle: { color: '#18181b' },
}

/** A monochrome-friendly palette for donut/pie series. Black→gray→semantic. */
export const CHART_COLORS = [
  '#18181b', // zinc-900
  '#3f3f46', // zinc-700
  '#71717a', // zinc-500
  '#a1a1aa', // zinc-400
  '#22c55e', // emerald-500
  '#3b82f6', // blue-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
]

/**
 * Value format kind. Using a string union (instead of a function) so the prop
 * is serializable and can be safely passed from a Server Component to this
 * Client Component. Next.js forbids passing functions across the RSC border.
 */
export type FormatKind = 'number' | 'irr' | 'rial' | 'usd' | 'compact-irr' | 'token'

/** Internal value formatter — keeps all Persian/IRR/USD logic in one place. */
function formatValue(v: number, kind: FormatKind = 'number'): string {
  const n = Number(v) || 0
  switch (kind) {
    case 'irr': {
      const toman = n / 10
      return `${toman.toLocaleString('fa-IR')} تومان`
    }
    case 'usd':
      return `$${n.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      })}`
    case 'rial':
      return `${n.toLocaleString('fa-IR')} ریال`
    case 'compact-irr': {
      const toman = n / 10
      return toman >= 1_000_000
        ? `${(toman / 1_000_000).toLocaleString('fa-IR')} م`
        : toman.toLocaleString('fa-IR')
    }
    case 'token':
      return `${n.toLocaleString('fa-IR')} توکن`
    case 'number':
    default:
      return n.toLocaleString('fa-IR')
  }
}

/**
 * Light-themed daily trend chart for the admin area.
 * - `variant="bar"`    suits counts (conversations/errors)
 * - `variant="area"`   suits volumes (tokens)
 * - `variant="line"`   suits smooth KPIs (revenue, signups)
 */
export function TrendChart({
  title,
  subtitle,
  data,
  color = '#18181b',
  variant = 'bar',
  height = 176,
  format = 'number',
}: {
  title: string
  subtitle?: string
  data: DailyPoint[]
  color?: string
  variant?: 'bar' | 'area' | 'line'
  height?: number
  format?: FormatKind
}) {
  const gradId = `grad-${title.replace(/\s/g, '')}-${variant}`

  return (
    <div className="admin-panel rounded-[1.35rem] p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {variant === 'area' ? (
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
              <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} width={36} allowDecimals={format === 'usd'} />
              <Tooltip {...TOOLTIP} formatter={(v) => [formatValue(Number(v), format), title]} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2.5}
                fill={`url(#${gradId})`}
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 4, fill: color }}
              />
            </AreaChart>
          ) : variant === 'line' ? (
            <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
              <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} width={36} allowDecimals={format === 'usd'} />
              <Tooltip {...TOOLTIP} formatter={(v) => [formatValue(Number(v), format), title]} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2.5}
                isAnimationActive={false}
                dot={{ r: 2.5, fill: color }}
                activeDot={{ r: 5, fill: color }}
              />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
              <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} width={32} allowDecimals={format === 'usd'} />
              <Tooltip {...TOOLTIP} cursor={{ fill: '#f4f4f5' }} formatter={(v) => [formatValue(Number(v), format), title]} />
              <Bar dataKey="value" fill={color} radius={[5, 5, 0, 0]} isAnimationActive={false} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Donut chart for distributions (plans, gateways, channels). */
export function DonutChart({
  title,
  subtitle,
  data,
  height = 200,
  centerLabel,
  centerValue,
}: {
  title: string
  subtitle?: string
  data: NamedPoint[]
  height?: number
  centerLabel?: string
  centerValue?: string | number
}) {
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="admin-panel rounded-[1.35rem] p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: height, height }}>
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
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                {...TOOLTIP}
                formatter={(v, n) => [
                  `${formatValue(Number(v), 'number')} (${total > 0 ? Math.round((Number(v) / total) * 100) : 0}٪)`,
                  n,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          {centerValue !== undefined && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-zinc-900">
                {typeof centerValue === 'number' ? centerValue.toLocaleString('fa-IR') : centerValue}
              </span>
              {centerLabel && <span className="text-[10px] text-zinc-500">{centerLabel}</span>}
            </div>
          )}
        </div>
        <ul className="min-w-0 flex-1 space-y-2">
          {data.map((d, i) => (
            <li key={d.label} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="truncate text-zinc-600">{d.label}</span>
              <span className="ms-auto font-semibold text-zinc-900">
                {d.value.toLocaleString('fa-IR')}
              </span>
              <span className="w-10 text-end text-zinc-400">
                {total > 0 ? Math.round((d.value / total) * 100) : 0}٪
              </span>
            </li>
          ))}
          {data.length === 0 && <li className="text-xs text-zinc-400">داده‌ای نیست</li>}
        </ul>
      </div>
    </div>
  )
}

/** Horizontal bar list — compact ranking chart (top workspaces, top models). */
export function BarList({
  title,
  subtitle,
  data,
  format = 'number',
  color = '#18181b',
}: {
  title: string
  subtitle?: string
  data: NamedPoint[]
  format?: FormatKind
  color?: string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))

  return (
    <div className="admin-panel rounded-[1.35rem] p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      <ul className="space-y-3">
        {data.map((d, i) => (
          <li key={i}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-zinc-700">{d.label}</span>
              <span className="shrink-0 font-semibold text-zinc-900">
                {formatValue(d.value, format)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(d.value / max) * 100}%`, background: color }}
              />
            </div>
          </li>
        ))}
        {data.length === 0 && <li className="py-4 text-center text-xs text-zinc-400">داده‌ای نیست</li>}
      </ul>
    </div>
  )
}

/** Monthly bar chart for revenue/payment/user trends over N months. */
export function MonthlyBarChart({
  title,
  subtitle,
  data,
  color = '#18181b',
  height = 220,
  format = 'number',
}: {
  title: string
  subtitle?: string
  data: { month: string; value: number }[]
  color?: string
  height?: number
  format?: FormatKind
}) {
  return (
    <div className="admin-panel rounded-[1.35rem] p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
            <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis
              tick={AXIS}
              axisLine={false}
              tickLine={false}
              width={48}
              allowDecimals={false}
              tickFormatter={(v: number) => formatValue(v, format)}
            />
            <Tooltip
              {...TOOLTIP}
              cursor={{ fill: '#f4f4f5' }}
              formatter={(v) => [formatValue(Number(v), format), title]}
            />
            <Bar dataKey="value" fill={color} radius={[5, 5, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
