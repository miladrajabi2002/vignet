import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * User-dashboard Skeleton Screen building blocks — exact mirrors.
 *
 * Every block copies the wrapper classes of its real counterpart in the
 * (dashboard) segment (`components/dashboard/page-header.tsx`,
 * `panel.tsx`, the overview/conversations/agents/contacts/analytics/
 * appointments/billing/products layouts) and replaces dynamic content
 * with Skeleton blocks sized to the real typography, so the swap from
 * skeleton → content causes no layout shift at all. Same mobile-style
 * shimmer (staggered per card) as «تحلیل و بهبود» and the admin panel.
 */

/* ─────────────────────────── shared page header ─────────────────────────── */

/** Mirrors PageHeader: icon square + title + subtitle + action buttons. */
export function DashboardHeaderSkeleton({
  delay = 0,
  actions = 2,
  className,
}: {
  delay?: number
  /** Number of action buttons the real header renders (0-3). */
  actions?: 0 | 1 | 2 | 3
  className?: string
}) {
  return (
    <header className={cn('dashboard-page-header spatial-surface overflow-hidden rounded-[1.5rem] p-5 sm:p-6', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Skeleton delay={delay} className="h-11 w-11 shrink-0 rounded-2xl" />
          <div className="min-w-0 space-y-2">
            <Skeleton delay={delay} className="h-7 w-44 max-w-full rounded-lg" />
            <Skeleton delay={delay} className="h-4 w-56 max-w-full rounded-md" />
          </div>
        </div>
        {actions > 0 && (
          <div className="flex items-center gap-2">
            {Array.from({ length: actions }).map((_, index) => (
              <Skeleton key={index} delay={delay - index * 80} className="h-11 w-32 rounded-xl" />
            ))}
          </div>
        )}
      </div>
    </header>
  )
}

/** Mirrors DashboardPanel: title + subtitle + optional action link + body. */
export function DashboardPanelSkeleton({
  delay = 0,
  action = true,
  rows,
  chartHeight,
  className,
  bodyClassName,
  children,
}: {
  delay?: number
  action?: boolean
  /** Row list body (icon + two lines + trailing value per row). */
  rows?: number
  /** Chart body — one block of the given pixel height. */
  chartHeight?: number
  className?: string
  bodyClassName?: string
  /** Custom body blocks (advanced compositions). */
  children?: React.ReactNode
}) {
  return (
    <section className={cn('spatial-surface min-w-0 overflow-hidden rounded-[1.5rem] p-5 sm:p-6', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton delay={delay} className="h-4 w-44 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3 w-56 max-w-full rounded-md" />
        </div>
        {action && <Skeleton delay={delay} className="h-4 w-20 shrink-0 rounded-md" />}
      </div>
      <div className={bodyClassName}>
        {chartHeight !== undefined ? (
          <Skeleton delay={delay - 60} className="w-full rounded-xl" style={{ height: chartHeight }} />
        ) : rows ? (
          <div className="space-y-3.5">
            {Array.from({ length: rows }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton delay={delay - index * 70} className="h-10 w-10 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton delay={delay - index * 70} className="h-3.5 w-2/5 rounded-md" />
                  <Skeleton delay={delay - index * 70} className="h-3 w-3/5 rounded-md" />
                </div>
                <Skeleton delay={delay - index * 70} className="h-5 w-14 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  )
}

/* ─────────────────────────── overview blocks ─────────────────────────── */

/** Mirrors the dashboard-intro arrival card hero (badge + title + attention rows + CTAs). */
export function ArrivalIntroSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="dashboard-arrival dashboard-intro relative overflow-hidden rounded-[1.75rem] border border-[var(--border-default)] p-5 sm:p-7">
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton delay={delay} className="inline-flex h-7 w-24 items-center rounded-full" />
          <Skeleton delay={delay - 90} className="h-3 w-20 rounded-full" />
        </div>
        <Skeleton delay={delay} className="mt-5 h-3 w-40 rounded-md" />
        <Skeleton delay={delay} className="mt-1.5 h-8 w-72 max-w-full rounded-lg" />
        <Skeleton delay={delay - 90} className="mt-2.5 h-4 w-full max-w-xl rounded-md" />
        <Skeleton delay={delay - 180} className="mt-1.5 h-4 w-2/3 max-w-xl rounded-md" />
        <div className="mt-5 divide-y divide-[var(--border-default)] overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="grid min-h-14 grid-cols-[2.25rem_minmax(0,1fr)_auto_0.875rem] items-center gap-3 px-3.5">
              <Skeleton delay={delay - index * 110} className="h-5 w-5 rounded" />
              <Skeleton delay={delay - index * 110} className="h-3.5 w-28 rounded-md" />
              <Skeleton delay={delay - index * 110} className="h-5 w-10 rounded-lg" />
              <Skeleton delay={delay - index * 110} className="h-3.5 w-3.5 rounded-full" />
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Skeleton delay={delay} className="h-11 w-44 rounded-xl" />
          <Skeleton delay={delay - 110} className="h-11 w-36 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

/** Mirrors the IntelligenceCoreLazy shell (dark hub card, min-h-20rem). */
export function IntelligenceCoreSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="dashboard-arrival dashboard-arrival--core min-h-[20rem] rounded-[1.75rem] border border-[var(--border-default)] bg-white/80 shadow-[var(--shadow-soft)]">
      <div className="m-6">
        <Skeleton delay={delay} className="h-4 w-32 rounded-full" />
        <Skeleton delay={delay - 90} className="mx-auto mt-14 h-24 w-24 rounded-full" />
        <Skeleton delay={delay - 180} className="mx-auto mt-8 h-3 w-44 rounded-full" />
      </div>
    </div>
  )
}

/** Mirrors the Vigento AI copilot card (icon + title + badge + desc + button + prompt pills). */
export function VigentoCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface block overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Skeleton delay={delay} className="h-11 w-11 shrink-0 rounded-2xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton delay={delay} className="h-5 w-28 rounded-md" />
              <Skeleton delay={delay - 90} className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton delay={delay - 180} className="mt-1.5 h-3.5 w-full max-w-2xl rounded-md" />
          </div>
        </div>
        <Skeleton delay={delay - 240} className="h-11 w-40 shrink-0 rounded-xl" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Skeleton delay={delay} className="h-8 w-52 rounded-full" />
        <Skeleton delay={delay - 90} className="h-8 w-44 rounded-full" />
        <Skeleton delay={delay - 180} className="h-8 w-40 rounded-full" />
      </div>
    </div>
  )
}

/** Mirrors OutcomeCard (KPI): label + icon, big value, hint, sparkline. */
export function OutcomeCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="dashboard-card relative overflow-hidden rounded-[1.3rem] border border-[var(--border-default)] bg-white/[0.94] p-4 sm:p-5">
      <div className="relative flex items-center justify-between gap-2">
        <Skeleton delay={delay} className="h-3 w-20 max-w-full rounded-md" />
        <Skeleton delay={delay} className="h-8 w-8 shrink-0 rounded-xl" />
      </div>
      <Skeleton delay={delay} className="relative mt-3 h-8 w-20 max-w-full rounded-lg" />
      <Skeleton delay={delay} className="relative mt-1 h-3 w-24 max-w-full rounded-md" />
      <Skeleton delay={delay - 80} className="relative mt-2 h-7 w-full rounded-md" />
    </div>
  )
}

/** Mirrors a recent-case row: avatar + name/time + channel·count·summary. */
export function RecentCaseRowSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden px-3 py-2.5">
      <Skeleton delay={delay} className="h-10 w-10 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <Skeleton delay={delay} className="h-3.5 w-28 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3 w-16 shrink-0 rounded-full" />
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <Skeleton delay={delay} className="h-4 w-12 rounded-full" />
          <Skeleton delay={delay} className="h-3 w-14 rounded-full" />
          <Skeleton delay={delay} className="h-3 w-20 rounded-full" />
        </div>
      </div>
      <Skeleton delay={delay} className="h-3.5 w-3.5 shrink-0 rounded-full" />
    </div>
  )
}

/** Mirrors a tool module tile: icon + label + arrow. */
export function ModuleTileSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex min-h-14 items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3">
      <Skeleton delay={delay} className="h-9 w-9 shrink-0 rounded-xl" />
      <Skeleton delay={delay} className="h-3.5 w-20 rounded-md" />
      <Skeleton delay={delay - 80} className="ms-auto h-3.5 w-3.5 shrink-0 rounded-full" />
    </div>
  )
}

/** Mirrors the plan & credit panel body: split row + two inset rows. */
export function PlanCreditSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <Skeleton delay={delay} className="h-3 w-16 rounded-md" />
          <Skeleton delay={delay} className="mt-1.5 h-6 w-28 rounded-md" />
        </div>
        <div>
          <Skeleton delay={delay - 90} className="ml-auto h-3 w-14 rounded-md" />
          <Skeleton delay={delay - 90} className="mt-1.5 h-4 w-20 rounded-md" />
          <Skeleton delay={delay - 180} className="mt-1 h-3 w-24 rounded-md" />
        </div>
      </div>
      <div className="spatial-inset mt-4 flex items-center justify-between gap-3 rounded-xl px-3 py-2.5">
        <div>
          <Skeleton delay={delay} className="h-3 w-28 rounded-md" />
          <Skeleton delay={delay} className="mt-1 h-4 w-12 rounded-md" />
        </div>
        <Skeleton delay={delay - 90} className="h-3 w-28 rounded-md" />
      </div>
      <div className="spatial-inset mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <Skeleton delay={delay} className="h-3 w-28 rounded-md" />
          <Skeleton delay={delay} className="mt-1 h-4 w-24 rounded-md" />
        </div>
        <Skeleton delay={delay - 90} className="h-7 w-24 shrink-0 rounded-md" />
      </div>
    </div>
  )
}

/* ─────────────────────────── conversations blocks ─────────────────────────── */

/** Mirrors the sticky filter card: mobile search + filter button, desktop search + selects. */
export function ConversationFiltersSkeleton({ delay = 0, selects = 3 }: { delay?: number; selects?: number }) {
  return (
    <div className="spatial-surface rounded-[1.35rem] p-2.5 shadow-[0_14px_36px_rgba(0,0,0,0.08)] md:rounded-[1.5rem] md:p-4 md:shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 md:hidden">
        <Skeleton delay={delay} className="h-11 min-w-[12rem] flex-1 rounded-xl" />
        <Skeleton delay={delay - 90} className="h-11 w-11 shrink-0 rounded-xl" />
      </div>
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        <Skeleton delay={delay} className="h-11 min-w-[12rem] flex-1 rounded-xl" />
        {Array.from({ length: selects }).map((_, index) => (
          <Skeleton key={index} delay={delay - (index + 1) * 90} className="h-11 min-w-40 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

/** Mirrors the desktop inbox panel header + rows + pagination. */
export function InboxPanelSkeleton({
  delay = 0,
  rows = 6,
  className,
}: {
  delay?: number
  rows?: number
  className?: string
}) {
  return (
    <div className={cn('spatial-surface min-w-0 divide-y divide-[var(--border-subtle)] overflow-hidden rounded-[1.5rem]', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5 sm:px-5">
        <div className="min-w-0 space-y-2">
          <Skeleton delay={delay} className="h-5 w-36 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3 w-48 max-w-full rounded-md" />
        </div>
        <Skeleton delay={delay} className="h-6 w-24 shrink-0 rounded-full" />
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <InboxRowSkeleton key={index} delay={delay - index * 90} />
      ))}
    </div>
  )
}

/** Mirrors a desktop inbox row: avatar + name/handle + last message + status·channel·time·count. */
export function InboxRowSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden px-4 py-3.5 sm:px-5">
      <Skeleton delay={delay} className="h-10 w-10 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <Skeleton delay={delay} className="h-4 w-28 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-5 w-20 max-w-full rounded-full" />
        </div>
        <Skeleton delay={delay} className="mt-1 h-3.5 w-3/4 max-w-full rounded-md" />
      </div>
      <div className="flex max-w-sm shrink-0 flex-row flex-wrap items-center justify-end gap-1.5">
        <Skeleton delay={delay} className="h-5 w-16 rounded-full" />
        <Skeleton delay={delay} className="h-5 w-14 rounded-full" />
        <Skeleton delay={delay} className="h-3 w-14 rounded-full" />
        <Skeleton delay={delay} className="h-3 w-16 rounded-full" />
      </div>
    </div>
  )
}

/** Mirrors the mobile inbox feed header (title + live status pill). */
export function InboxFeedHeaderSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex items-end justify-between gap-3 px-1">
      <div className="min-w-0 space-y-2">
        <Skeleton delay={delay} className="h-5 w-32 rounded-md" />
        <Skeleton delay={delay - 90} className="h-3 w-24 rounded-md" />
      </div>
      <Skeleton delay={delay - 140} className="h-5 w-24 rounded-full" />
    </div>
  )
}

/* ─────────────────────────── agents blocks ─────────────────────────── */

/** Mirrors the agent card: icon + active badge, title, description, stats, sparkline, footer. */
export function AgentCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface flex flex-col rounded-[1.5rem] p-5">
      <div className="flex items-start justify-between">
        <Skeleton delay={delay} className="h-11 w-11 rounded-2xl" />
        <Skeleton delay={delay} className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton delay={delay} className="mt-4 h-5 w-32 max-w-full rounded-md" />
      <Skeleton delay={delay} className="mt-1 h-3.5 w-full rounded-md" />
      <Skeleton delay={delay - 90} className="mt-1 h-3.5 w-2/3 rounded-md" />
      <div className="mt-4 flex items-center gap-3">
        <Skeleton delay={delay} className="h-3.5 w-10 rounded-full" />
        <Skeleton delay={delay - 90} className="h-3.5 w-10 rounded-full" />
        <Skeleton delay={delay - 180} className="h-3.5 w-10 rounded-full" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Skeleton delay={delay} className="h-6 w-28 rounded-md" />
        <Skeleton delay={delay - 90} className="h-3 w-16 rounded-full" />
      </div>
      <div className="mt-4 flex items-center gap-1 border-t border-[var(--border-subtle)] pt-3">
        <Skeleton delay={delay} className="h-6 w-20 rounded-md" />
        <Skeleton delay={delay - 90} className="ms-auto h-3.5 w-14 rounded-full" />
      </div>
    </div>
  )
}

/** Mirrors the agents tip card: icon + bold title + body line. */
export function TipCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <Skeleton delay={delay} className="mt-0.5 h-4 w-4 shrink-0 rounded" />
      <div>
        <Skeleton delay={delay} className="h-4 w-40 max-w-full rounded-md" />
        <Skeleton delay={delay - 90} className="mt-1.5 h-3 w-72 max-w-full rounded-md" />
      </div>
    </div>
  )
}

/* ─────────────────────────── contacts blocks ─────────────────────────── */

/** Mirrors the contacts toolbar: mobile search + filter button; desktop search + selects + view toggle. */
export function ContactsToolbarSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface rounded-[1.35rem] p-2.5 shadow-[0_14px_36px_rgba(0,0,0,0.08)] md:rounded-[1.5rem] md:p-4 md:shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 md:hidden">
        <Skeleton delay={delay} className="h-11 min-w-[12rem] flex-1 rounded-xl" />
        <Skeleton delay={delay - 90} className="h-11 w-11 shrink-0 rounded-xl" />
      </div>
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        <Skeleton delay={delay} className="h-11 min-w-[12rem] flex-1 rounded-xl" />
        <Skeleton delay={delay - 90} className="h-11 min-w-40 rounded-xl" />
        <Skeleton delay={delay - 180} className="h-11 min-w-40 rounded-xl" />
        <div className="flex items-center gap-1 rounded-xl border border-[var(--border-default)] p-1">
          <Skeleton delay={delay - 270} className="h-9 w-16 rounded-lg" />
          <Skeleton delay={delay - 360} className="h-9 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

/** Mirrors the desktop contacts list panel: header + checkbox rows. */
export function ContactsListSkeleton({
  delay = 0,
  rows = 6,
  className,
}: {
  delay?: number
  rows?: number
  className?: string
}) {
  return (
    <div className={cn('spatial-surface divide-y divide-[var(--border-subtle)] overflow-hidden rounded-[1.5rem]', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5 sm:px-5">
        <div className="min-w-0 space-y-2">
          <Skeleton delay={delay} className="h-5 w-32 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3 w-40 max-w-full rounded-md" />
        </div>
        <Skeleton delay={delay} className="h-6 w-20 shrink-0 rounded-full" />
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <ContactRowSkeleton key={index} delay={delay - index * 90} />
      ))}
    </div>
  )
}

/** Mirrors a contacts list row: checkbox + avatar + name/badges + meta + stage. */
export function ContactRowSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <Skeleton delay={delay} className="h-11 w-11 shrink-0 rounded-xl" />
      <Skeleton delay={delay} className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton delay={delay} className="h-4 w-28 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-4 w-12 rounded-full" />
          <Skeleton delay={delay - 90} className="h-4 w-14 rounded-full" />
        </div>
        <Skeleton delay={delay} className="mt-1 h-3 w-48 max-w-full rounded-full" />
      </div>
      <Skeleton delay={delay} className="h-6 w-20 shrink-0 rounded-full" />
    </div>
  )
}

/* ─────────────────────────── analytics blocks ─────────────────────────── */

/** Mirrors the analytics KPI card: icon + trending, big value, label, hint. */
export function AnalyticsKpiSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between">
        <Skeleton delay={delay} className="h-9 w-9 rounded-xl" />
        <Skeleton delay={delay} className="h-3.5 w-3.5 rounded-full" />
      </div>
      <Skeleton delay={delay} className="mt-3 h-8 w-16 max-w-full rounded-lg" />
      <Skeleton delay={delay} className="mt-0.5 h-3 w-24 max-w-full rounded-md" />
      <Skeleton delay={delay - 90} className="mt-1 h-3 w-32 max-w-full rounded-md" />
    </div>
  )
}

/** Mirrors the agent-performance row: icon + name/% + progress bar + count. */
export function AgentPerfRowSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Skeleton delay={delay} className="h-9 w-9 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <Skeleton delay={delay} className="h-3.5 w-28 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3 w-8 shrink-0 rounded-full" />
        </div>
        <Skeleton delay={delay - 90} className="mt-1.5 h-1.5 w-full rounded-full" />
      </div>
      <Skeleton delay={delay} className="h-4 w-8 shrink-0 rounded-md" />
    </div>
  )
}

/** Mirrors the funnel step row: label + value + h-7 progress track. */
export function FunnelStepSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Skeleton delay={delay} className="h-3 w-32 rounded-md" />
        <Skeleton delay={delay} className="h-3 w-14 rounded-full" />
      </div>
      <Skeleton delay={delay - 90} className="h-7 w-full rounded-lg" />
    </div>
  )
}

/** Mirrors the current-status three tiles + hint strip. */
export function CurrentStatusSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 py-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 text-center">
            <Skeleton delay={delay - index * 90} className="mx-auto h-8 w-10 rounded-lg" />
            <Skeleton delay={delay - index * 90} className="mx-auto mt-1 h-3 w-14 rounded-full" />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--bg-surface)] p-3">
        <Skeleton delay={delay} className="h-3.5 w-3.5 shrink-0 rounded" />
        <Skeleton delay={delay - 90} className="h-3 w-64 max-w-full rounded-full" />
      </div>
    </div>
  )
}

/* ─────────────────────────── appointments blocks ─────────────────────────── */

/** Mirrors the horizontal appointments StatCard: icon + stacked label/value. */
export function AppointmentStatSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface flex items-center gap-3 rounded-[1.5rem] p-4">
      <Skeleton delay={delay} className="h-9 w-9 shrink-0 rounded-xl" />
      <div className="min-w-0 space-y-1.5">
        <Skeleton delay={delay} className="h-3 w-20 max-w-full rounded-md" />
        <Skeleton delay={delay - 90} className="h-5 w-10 max-w-full rounded-lg" />
      </div>
    </div>
  )
}

/** Mirrors the day-picker strip: 7 day tiles. */
export function DayPickerSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="mt-3 grid grid-cols-7 gap-1.5 sm:gap-2">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-[var(--border-subtle)] p-2 text-center">
          <Skeleton delay={delay - index * 80} className="mx-auto h-2.5 w-6 rounded-md" />
          <Skeleton delay={delay - index * 80} className="mx-auto mt-1.5 h-5 w-8 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

/** Mirrors a booked-slot row: icon + name/time + action button. */
export function SlotRowSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-2xl border bg-[var(--bg-base)] p-3.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-4 sm:p-4">
      <Skeleton delay={delay} className="h-9 w-9 rounded-xl" />
      <div className="min-w-0 space-y-2">
        <Skeleton delay={delay} className="h-4 w-36 max-w-full rounded-md" />
        <Skeleton delay={delay - 90} className="h-3 w-24 max-w-full rounded-full" />
      </div>
      <Skeleton delay={delay - 180} className="hidden h-8 w-24 rounded-xl sm:block" />
    </div>
  )
}

/* ─────────────────────────── billing blocks ─────────────────────────── */

/** Mirrors the free-automation banner: icon + title/desc + pill. */
export function BillingBannerSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface flex flex-col gap-4 rounded-[1.5rem] p-4 sm:flex-row sm:items-center sm:p-5">
      <Skeleton delay={delay} className="h-11 w-11 shrink-0 rounded-2xl" />
      <div className="min-w-0 flex-1">
        <Skeleton delay={delay} className="h-4 w-48 max-w-full rounded-md" />
        <Skeleton delay={delay - 90} className="mt-1.5 h-3 w-full max-w-xl rounded-full" />
        <Skeleton delay={delay - 180} className="mt-1 h-3 w-3/4 max-w-xl rounded-full" />
      </div>
      <Skeleton delay={delay - 240} className="h-9 w-32 shrink-0 rounded-full" />
    </div>
  )
}

/** Mirrors the plan card: name row + three muted stat boxes. */
export function PlanCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface rounded-[1.5rem] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Skeleton delay={delay} className="h-3.5 w-16 rounded-md" />
          <div className="mt-1.5 flex items-center gap-2">
            <Skeleton delay={delay} className="h-5 w-5 rounded" />
            <Skeleton delay={delay - 90} className="h-6 w-24 rounded-md" />
          </div>
          <Skeleton delay={delay - 180} className="mt-2 h-3 w-56 max-w-full rounded-full" />
        </div>
      </div>
      <div className="mt-4 grid gap-3 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-xl bg-[var(--bg-muted)] p-3">
            <Skeleton delay={delay - index * 90} className="h-3 w-24 max-w-full rounded-full" />
            <Skeleton delay={delay - index * 90} className="mt-1.5 h-6 w-20 max-w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Mirrors the value-created card: badge + title + desc + button + 3 metrics. */
export function ValueCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-[var(--border-default)] p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <Skeleton delay={delay} className="h-8 w-44 rounded-full" />
          <Skeleton delay={delay} className="mt-4 h-6 w-96 max-w-full rounded-lg" />
          <Skeleton delay={delay - 90} className="mt-2 h-3 w-full max-w-xl rounded-full" />
          <Skeleton delay={delay - 180} className="mt-1 h-3 w-3/4 max-w-xl rounded-full" />
        </div>
        <Skeleton delay={delay - 240} className="h-11 w-40 shrink-0 rounded-xl" />
      </div>
      <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-[var(--border-default)] bg-white/90 p-4">
            <Skeleton delay={delay - index * 90} className="h-9 w-9 rounded-xl" />
            <Skeleton delay={delay - index * 90} className="mt-3 h-3 w-24 max-w-full rounded-full" />
            <Skeleton delay={delay - index * 90} className="mt-1 h-7 w-16 max-w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Mirrors a paid plan card: name + price + feature lines + button. */
export function PlanTileSkeleton({ delay = 0, featured = false }: { delay?: number; featured?: boolean }) {
  return (
    <div className={cn('spatial-surface flex flex-col rounded-[1.5rem] p-5', featured && 'ring-1 ring-[var(--border-strong)]')}>
      <Skeleton delay={delay} className="h-5 w-28 rounded-md" />
      <Skeleton delay={delay - 90} className="mt-3 h-8 w-32 rounded-lg" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-2">
            <Skeleton delay={delay - index * 70} className="h-3.5 w-3.5 shrink-0 rounded-full" />
            <Skeleton delay={delay - index * 70} className="h-3.5 w-40 max-w-full rounded-full" />
          </div>
        ))}
      </div>
      <Skeleton delay={delay - 180} className="mt-5 h-11 w-full rounded-xl" />
    </div>
  )
}

/* ─────────────────────────── products blocks ─────────────────────────── */

/** Mirrors the commerce tabs bar (products / orders). */
export function CommerceTabsSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface flex items-center gap-1 rounded-[1.35rem] p-1.5">
      <Skeleton delay={delay} className="h-10 w-28 rounded-xl" />
      <Skeleton delay={delay - 90} className="h-10 w-24 rounded-xl" />
    </div>
  )
}

/** Mirrors the WooSetupCard: icon + title/desc + action. */
export function SetupCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface rounded-[1.5rem] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Skeleton delay={delay} className="h-11 w-11 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <Skeleton delay={delay} className="h-4 w-44 max-w-full rounded-md" />
          <Skeleton delay={delay - 90} className="mt-1.5 h-3 w-64 max-w-full rounded-full" />
        </div>
        <Skeleton delay={delay - 180} className="h-10 w-32 shrink-0 rounded-xl" />
      </div>
    </div>
  )
}

/** Mirrors a product card: image area + title + price + footer actions. */
export function ProductCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface flex flex-col overflow-hidden rounded-[1.5rem]">
      <Skeleton delay={delay} className="aspect-video w-full rounded-none" />
      <div className="flex flex-1 flex-col p-4">
        <Skeleton delay={delay} className="h-4 w-3/4 max-w-full rounded-md" />
        <Skeleton delay={delay - 90} className="mt-2 h-3 w-1/2 max-w-full rounded-md" />
        <Skeleton delay={delay - 180} className="mt-3 h-5 w-1/3 max-w-full rounded-md" />
        <div className="mt-auto flex items-center justify-between pt-4">
          <Skeleton delay={delay - 240} className="h-3 w-16 rounded-full" />
          <div className="flex items-center gap-2">
            <Skeleton delay={delay - 300} className="h-8 w-16 rounded-xl" />
            <Skeleton delay={delay - 360} className="h-8 w-8 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
