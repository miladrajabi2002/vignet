'use client'

import { BarChart3, CalendarCheck2, GraduationCap, MessagesSquare, ShoppingBag, UserCheck, Users } from 'lucide-react'
import type { AutomationReport, AutomationReportMap } from '@/lib/instagram/automation-report'
import { cn } from '@/lib/utils'

function fmt(value: number, fa: boolean) {
  return value.toLocaleString(fa ? 'fa-IR' : 'en-US')
}

function pct(part: number, whole: number, fa: boolean) {
  if (!whole) return null
  return `${fmt(Math.round((part / whole) * 100), fa)}${fa ? '٪' : '%'}`
}

function sum(reports: readonly AutomationReport[], key: keyof Omit<AutomationReport, 'automationId' | 'lastRunAt'>) {
  return reports.reduce((total, report) => total + report[key], 0)
}

/**
 * Top of the Instagram workspace: what all automations achieved in 30 days,
 * as a funnel — people reached → kept talking → ordered / booked / enrolled —
 * plus the automation that brought the most results.
 */
export function AutomationsReportSummary({
  fa,
  reports,
  names,
}: {
  fa: boolean
  reports: AutomationReportMap
  names: Record<string, string>
}) {
  const list = Object.values(reports)
  const people = sum(list, 'people')
  if (!people) {
    return (
      <section className="spatial-surface flex items-center gap-3 rounded-card p-4 sm:p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--bg-surface)] text-[var(--text-secondary)]"><BarChart3 className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--text-primary)]">{fa ? 'گزارش اتوماسیون‌ها' : 'Automation report'}</p>
          <p className="mt-0.5 text-[12.5px] leading-5 text-[var(--text-muted)]">
            {fa ? 'از اولین اجرای هر سناریو، اینجا می‌بینید به چند نفر رسید، چند نفر ادامه دادند و چند سفارش یا رزرو آورد.' : 'After the first run you will see how many people each scenario reached and what they did next.'}
          </p>
        </div>
      </section>
    )
  }
  const reached = sum(list, 'reached') || people
  const engaged = sum(list, 'engaged')
  const orders = sum(list, 'orders')
  const bookings = sum(list, 'bookings')
  const enrollments = sum(list, 'enrollments')
  const gated = sum(list, 'gated')
  const confirmed = sum(list, 'followConfirmed')
  const results = (report: AutomationReport) => report.orders + report.bookings + report.enrollments
  const best = [...list].sort((a, b) => results(b) - results(a) || b.engaged - a.engaged)[0]

  const tiles = [
    { key: 'people', Icon: Users, label: fa ? 'نفر رسید' : 'People reached', value: people, hint: null as string | null },
    { key: 'engaged', Icon: MessagesSquare, label: fa ? 'گفتگو را ادامه دادند' : 'Kept talking', value: engaged, hint: pct(engaged, reached, fa) },
    ...(orders ? [{ key: 'orders', Icon: ShoppingBag, label: fa ? 'سفارش دادند' : 'Ordered', value: orders, hint: pct(orders, reached, fa) }] : []),
    ...(bookings ? [{ key: 'bookings', Icon: CalendarCheck2, label: fa ? 'نوبت گرفتند' : 'Booked', value: bookings, hint: pct(bookings, reached, fa) }] : []),
    ...(enrollments ? [{ key: 'enrollments', Icon: GraduationCap, label: fa ? 'ثبت‌نام کردند' : 'Enrolled', value: enrollments, hint: pct(enrollments, reached, fa) }] : []),
    ...(gated ? [{ key: 'gate', Icon: UserCheck, label: fa ? 'فالو را تأیید کردند' : 'Confirmed the follow', value: confirmed, hint: fa ? `از ${fmt(gated, fa)} نفر` : `of ${gated}` }] : []),
  ]

  return (
    <section className="spatial-surface rounded-card p-4 sm:p-5" aria-labelledby="ig-report-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="ig-report-title" className="ui-h3">{fa ? 'نتیجه اتوماسیون‌ها' : 'Automation results'}</h2>
          <p className="ui-caption mt-0.5">{fa ? '۳۰ روز گذشته · نتیجه‌ها تا ۷ روز بعد از هر اجرا در همان گفتگو شمرده می‌شوند' : 'Last 30 days · results counted in the same conversation up to 7 days after each run'}</p>
        </div>
        {best && results(best) > 0 && names[best.automationId] && (
          <span className="inline-flex min-h-8 items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-[12px] font-bold text-[var(--text-secondary)]">
            {fa ? `پربازده‌ترین: «${names[best.automationId]}»` : `Top: “${names[best.automationId]}”`}
          </span>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(({ key, Icon, label, value, hint }) => (
          <div key={key} className="rounded-2xl border border-[var(--border-subtle)] bg-white px-3 py-2.5">
            <dt className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]"><Icon className="h-3.5 w-3.5" />{label}</dt>
            <dd className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg font-bold tabular-nums text-[var(--text-primary)]">{fmt(value, fa)}</span>
              {hint && <span className="text-[12px] tabular-nums text-[var(--text-muted)]">{hint}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** Compact per-scenario line on its card. */
export function AutomationReportStrip({ fa, report }: { fa: boolean; report?: AutomationReport }) {
  if (!report || !report.runs) {
    return <p className="text-[12px] text-[var(--text-muted)]">{fa ? 'هنوز اجرا نشده (۳۰ روز)' : 'No runs yet (30 days)'}</p>
  }
  const items = [
    { key: 'people', value: report.people, label: fa ? 'نفر' : 'people' },
    { key: 'engaged', value: report.engaged, label: fa ? 'گفتگو' : 'chats' },
    ...(report.orders ? [{ key: 'orders', value: report.orders, label: fa ? 'سفارش' : 'orders' }] : []),
    ...(report.bookings ? [{ key: 'bookings', value: report.bookings, label: fa ? 'نوبت' : 'bookings' }] : []),
    ...(report.enrollments ? [{ key: 'enrollments', value: report.enrollments, label: fa ? 'ثبت‌نام' : 'enrolled' }] : []),
  ]
  return (
    <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-[var(--text-secondary)]">
      <BarChart3 className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden />
      {items.map((item, index) => (
        <span key={item.key} className={cn('tabular-nums', index > 0 && 'before:me-2.5 before:text-[var(--text-hint)] before:content-["·"]')}>
          <b className="font-bold text-[var(--text-primary)]">{fmt(item.value, fa)}</b> {item.label}
        </span>
      ))}
      {report.failed > 0 && <span className="text-amber-700">{fa ? `· ${fmt(report.failed, fa)} ناموفق` : `· ${report.failed} failed`}</span>}
    </p>
  )
}
