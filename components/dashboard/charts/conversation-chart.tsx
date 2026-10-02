'use client'

import Link from 'next/link'
import { useLocale } from 'next-intl'
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
  /** Optional breakdown surfaced on /analytics: resolved + handed-off counts. */
  resolved?: number
  handoff?: number
}

/**
 * Monochrome area chart for a daily metric trend. When the data carries the
 * optional `resolved` / `handoff` breakdown (the analytics page), the two
 * series are layered on top of the ink "total" area so the on-chart legend
 * matches what is actually drawn.
 *
 * The mount animation is disabled: the chart paints instantly instead of
 * drawing for ~1.5s, which reads as faster and never fights
 * prefers-reduced-motion (a JS animation the CSS kill-switch can't stop).
 */
export function ConversationChart({
  data,
  empty,
}: {
  data: TrendPoint[]
  /** Copy (and an optional next step) for a window with no activity at all. */
  empty?: { title?: string; hint?: string; action?: { href: string; label: string } }
}) {
  const locale = useLocale()
  const fa = locale === 'fa'
  const numberLocale = fa ? 'fa-IR' : 'en-US'

  const peak = Math.max(0, ...data.map((point) => point.value))
  const domainMax = Math.max(1, peak)
  const hasResolved = data.some((point) => typeof point.resolved === 'number')
  const hasHandoff = data.some((point) => typeof point.handoff === 'number')

  const seriesName = (key: 'total' | 'resolved' | 'handoff') =>
    fa
      ? { total: 'کل گفتگوها', resolved: 'حل‌شده', handoff: 'تحویل اپراتور' }[key]
      : { total: 'Total', resolved: 'Resolved', handoff: 'Handed off' }[key]

  // No conversations in the window: keep the axes so the card still reads as a
  // chart, and say when it fills up instead of drawing a flat line at zero.
  if (peak === 0) {
    return (
      <div className="relative grid h-[12.5rem] w-full place-items-center sm:h-60">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-5 top-2 border-b border-dashed border-[var(--border-strong)] [background:repeating-linear-gradient(to_bottom,transparent_0,transparent_calc(25%_-_1px),rgba(17,17,17,0.06)_calc(25%_-_1px),rgba(17,17,17,0.06)_25%)]"
        />
        <div className="relative max-w-xs rounded-xl bg-white px-4 py-2 text-center">
          <p className="text-sm font-medium text-[var(--text-primary)]">{empty?.title ?? (fa ? 'هنوز داده‌ای برای این بازه نیست' : 'Nothing in this period yet')}</p>
          <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">{empty?.hint ?? (fa ? 'با اولین فعالیت، روند همین‌جا رسم می‌شود.' : 'The trend is drawn here from the first activity.')}</p>
          {empty?.action && (
            <Link
              href={empty.action.href}
              className="mt-2 inline-flex min-h-9 items-center justify-center rounded-control border border-[var(--border-default)] bg-white px-3.5 text-[13px] font-medium text-[var(--text-primary)] shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--border-hover)]"
            >
              {empty.action.label}
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="h-[12.5rem] w-full sm:h-60"
      role="img"
      aria-label={fa ? `روند ${data.length} روز اخیر؛ بیشترین مقدار ${peak.toLocaleString(numberLocale)}` : `Trend across ${data.length} points; peak value ${peak}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--ink-rgb))" stopOpacity={0.18} />
            <stop offset="100%" stopColor="rgb(var(--ink-rgb))" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="trendFillResolved" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.16} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="trendFillHandoff" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.14} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
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
          formatter={(value, name) => [
            Number(value ?? 0).toLocaleString(numberLocale),
            typeof name === 'string' && name ? name : fa ? 'تعداد' : 'Count',
          ]}
        />
        <Area
          type="monotone"
          dataKey="value"
          name={seriesName('total')}
          stroke="rgb(var(--ink-rgb))"
          strokeWidth={1.5}
          fill="url(#trendFill)"
          dot={false}
          isAnimationActive={false}
        />
        {hasResolved && (
          <Area
            type="monotone"
            dataKey="resolved"
            name={seriesName('resolved')}
            stroke="#10b981"
            strokeWidth={1.5}
            fill="url(#trendFillResolved)"
            dot={false}
            isAnimationActive={false}
          />
        )}
        {hasHandoff && (
          <Area
            type="monotone"
            dataKey="handoff"
            name={seriesName('handoff')}
            stroke="#f59e0b"
            strokeWidth={1.5}
            fill="url(#trendFillHandoff)"
            dot={false}
            isAnimationActive={false}
          />
        )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
