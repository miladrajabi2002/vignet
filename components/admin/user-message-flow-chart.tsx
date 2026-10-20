'use client'

import Link from 'next/link'
import { useId, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
} from 'recharts'
import type { UserMessageFlowRow, UserMessageHour } from '@/lib/admin/charts'
import { CHART_ACCENT, CHART_ACCENT_TINT, CHART_INK, PLAN_COLOR } from './chart-palette'
import { PlanChip, UNANSWERED, fa, rateTone } from './user-message-table'

// Same axis and grid treatment as the other admin charts (trend-chart.tsx).
const AXIS = { fill: '#6f6a64', fontSize: 12, fontFamily: 'IRANSansWeb' }
const GRID = 'rgba(17, 17, 17, 0.07)'
/** Iris 300: the incoming area's edge, so the agent's iris line stays the loudest mark. */
const INCOMING_EDGE = '#b9adff'
/** Users that get their own chip; the rest are one menu away. */
const CHIP_LIMIT = 8
const ALL = '__all__'

interface Point extends UserMessageHour {
  hour: string
  unanswered: number
}

interface Selection {
  name: string
  row: UserMessageFlowRow | null
  conversations: number
  incoming: number
  agent: number
  automation: number
  unanswered: number
  rate: number
  points: Point[]
}

function select(hours: string[], rows: UserMessageFlowRow[], id: string): Selection {
  const row = id === ALL ? null : rows.find((r) => r.workspaceId === id) ?? null
  const source = row ? [row] : rows
  const points = hours.map((hour, i) => {
    const p = { hour, incoming: 0, agent: 0, automation: 0, unanswered: 0 }
    for (const r of source) {
      const h = r.hours[i]
      if (!h) continue
      p.incoming += h.incoming
      p.agent += h.agent
      p.automation += h.automation
    }
    p.unanswered = Math.max(0, p.incoming - p.agent - p.automation)
    return p
  })
  const sum = (k: 'conversations' | 'incoming' | 'agent' | 'automation' | 'unanswered') => source.reduce((s, r) => s + r[k], 0)
  const incoming = sum('incoming')
  const answered = sum('agent') + sum('automation')
  return {
    name: row ? row.workspaceName : 'همه کاربران',
    row,
    conversations: sum('conversations'),
    incoming,
    agent: sum('agent'),
    automation: sum('automation'),
    unanswered: sum('unanswered'),
    rate: incoming > 0 ? Math.round((answered / incoming) * 100) : 100,
    points,
  }
}

function FlowTooltip({ active, payload, label }: { active?: boolean; payload?: { payload: Point }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const items = [
    { label: 'پیام ورودی', value: p.incoming, color: INCOMING_EDGE },
    { label: 'پاسخ ایجنت', value: p.agent, color: CHART_ACCENT },
    { label: 'پاسخ اتوماسیون', value: p.automation, color: CHART_INK },
    { label: 'بی‌پاسخ', value: p.unanswered, color: UNANSWERED },
  ]
  return (
    <div
      dir="rtl"
      className="min-w-[10.5rem] rounded-[10px] border border-[rgba(17,17,17,0.09)] bg-white px-3 py-2 text-[12px]"
      style={{ boxShadow: '0 4px 8px -2px rgba(17, 17, 17, 0.05), 0 16px 32px -8px rgba(17, 17, 17, 0.12)' }}
    >
      <p className="mb-1 font-medium text-[#6f6a64]">ساعت {label}</p>
      {items.map((item) => (
        <p key={item.label} className="flex items-center justify-between gap-4 leading-6">
          <span className="inline-flex items-center gap-1.5 text-[#55524c]">
            <span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{ background: item.color }} />
            {item.label}
          </span>
          <strong className="tabular-nums text-[#111]">{fa(item.value)}</strong>
        </p>
      ))}
    </div>
  )
}

function UserChip({ pressed, onClick, dot, label, count }: { pressed: boolean; onClick: () => void; dot?: string; label: string; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
        pressed
          ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white'
          : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
      }`}
    >
      {dot && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />}
      <span className="truncate">{label}</span>
      <span className="shrink-0 tabular-nums opacity-60">{fa(count)}</span>
    </button>
  )
}

/**
 * The 24-hour message flow, hour by hour, for everyone together or for one
 * user picked from the chips: incoming messages (pale iris area), agent
 * replies (iris) and automation replies (dashed ink), the same colours as the
 * table above, with a summary beside it.
 */
export function UserMessageFlowChart({
  title,
  subtitle,
  hours,
  rows,
  height = 260,
}: {
  title: string
  subtitle?: string
  hours: string[]
  rows: UserMessageFlowRow[]
  height?: number
}) {
  const [selected, setSelected] = useState<string>(ALL)
  const gradientId = `user-flow-${useId().replace(/:/g, '')}`
  const view = useMemo(() => select(hours, rows, selected), [hours, rows, selected])
  const chipRows = rows.slice(0, CHIP_LIMIT)
  const menuRows = rows.slice(CHIP_LIMIT)
  const peak = view.points.reduce<Point | null>((best, p) => (p.incoming > (best?.incoming ?? 0) ? p : best), null)
  const share = (n: number) => (view.incoming > 0 ? (n / view.incoming) * 100 : 0)

  return (
    <div className="spatial-surface min-w-0 rounded-card p-4 sm:p-6">
      <div className="mb-4">
        <h3 className="ui-h3">{title}</h3>
        {subtitle && <p className="ui-caption mt-0.5">{subtitle}</p>}
      </div>

      {rows.length > 0 && (
        <div role="group" aria-label="انتخاب کاربر" className="mb-4 flex flex-wrap items-center gap-1.5">
          <UserChip pressed={selected === ALL} onClick={() => setSelected(ALL)} label="همه" count={rows.reduce((s, r) => s + r.incoming, 0)} />
          {chipRows.map((r) => (
            <UserChip
              key={r.workspaceId}
              pressed={selected === r.workspaceId}
              onClick={() => setSelected(r.workspaceId)}
              dot={PLAN_COLOR[r.plan]}
              label={r.workspaceName}
              count={r.incoming}
            />
          ))}
          {menuRows.length > 0 && (
            <select
              aria-label="سایر کاربران"
              value={menuRows.some((r) => r.workspaceId === selected) ? selected : ''}
              onChange={(e) => e.target.value && setSelected(e.target.value)}
              className="rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1 text-[12px] text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <option value="">سایر کاربران ({fa(menuRows.length)})</option>
              {menuRows.map((r) => (
                <option key={r.workspaceId} value={r.workspaceId}>
                  {r.workspaceName} · {fa(r.incoming)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: CHART_ACCENT_TINT, boxShadow: `inset 0 0 0 1px ${INCOMING_EDGE}` }} />
              پیام ورودی
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-0.5 w-3.5 rounded-full" style={{ background: CHART_ACCENT }} />
              پاسخ ایجنت
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="w-3.5 border-t-2 border-dashed" style={{ borderColor: CHART_INK }} />
              پاسخ اتوماسیون
            </span>
          </div>
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={view.points} margin={{ top: 10, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_ACCENT_TINT} stopOpacity={0.7} />
                    <stop offset="100%" stopColor={CHART_ACCENT_TINT} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 5" />
                <XAxis dataKey="hour" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} width={40} allowDecimals={false} tickFormatter={(v: number) => fa(v)} />
                <Tooltip content={<FlowTooltip />} cursor={{ stroke: 'rgba(17, 17, 17, 0.15)' }} />
                <Area
                  type="monotone"
                  dataKey="incoming"
                  stroke={INCOMING_EDGE}
                  strokeWidth={1.5}
                  fill={`url(#${gradientId})`}
                  isAnimationActive={false}
                  dot={false}
                  activeDot={{ r: 4, fill: INCOMING_EDGE, strokeWidth: 2, stroke: '#fff' }}
                />
                <Line
                  type="monotone"
                  dataKey="agent"
                  stroke={CHART_ACCENT}
                  strokeWidth={2}
                  isAnimationActive={false}
                  dot={false}
                  activeDot={{ r: 5, fill: CHART_ACCENT, strokeWidth: 2, stroke: '#fff' }}
                />
                <Line
                  type="monotone"
                  dataKey="automation"
                  stroke={CHART_INK}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  isAnimationActive={false}
                  dot={false}
                  activeDot={{ r: 4, fill: CHART_INK, strokeWidth: 2, stroke: '#fff' }}
                />
                {peak && <ReferenceDot x={peak.hour} y={peak.incoming} r={4} fill={INCOMING_EDGE} stroke="#fff" strokeWidth={2} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <aside aria-label={`خلاصه ${view.name}`} className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4 lg:border-s lg:border-t-0 lg:ps-5 lg:pt-0">
          <div className="flex flex-col items-start gap-1">
            {view.row?.ownerId ? (
              <Link
                href={`/admin/users/${view.row.ownerId}`}
                className="max-w-full truncate text-sm font-bold text-[var(--text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                {view.name}
              </Link>
            ) : (
              <span className="max-w-full truncate text-sm font-bold text-[var(--text-primary)]">{view.name}</span>
            )}
            {view.row ? (
              <PlanChip plan={view.row.plan} active={view.row.planActive} />
            ) : (
              <span className="text-[12px] text-[var(--text-muted)]">{fa(rows.length)} کاربر با پیام در ۲۴ ساعت اخیر</span>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-[12px] text-[var(--text-muted)]">سهم پاسخ‌ها</span>
              <span className={`rounded-full px-2 py-px text-[12px] font-bold tabular-nums ${rateTone(view.rate)}`}>{fa(view.rate)}٪ پاسخ</span>
            </div>
            <div
              role="img"
              aria-label={`ایجنت ${fa(view.agent)}، اتوماسیون ${fa(view.automation)}، بی‌پاسخ ${fa(view.unanswered)}`}
              className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-[var(--bg-muted)]"
            >
              {view.agent > 0 && <span style={{ width: `${share(view.agent)}%`, background: CHART_ACCENT }} />}
              {view.automation > 0 && <span style={{ width: `${share(view.automation)}%`, background: CHART_INK }} />}
              {view.unanswered > 0 && <span style={{ width: `${share(view.unanswered)}%`, background: UNANSWERED }} />}
            </div>
          </div>

          <dl className="divide-y divide-[var(--border-subtle)] text-[13px]">
            {[
              { label: 'گفتگو', value: view.conversations },
              { label: 'پیام ورودی', value: view.incoming, color: CHART_ACCENT_TINT },
              { label: 'پاسخ ایجنت', value: view.agent, color: CHART_ACCENT },
              { label: 'پاسخ اتوماسیون', value: view.automation, color: CHART_INK },
              { label: 'بی‌پاسخ', value: view.unanswered, color: UNANSWERED, alert: view.unanswered > 0 },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 py-1.5">
                <dt className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
                  {item.color && <span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{ background: item.color }} />}
                  {item.label}
                </dt>
                <dd className={`font-bold tabular-nums ${item.alert ? 'text-[#dc2626]' : 'text-[var(--text-primary)]'}`}>{fa(item.value)}</dd>
              </div>
            ))}
          </dl>

          {peak && (
            <p className="rounded-control bg-[var(--bg-surface)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">
              شلوغ‌ترین ساعت: <strong className="tabular-nums text-[var(--text-primary)]">{peak.hour}</strong> با{' '}
              <strong className="tabular-nums text-[var(--text-primary)]">{fa(peak.incoming)}</strong> پیام
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
