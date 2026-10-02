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
      <p className="px-1 text-[12px] leading-5 text-[var(--text-muted)]">
        {fa ? 'از اولین اجرای هر سناریو، اینجا می‌بینید به چند نفر رسید و چند سفارش یا رزرو آورد.' : 'After the first run you will see how many people each scenario reached and what it brought in.'}
      </p>
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

  // One quiet line of figures above the scenarios; the list is the page.
  return (
    <section className="px-1" aria-label={fa ? 'نتیجه اتوماسیون‌ها در ۳۰ روز گذشته' : 'Automation results, last 30 days'}>
      <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[12px] text-[var(--text-muted)]">
        {tiles.map(({ key, label, value, hint }) => (
          <div key={key} className="flex items-baseline gap-1.5">
            <dd className="text-[15px] font-bold tabular-nums text-[var(--text-primary)]">{fmt(value, fa)}</dd>
            <dt>{label}{hint ? ` (${hint})` : ''}</dt>
          </div>
        ))}
        <div className="ms-auto flex flex-wrap items-baseline gap-x-3">
          {best && results(best) > 0 && names[best.automationId] && (
            <span className="font-medium text-[var(--text-secondary)]">{fa ? `پربازده‌ترین: «${names[best.automationId]}»` : `Top: “${names[best.automationId]}”`}</span>
          )}
          <span>{fa ? '۳۰ روز گذشته' : 'Last 30 days'}</span>
        </div>
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
