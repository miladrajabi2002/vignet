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
import { PERSIAN_DATE_LOCALE } from '@/lib/localized-date'
import { CHART_ACCENT_TINT, CHART_COLORS, CHART_INK } from './chart-palette'

export interface DailyPoint {
  day: string
  value: number
}

export interface NamedPoint {
  label: string
  value: number
}

// Warm greys and the 12px floor of the shared type scale (app/ui-system.css).
const AXIS = { fill: '#6f6a64', fontSize: 12, fontFamily: 'IRANSansWeb' }
const GRID = 'rgba(17, 17, 17, 0.07)'
const CURSOR = { fill: 'rgba(17, 17, 17, 0.04)' }
const INK = CHART_INK
const ACCENT_TINT = CHART_ACCENT_TINT

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
    border: '1px solid rgba(17, 17, 17, 0.09)',
    borderRadius: 10,
    fontSize: 12,
    boxShadow: '0 4px 8px -2px rgba(17, 17, 17, 0.05), 0 16px 32px -8px rgba(17, 17, 17, 0.12)',
    fontFamily: 'IRANSansWeb',
    direction: 'rtl' as const,
  },
  labelStyle: { color: '#6f6a64', fontWeight: 500 },
  itemStyle: { color: '#111111' },
}

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

/** Axis tick that never clips: millions collapse to «۴٫۳ م», the rest stay whole. */
function formatAxisTick(v: number, kind: FormatKind = 'number'): string {
  const money = kind === 'irr' || kind === 'toman' || kind === 'compact-irr'
  const n = (Number(v) || 0) / (money ? 10 : 1)
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} م`
  if (kind === 'usd') return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  return n.toLocaleString('fa-IR', { maximumFractionDigits: 2 })
}

function ChartHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h3 className="ui-h3">{title}</h3>
      {subtitle && <p className="ui-caption mt-0.5">{subtitle}</p>}
    </div>
  )
}

const CHART_CARD = 'spatial-surface min-w-0 rounded-card p-4 sm:p-6'

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
  color = INK,
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
    <div className={CHART_CARD}>
      <ChartHead title={title} subtitle={subtitle} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {variant === 'area' ? (
            <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 5" />
              <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" tickFormatter={formatDayTick} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} width={52} allowDecimals={format === 'usd'} tickFormatter={(v: number) => formatAxisTick(v, format)} />
              <Tooltip {...TOOLTIP} formatter={(v) => [formatValue(Number(v), format), title]} labelFormatter={formatDayTick} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradId})`}
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 5, fill: color, strokeWidth: 2, stroke: '#fff' }}
              />
            </AreaChart>
          ) : variant === 'line' ? (
            <LineChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 5" />
              <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" tickFormatter={formatDayTick} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} width={52} allowDecimals={format === 'usd'} tickFormatter={(v: number) => formatAxisTick(v, format)} />
              <Tooltip {...TOOLTIP} formatter={(v) => [formatValue(Number(v), format), title]} labelFormatter={formatDayTick} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                isAnimationActive={false}
                dot={{ r: 2.5, fill: color }}
                activeDot={{ r: 5, fill: color }}
              />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 5" />
              <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" tickFormatter={formatDayTick} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} width={52} allowDecimals={format === 'usd'} tickFormatter={(v: number) => formatAxisTick(v, format)} />
              <Tooltip {...TOOLTIP} cursor={CURSOR} formatter={(v) => [formatValue(Number(v), format), title]} labelFormatter={formatDayTick} />
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
  format = 'number',
}: {
  title: string
  subtitle?: string
  data: NamedPoint[]
  height?: number
  centerLabel?: string
  centerValue?: string | number
  /** How legend/tooltip values are rendered: plain counts or Toman amounts. */
  format?: 'number' | 'irr'
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const fmt = (v: number) => formatValue(v, format === 'irr' ? 'irr' : 'number')

  return (
    <div className={CHART_CARD}>
      <ChartHead title={title} subtitle={subtitle} />
      {/* Phones stack the ring over its legend; from sm they sit side by side. */}
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
        <div className="relative aspect-square w-40 shrink-0 sm:w-[var(--donut)]" style={{ '--donut': `${height}px` } as React.CSSProperties}>
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
                  `${fmt(Number(v))} (${total > 0 ? Math.round((Number(v) / total) * 100) : 0}٪)`,
                  n,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          {centerValue !== undefined && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold tabular-nums text-[var(--text-primary)] sm:text-xl">
                {typeof centerValue === 'number' ? centerValue.toLocaleString('fa-IR') : centerValue}
              </span>
              {centerLabel && <span className="text-[12px] text-[var(--text-muted)]">{centerLabel}</span>}
            </div>
          )}
        </div>
        <ul className="w-full min-w-0 flex-1 space-y-2.5">
          {data.map((d, i) => (
            <li key={d.label} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="truncate text-[var(--text-secondary)]">{d.label}</span>
              <span className="ms-auto whitespace-nowrap font-medium tabular-nums text-[var(--text-primary)]">
                {fmt(d.value)}
              </span>
              <span className="w-10 text-end tabular-nums text-[var(--text-muted)]">
                {total > 0 ? Math.round((d.value / total) * 100) : 0}٪
              </span>
            </li>
          ))}
          {data.length === 0 && <li className="text-xs text-[var(--text-muted)]">داده‌ای نیست</li>}
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
  color = INK,
}: {
  title: string
  subtitle?: string
  data: NamedPoint[]
  format?: FormatKind
  color?: string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))

  return (
    <div className={CHART_CARD}>
      <ChartHead title={title} subtitle={subtitle} />
      <ul className="space-y-3">
        {data.map((d, i) => (
          <li key={i}>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-[var(--text-secondary)]">{d.label}</span>
              <span className="shrink-0 font-medium tabular-nums text-[var(--text-primary)]">
                {formatValue(d.value, format)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
              <div
                className="h-full rounded-full"
                style={{ width: `${(d.value / max) * 100}%`, background: color }}
              />
            </div>
          </li>
        ))}
        {data.length === 0 && <li className="py-4 text-center text-xs text-[var(--text-muted)]">داده‌ای نیست</li>}
      </ul>
    </div>
  )
}

/** Monthly bar chart for revenue/payment/user trends over N months. */
export function MonthlyBarChart({
  title,
  subtitle,
  data,
  color = INK,
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
    <div className={CHART_CARD}>
      <ChartHead title={title} subtitle={subtitle} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 5" />
            <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" tickFormatter={formatMonthTick} />
            <YAxis
              tick={AXIS}
              axisLine={false}
              tickLine={false}
              width={56}
              allowDecimals={false}
              tickFormatter={(v: number) => formatAxisTick(v, format)}
            />
            <Tooltip
              {...TOOLTIP}
              cursor={CURSOR}
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
    <div className={CHART_CARD}>
      <ChartHead title={title} subtitle={subtitle} />

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-[var(--text-secondary)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#111]" />
          سود خالص (پس از کسر هزینه AI)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ACCENT_TINT }} />
          هزینه OpenRouter
        </span>
        <span className="text-[var(--text-muted)]">
          مجموع اعتبار کسر شده: {formatValue(grossTotal, 'irr')}
        </span>
      </div>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 5" />
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
              width={56}
              allowDecimals={false}
              tickFormatter={(v: number) => formatAxisTick(v, 'irr')}
            />
            <Tooltip
              {...TOOLTIP}
              cursor={CURSOR}
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
              fill={INK}
              radius={[0, 0, 0, 0]}
              isAnimationActive={false}
              barSize={26}
            />
            <Bar
              dataKey="cost"
              stackId="rev"
              fill={ACCENT_TINT}
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
