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
  LabelList,
} from 'recharts'
import { PERSIAN_DATE_LOCALE } from '@/lib/localized-date'

export interface DailyPoint {
  day: string
  value: number
}

export interface NamedPoint {
  label: string
  value: number
}

const AXIS = { fill: '#71717a', fontSize: 11, fontFamily: 'IRANSansWeb' }

// ── Date formatters for X-axis ticks + tooltip labels ──────────────────────
// Converts ISO date strings ("2026-07-13") to Persian ("۲۱ تیر") so all
// charts show readable fa-IR dates, matching the /overview ConversationChart.
const dayFmt = new Intl.DateTimeFormat(PERSIAN_DATE_LOCALE, { month: 'short', day: 'numeric' })
const monthFmt = new Intl.DateTimeFormat(PERSIAN_DATE_LOCALE, { year: 'numeric', month: 'long' })

/** Format a tick/label value: ISO date → Persian, otherwise pass through. */
function formatDayTick(value: unknown): string {
  const s = String(value ?? '')
  // Match YYYY-MM-DD (daily charts from SQL to_char)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    try { return dayFmt.format(new Date(s + 'T00:00:00')) } catch { return s }
  }
  return s
}

/** Format a month tick: "YYYY-MM" → Persian month name + year. */
function formatMonthTick(value: unknown): string {
  const s = String(value ?? '')
  if (/^\d{4}-\d{2}$/.test(s)) {
    try { return monthFmt.format(new Date(s + '-01T00:00:00')) } catch { return s }
  }
  return s
}

const TOOLTIP = {
  contentStyle: {
    background: '#ffffff',
    border: '1px solid #e4e4e7',
    borderRadius: 12,
    fontSize: 12,
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
    fontFamily: 'IRANSansWeb',
    direction: 'rtl' as const,
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
  '#d4d4d8', // zinc-300
  '#52525b', // zinc-600
  '#e4e4e7', // zinc-200
  '#27272a', // zinc-800
]

/**
 * Value format kind. Using a string union (instead of a function) so the prop
 * is serializable and can be safely passed from a Server Component to this
 * Client Component. Next.js forbids passing functions across the RSC border.
 */
export type FormatKind = 'number' | 'irr' | 'rial' | 'usd' | 'compact-irr' | 'toman' | 'token'

/** Internal value formatter — keeps all Persian/IRR/USD logic in one place. */
function formatValue(v: number, kind: FormatKind = 'number'): string {
  const n = Number(v) || 0
  switch (kind) {
    case 'irr': {
      const toman = Math.trunc(n / 10)
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
    case 'toman': {
      const toman = Math.trunc(n / 10)
      return toman.toLocaleString('fa-IR')
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
  height = 240,
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
    <div className="spatial-surface rounded-[1.5rem] p-5 sm:p-6">
      <div className="mb-4">
        <h3 className="text-[13px] font-semibold text-zinc-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {variant === 'area' ? (
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#f1f1f2" strokeDasharray="3 5" />
              <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" tickFormatter={formatDayTick} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} width={36} allowDecimals={format === 'usd'} />
              <Tooltip {...TOOLTIP} formatter={(v) => [formatValue(Number(v), format), title]} labelFormatter={formatDayTick} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2.5}
                fill={`url(#${gradId})`}
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 5, fill: color, strokeWidth: 2, stroke: '#fff' }}
              />
            </AreaChart>
          ) : variant === 'line' ? (
            <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid vertical={false} stroke="#f1f1f2" strokeDasharray="3 5" />
              <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" tickFormatter={formatDayTick} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} width={36} allowDecimals={format === 'usd'} />
              <Tooltip {...TOOLTIP} formatter={(v) => [formatValue(Number(v), format), title]} labelFormatter={formatDayTick} />
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
              <CartesianGrid vertical={false} stroke="#f1f1f2" strokeDasharray="3 5" />
              <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" tickFormatter={formatDayTick} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} width={32} allowDecimals={format === 'usd'} />
              <Tooltip {...TOOLTIP} cursor={{ fill: '#f4f4f5' }} formatter={(v) => [formatValue(Number(v), format), title]} labelFormatter={formatDayTick} />
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
    <div className="spatial-surface rounded-[1.5rem] p-5 sm:p-6">
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
              {centerLabel && <span className="text-[11px] text-zinc-500">{centerLabel}</span>}
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

/** Ordered activation stages rendered as a compact horizontal funnel. */
export function ActivationFunnel({
  title,
  subtitle,
  data,
  total,
}: {
  title: string
  subtitle?: string
  data: NamedPoint[]
  total: number
}) {
  const rows = data.map((item) => ({
    ...item,
    percent: total > 0 ? Math.round((item.value / total) * 100) : 0,
  }))

  return (
    <div className="spatial-surface rounded-[1.5rem] p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div><h3 className="text-sm font-semibold text-zinc-900">{title}</h3>{subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}</div>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold text-zinc-600">مبنا {total.toLocaleString('fa-IR')}</span>
      </div>
      <div className="h-[13rem]" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={rows} margin={{ top: 0, right: 42, bottom: 0, left: 8 }} barCategoryGap={11}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" dataKey="label" width={118} tick={{ ...AXIS, textAnchor: 'end' }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP} formatter={(_value, _name, item) => [`${item.payload.value.toLocaleString('fa-IR')} کسب‌وکار · ${item.payload.percent.toLocaleString('fa-IR')}٪`, 'فعال‌سازی']} />
            <Bar dataKey="percent" radius={[0, 8, 8, 0]} isAnimationActive={false} barSize={18}>
              {rows.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
              <LabelList dataKey="percent" position="right" formatter={(value) => `${Number(value ?? 0).toLocaleString('fa-IR')}٪`} style={{ fill: '#52525b', fontSize: 10, fontFamily: 'IRANSansWeb' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
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
    <div className="spatial-surface rounded-[1.5rem] p-5 sm:p-6">
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
                className="h-full rounded-full transition-[width] duration-300"
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
    <div className="spatial-surface rounded-[1.5rem] p-5 sm:p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
            <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" tickFormatter={formatMonthTick} />
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
              labelFormatter={formatMonthTick}
            />
            <Bar dataKey="value" fill={color} radius={[5, 5, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── NET REVENUE CHART (credit charged vs OpenRouter cost vs net) ────
//
// Two stacked bars per day:
//   • bottom (dark)  = net revenue (after OpenRouter cost)
//   • top (light)    = OpenRouter cost
//   • bar total       = gross credit charged to users
// Hover tooltip shows gross, cost, and net separately so the unit
// economics are obvious. Values are in IRR but rendered as Toman.

export interface NetRevenueDay {
  day: string
  grossIRR: number
  costIRR: number
  netIRR: number
}

export function NetRevenueChart({
  title,
  subtitle,
  data,
  height = 240,
}: {
  title: string
  subtitle?: string
  data: NetRevenueDay[]
  height?: number
}) {
  // Compose a chart-friendly payload: stack net + cost = gross visually.
  const chartData = data.map((d) => ({
    day: d.day,
    net: Math.max(0, d.netIRR),
    cost: d.costIRR,
    gross: d.grossIRR,
  }))

  const grossTotal = data.reduce((total, day) => total + day.grossIRR, 0)

  return (
    <div className="spatial-surface rounded-[1.5rem] p-5 sm:p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-zinc-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-zinc-900" />
          سود خالص (پس از کسر هزینه AI)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-zinc-300" />
          هزینه OpenRouter
        </span>
        <span className="text-zinc-400">
          مجموع اعتبار کسر شده: {formatValue(grossTotal, 'irr')}
        </span>
      </div>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 14, left: 4 }}>
            <CartesianGrid vertical={false} stroke="#f1f1f2" strokeDasharray="3 5" />
            <XAxis
              dataKey="day"
              tick={AXIS}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              tickFormatter={formatDayTick}
            />
            <YAxis
              tick={AXIS}
              axisLine={false}
              tickLine={false}
              width={72}
              tickMargin={24}
              allowDecimals={false}
              tickFormatter={(v: number) => formatValue(v, 'toman')}
            />
            <Tooltip
              {...TOOLTIP}
              cursor={{ fill: '#f4f4f5' }}
              formatter={(value, name) => {
                const labels: Record<string, string> = {
                  net: 'سود خالص',
                  cost: 'هزینه OpenRouter',
                  gross: 'اعتبار کسر شده (ناخالص)',
                }
                return [formatValue(Number(value), 'irr'), labels[String(name)] ?? name]
              }}
              labelFormatter={formatDayTick}
            />
            {/* Stacked bars: net (bottom, dark) + cost (top, light) = gross visually */}
            <Bar
              dataKey="net"
              stackId="rev"
              fill="#18181b"
              radius={[0, 0, 0, 0]}
              isAnimationActive={false}
              barSize={26}
            />
            <Bar
              dataKey="cost"
              stackId="rev"
              fill="#d4d4d8"
              radius={[5, 5, 0, 0]}
              isAnimationActive={false}
              barSize={26}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
