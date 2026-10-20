'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { UserMessageFlowRow, UserMessageHour } from '@/lib/admin/charts'
import { CHART_ACCENT, CHART_ACCENT_TINT, CHART_GREY, CHART_INK, PLAN_COLOR } from './chart-palette'

type Plan = UserMessageFlowRow['plan']
type SortKey = 'name' | 'plan' | 'conversations' | 'incoming' | 'agent' | 'automation' | 'unanswered' | 'rate'

/** Not a series colour: the share of messages nobody answered. */
export const UNANSWERED = '#dcd7cf'
const PLAN_ORDER: Plan[] = ['BUSINESS', 'PRO', 'STARTER', 'TRIAL']
export const PLAN_LABEL: Record<Plan, string> = {
  BUSINESS: 'بیزینس',
  PRO: 'حرفه‌ای',
  STARTER: 'استارتر',
  TRIAL: 'آزمایشی',
}
/** Solid chips in the plan's own colour, so a plan reads the same as in the plan mix and the avatar rings. */
const PLAN_CHIP: Record<Plan, { background: string; color: string }> = {
  BUSINESS: { background: PLAN_COLOR.BUSINESS, color: '#ffffff' },
  PRO: { background: PLAN_COLOR.PRO, color: '#ffffff' },
  STARTER: { background: '#e6e1ff', color: '#3d27a6' },
  TRIAL: { background: '#eeeeec', color: '#55524c' },
}
const COLLAPSED_ROWS = 10
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'incoming', label: 'پیام ورودی' },
  { key: 'conversations', label: 'گفتگو' },
  { key: 'agent', label: 'پاسخ ایجنت' },
  { key: 'automation', label: 'پاسخ اتوماسیون' },
  { key: 'unanswered', label: 'بی‌پاسخ' },
  { key: 'rate', label: 'نرخ پاسخ' },
  { key: 'plan', label: 'پلن' },
  { key: 'name', label: 'نام' },
]

export const fa = (n: number) => n.toLocaleString('fa-IR')

export function rateTone(rate: number): string {
  if (rate >= 80) return 'bg-[#e7f5ec] text-[#15803d]'
  if (rate >= 60) return 'bg-[#fdf1e2] text-[#b45309]'
  return 'bg-[#fdeaea] text-[#dc2626]'
}

export function PlanChip({ plan, active }: { plan: Plan; active: boolean }) {
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span
        className="inline-flex items-center whitespace-nowrap rounded-chip px-2 py-0.5 text-[12px] font-semibold leading-5"
        style={PLAN_CHIP[plan]}
      >
        {PLAN_LABEL[plan]}
      </span>
      {!active && <span className="whitespace-nowrap text-[11px] font-medium text-[#dc2626]">پایان‌یافته</span>}
    </span>
  )
}

function Sparkline({ hours }: { hours: UserMessageHour[] }) {
  const w = 110
  const h = 30
  const max = Math.max(1, ...hours.map((p) => p.incoming))
  const x = (i: number) => ((i / Math.max(1, hours.length - 1)) * w).toFixed(1)
  const y = (v: number) => (h - 2 - (v / max) * (h - 4)).toFixed(1)
  const path = (pick: (p: UserMessageHour) => number) =>
    hours.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(pick(p))}`).join('')
  const incoming = path((p) => p.incoming)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="block" style={{ direction: 'ltr' }} aria-hidden="true">
      <path d={`${incoming}L${w},${h}L0,${h}Z`} fill={CHART_ACCENT} fillOpacity={0.14} />
      <path d={incoming} fill="none" stroke={CHART_ACCENT} strokeWidth={1.5} />
      <path d={path((p) => p.agent + p.automation)} fill="none" stroke={CHART_INK} strokeWidth={1} strokeOpacity={0.7} />
    </svg>
  )
}

function Swatch({ color }: { color: string }) {
  return <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
}

const NUMBER_COLUMNS: { key: Exclude<SortKey, 'name' | 'plan' | 'rate'>; label: string; color: string }[] = [
  { key: 'conversations', label: 'گفتگو', color: CHART_GREY },
  { key: 'incoming', label: 'پیام ورودی', color: CHART_ACCENT_TINT },
  { key: 'agent', label: 'پاسخ ایجنت', color: CHART_ACCENT },
  { key: 'automation', label: 'پاسخ اتوماسیون', color: CHART_INK },
  { key: 'unanswered', label: 'بی‌پاسخ', color: UNANSWERED },
]

function SortHeader({
  k,
  sortKey,
  direction,
  onSort,
  children,
}: {
  k: SortKey
  sortKey: SortKey
  direction: 1 | -1
  onSort: (key: SortKey) => void
  children: React.ReactNode
}) {
  const active = k === sortKey
  const Icon = active && direction === 1 ? ArrowUp : ArrowDown
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === 1 ? 'ascending' : 'descending') : undefined}
      className="whitespace-nowrap p-0 text-start text-[12px] font-semibold text-[var(--text-muted)]"
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 rounded-control px-2 py-2 transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${active ? 'text-[var(--text-primary)]' : ''}`}
      >
        {children}
        <Icon className={`h-3 w-3 ${active ? 'opacity-100' : 'opacity-25'}`} aria-hidden="true" />
      </button>
    </th>
  )
}

/** Phones and narrow panes: one stacked bar per user instead of the wide table. */
function UserBarRow({ row: r, maxIncoming }: { row: UserMessageFlowRow; maxIncoming: number }) {
  const segments = [
    { value: r.agent, color: CHART_ACCENT, label: 'پاسخ ایجنت' },
    { value: r.automation, color: CHART_INK, label: 'پاسخ اتوماسیون' },
    { value: r.unanswered, color: UNANSWERED, label: 'بی‌پاسخ' },
  ].filter((seg) => seg.value > 0)
  const name = r.ownerId ? (
    <Link
      href={`/admin/users/${r.ownerId}`}
      className="truncate text-sm font-semibold text-[var(--text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      {r.workspaceName}
    </Link>
  ) : (
    <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{r.workspaceName}</span>
  )

  return (
    <li className="flex flex-col gap-2 border-t border-[var(--border-subtle)] py-3 first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col items-start gap-1">
          {name}
          <PlanChip plan={r.plan} active={r.planActive} />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="inline-flex items-baseline gap-1">
            <strong className="text-[15px] font-bold tabular-nums text-[var(--text-primary)]">{fa(r.incoming)}</strong>
            <span className="text-[12px] text-[var(--text-muted)]">پیام</span>
          </span>
          <span className={`inline-block rounded-full px-2 py-px text-[12px] font-bold tabular-nums ${rateTone(r.rate)}`}>
            {fa(r.rate)}٪ پاسخ
          </span>
        </div>
      </div>

      <div
        role="img"
        aria-label={`${fa(r.incoming)} پیام: ${segments.map((seg) => `${seg.label} ${fa(seg.value)}`).join('، ')}`}
        className="flex h-3 gap-0.5 overflow-hidden rounded-full"
        style={{ width: `${Math.max(4, (r.incoming / maxIncoming) * 100).toFixed(1)}%` }}
      >
        {segments.map((seg) => (
          <span key={seg.label} className="h-full min-w-[3px]" style={{ flexGrow: seg.value, flexBasis: 0, background: seg.color }} />
        ))}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] tabular-nums text-[var(--text-muted)]">
        <span>{fa(r.conversations)} گفتگو</span>
        <span>ایجنت {fa(r.agent)}</span>
        <span>اتوماسیون {fa(r.automation)}</span>
        {r.unanswered > 0 && <span className="text-[#dc2626]">بی‌پاسخ {fa(r.unanswered)}</span>}
      </div>
    </li>
  )
}

/**
 * Every user's last 24 hours in one sortable table: conversations, customer
 * messages, and who answered them (the agent or an Instagram automation).
 */
export function UserMessageTable({ title, subtitle, rows }: { title: string; subtitle?: string; rows: UserMessageFlowRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('incoming')
  const [direction, setDirection] = useState<1 | -1>(-1)
  const [planFilter, setPlanFilter] = useState<Plan | 'ALL'>('ALL')
  const [expanded, setExpanded] = useState(false)

  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, r) => ({
          incoming: sum.incoming + r.incoming,
          agent: sum.agent + r.agent,
          automation: sum.automation + r.automation,
          unanswered: sum.unanswered + r.unanswered,
        }),
        { incoming: 0, agent: 0, automation: 0, unanswered: 0 },
      ),
    [rows],
  )
  const planCounts = useMemo(() => {
    const counts: Record<Plan, number> = { BUSINESS: 0, PRO: 0, STARTER: 0, TRIAL: 0 }
    for (const r of rows) counts[r.plan] += 1
    return counts
  }, [rows])
  const maxOf = useMemo(() => {
    const out = {} as Record<(typeof NUMBER_COLUMNS)[number]['key'], number>
    for (const c of NUMBER_COLUMNS) out[c.key] = Math.max(1, ...rows.map((r) => r[c.key]))
    return out
  }, [rows])

  const sorted = useMemo(() => {
    const filtered = planFilter === 'ALL' ? rows : rows.filter((r) => r.plan === planFilter)
    return [...filtered].sort((a, b) => {
      if (sortKey === 'name') return direction * a.workspaceName.localeCompare(b.workspaceName, 'fa')
      if (sortKey === 'plan') return direction * (PLAN_ORDER.indexOf(b.plan) - PLAN_ORDER.indexOf(a.plan))
      return direction * (a[sortKey] - b[sortKey])
    })
  }, [rows, planFilter, sortKey, direction])
  const visible = expanded ? sorted : sorted.slice(0, COLLAPSED_ROWS)

  function sortBy(key: SortKey) {
    if (key === sortKey) setDirection((d) => (d === 1 ? -1 : 1))
    else {
      setSortKey(key)
      setDirection(key === 'name' ? 1 : -1)
    }
  }

  const headerProps = { sortKey, direction, onSort: sortBy }

  return (
    <div className="spatial-surface min-w-0 rounded-card p-4 sm:p-6">
      <div className="mb-4">
        <h3 className="ui-h3">{title}</h3>
        {subtitle && <p className="ui-caption mt-0.5">{subtitle}</p>}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-[var(--text-secondary)]">
        <span className="inline-flex items-center gap-1.5">
          <Swatch color={CHART_ACCENT_TINT} />
          پیام ورودی: <strong className="tabular-nums text-[var(--text-primary)]">{fa(totals.incoming)}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Swatch color={CHART_ACCENT} />
          پاسخ ایجنت: <strong className="tabular-nums text-[var(--text-primary)]">{fa(totals.agent)}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Swatch color={CHART_INK} />
          پاسخ اتوماسیون: <strong className="tabular-nums text-[var(--text-primary)]">{fa(totals.automation)}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Swatch color={UNANSWERED} />
          بی‌پاسخ: <strong className="tabular-nums text-[var(--text-primary)]">{fa(totals.unanswered)}</strong>
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-xs text-[var(--text-muted)]">در ۲۴ ساعت اخیر پیامی از مشتریان نرسیده است.</p>
      ) : (
        <>
          <div role="group" aria-label="فیلتر پلن" className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
            {(['ALL', ...PLAN_ORDER] as const).map((p) => {
              const count = p === 'ALL' ? rows.length : planCounts[p]
              if (p !== 'ALL' && count === 0) return null
              const pressed = planFilter === p
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => {
                    setPlanFilter(p)
                    setExpanded(false)
                  }}
                  className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                    pressed
                      ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white'
                      : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {p !== 'ALL' && <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: PLAN_COLOR[p] }} />}
                  {p === 'ALL' ? 'همه' : PLAN_LABEL[p]}
                  <span className="tabular-nums opacity-60">{fa(count)}</span>
                </button>
              )
            })}
          </div>

          <div className="mb-1 flex items-center justify-end gap-2 xl:hidden">
            <label htmlFor="user-message-sort" className="text-[12px] text-[var(--text-muted)]">مرتب‌سازی</label>
            <select
              id="user-message-sort"
              value={sortKey}
              onChange={(e) => {
                const key = e.target.value as SortKey
                setSortKey(key)
                setDirection(key === 'name' ? 1 : -1)
              }}
              className="rounded-control border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-1 text-[12px] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>

          <ul className="xl:hidden" aria-label="پیام‌های هر کاربر">
            {visible.map((r) => (
              <UserBarRow key={r.workspaceId} row={r} maxIncoming={maxOf.incoming} />
            ))}
          </ul>

          {/* The table needs ~860px: from xl the content column beside the sidebar has it. */}
          <div className="-mx-1 hidden overflow-x-auto xl:block">
            <table className="w-full min-w-[860px] border-collapse text-[13px]">
              <thead>
                <tr>
                  <SortHeader k="name" {...headerProps}>کاربر</SortHeader>
                  <SortHeader k="plan" {...headerProps}>پلن</SortHeader>
                  {NUMBER_COLUMNS.map((c) => (
                    <SortHeader key={c.key} k={c.key} {...headerProps}>{c.label}</SortHeader>
                  ))}
                  <SortHeader k="rate" {...headerProps}>نرخ پاسخ</SortHeader>
                  <th scope="col" className="whitespace-nowrap px-2 py-2 text-start text-[12px] font-semibold text-[var(--text-muted)]">
                    روند ۲۴ ساعت
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const showOwnerName = Boolean(r.ownerName && r.ownerName !== r.workspaceName)
                  return (
                    <tr key={r.workspaceId} className="transition-colors hover:bg-[var(--bg-surface)]">
                      <td className="border-t border-[var(--border-subtle)] px-2 py-2.5 align-middle">
                        {r.ownerId ? (
                          <Link
                            href={`/admin/users/${r.ownerId}`}
                            className="block max-w-[14rem] truncate font-semibold text-[var(--text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                          >
                            {r.workspaceName}
                          </Link>
                        ) : (
                          <span className="block max-w-[14rem] truncate font-semibold text-[var(--text-primary)]">{r.workspaceName}</span>
                        )}
                        {(showOwnerName || r.ownerPhone) && (
                          <span className="mt-0.5 flex max-w-[14rem] items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
                            {showOwnerName && <span className="truncate">{r.ownerName}</span>}
                            {r.ownerPhone && <bdi dir="ltr" className="shrink-0 tabular-nums">{r.ownerPhone}</bdi>}
                          </span>
                        )}
                      </td>
                      <td className="border-t border-[var(--border-subtle)] px-2 py-2.5 align-middle">
                        <PlanChip plan={r.plan} active={r.planActive} />
                      </td>
                      {NUMBER_COLUMNS.map((c) => (
                        <td key={c.key} className="border-t border-[var(--border-subtle)] px-2 py-2.5 align-middle">
                          <div className="flex min-w-[4rem] flex-col gap-1 tabular-nums">
                            <span className={r[c.key] === 0 ? 'text-[var(--text-hint)]' : 'text-[var(--text-primary)]'}>{fa(r[c.key])}</span>
                            <span className="h-1 rounded-full bg-[var(--bg-muted)]">
                              <span
                                className="block h-full rounded-full"
                                style={{ width: `${((r[c.key] / maxOf[c.key]) * 100).toFixed(1)}%`, background: c.color }}
                              />
                            </span>
                          </div>
                        </td>
                      ))}
                      <td className="border-t border-[var(--border-subtle)] px-2 py-2.5 align-middle">
                        <span className={`inline-block rounded-full px-2 py-px text-[12px] font-bold tabular-nums ${rateTone(r.rate)}`}>
                          {fa(r.rate)}٪
                        </span>
                      </td>
                      <td className="border-t border-[var(--border-subtle)] px-2 py-2.5 align-middle">
                        <Sparkline hours={r.hours} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {sorted.length > COLLAPSED_ROWS && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 w-full rounded-control border border-[var(--border-default)] py-2 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              {expanded ? 'نمایش کمتر' : `نمایش همه (${fa(sorted.length)} کاربر)`}
            </button>
          )}
        </>
      )}
    </div>
  )
}
