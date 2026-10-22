'use client'

import { BarChart3, CalendarCheck2, GraduationCap, ShoppingBag, UserCheck, Users } from 'lucide-react'
import type { AutomationReport } from '@/lib/instagram/automation-report'
import { cn } from '@/lib/utils'

type EntryType = 'DIRECT_MESSAGE' | 'COMMENT' | 'STORY'

/** "People" counts everyone who set a scenario off, so the label names what they did. */
function triggeredLabel(type: EntryType, fa: boolean) {
  if (type === 'COMMENT') return fa ? 'نفر کامنت گذاشتند' : 'people commented'
  if (type === 'STORY') return fa ? 'نفر به استوری واکنش دادند' : 'people reacted to a story'
  return fa ? 'نفر پیام دادند' : 'people messaged'
}

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
 * Above one entry's scenarios: what that entry's scenarios achieved together in
 * 30 days — people who set them off → ordered / booked / enrolled. A total only says something a card does not once two scenarios
 * have run, so with fewer it renders nothing.
 */
export function AutomationsReportSummary({
  fa,
  type,
  reports,
  names,
}: {
  fa: boolean
  type: EntryType
  reports: readonly AutomationReport[]
  names: Record<string, string>
}) {
  const list = reports.filter((report) => report.runs > 0)
  if (list.length < 2) return null
  const people = sum(list, 'people')
  const reached = sum(list, 'reached') || people
  const orders = sum(list, 'orders')
  const bookings = sum(list, 'bookings')
  const enrollments = sum(list, 'enrollments')
  const gated = sum(list, 'gated')
  const confirmed = sum(list, 'followConfirmed')
  const results = (report: AutomationReport) => report.orders + report.bookings + report.enrollments
  const best = [...list].sort((a, b) => results(b) - results(a) || b.engaged - a.engaged)[0]

  const tiles = [
    { key: 'people', Icon: Users, label: triggeredLabel(type, fa), value: people, hint: null as string | null },
    ...(orders ? [{ key: 'orders', Icon: ShoppingBag, label: fa ? 'سفارش دادند' : 'Ordered', value: orders, hint: pct(orders, reached, fa) }] : []),
    ...(bookings ? [{ key: 'bookings', Icon: CalendarCheck2, label: fa ? 'نوبت گرفتند' : 'Booked', value: bookings, hint: pct(bookings, reached, fa) }] : []),
    ...(enrollments ? [{ key: 'enrollments', Icon: GraduationCap, label: fa ? 'ثبت‌نام کردند' : 'Enrolled', value: enrollments, hint: pct(enrollments, reached, fa) }] : []),
    ...(gated ? [{ key: 'gate', Icon: UserCheck, label: fa ? 'نفر فالو را تأیید کردند' : 'confirmed the follow', value: confirmed, hint: fa ? `از ${fmt(gated, fa)} نفر` : `of ${gated}` }] : []),
  ]

  // One quiet line of figures above the scenarios; the list is the page.
  return (
    <section className="px-1" aria-label={fa ? 'جمع سناریوهای این ورودی در ۳۰ روز گذشته' : 'This entry, all scenarios, last 30 days'}>
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
          <span>{fa ? `جمع ${fmt(list.length, fa)} سناریو · ۳۰ روز گذشته` : `${list.length} scenarios · last 30 days`}</span>
        </div>
      </dl>
    </section>
  )
}

/** Compact per-scenario line on its card. */
export function AutomationReportStrip({ fa, type, report }: { fa: boolean; type: EntryType; report?: AutomationReport }) {
  if (!report || !report.runs) {
    return <p className="text-[12px] text-[var(--text-muted)]">{fa ? 'در ۳۰ روز گذشته اجرا نشده' : 'No runs in the last 30 days'}</p>
  }
  const items = [
    { key: 'people', value: fmt(report.people, fa), label: triggeredLabel(type, fa) },
    ...(report.gated ? [{ key: 'gate', value: fa ? `${fmt(report.followConfirmed, fa)} از ${fmt(report.gated, fa)}` : `${report.followConfirmed} of ${report.gated}`, label: fa ? 'نفر فالو را تأیید کردند' : 'confirmed the follow' }] : []),
    ...(report.orders ? [{ key: 'orders', value: fmt(report.orders, fa), label: fa ? 'سفارش' : 'orders' }] : []),
    ...(report.bookings ? [{ key: 'bookings', value: fmt(report.bookings, fa), label: fa ? 'نوبت' : 'bookings' }] : []),
    ...(report.enrollments ? [{ key: 'enrollments', value: fmt(report.enrollments, fa), label: fa ? 'ثبت‌نام' : 'enrolled' }] : []),
  ]
  return (
    <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-[var(--text-secondary)]">
      <BarChart3 className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden />
      {items.map((item, index) => (
        <span key={item.key} className={cn('tabular-nums', index > 0 && 'before:me-2.5 before:text-[var(--text-hint)] before:content-["·"]')}>
          <b className="font-bold text-[var(--text-primary)]">{item.value}</b> {item.label}
        </span>
      ))}
      <span className="text-[var(--text-muted)] before:me-2.5 before:text-[var(--text-hint)] before:content-['·']">{fa ? '۳۰ روز گذشته' : 'last 30 days'}</span>
      {report.failed > 0 && <span className="text-amber-700">{fa ? `· ${fmt(report.failed, fa)} ناموفق` : `· ${report.failed} failed`}</span>}
    </p>
  )
}
