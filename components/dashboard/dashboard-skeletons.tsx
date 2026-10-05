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
  compactOnMobile = false,
  className,
}: {
  delay?: number
  /** Number of action buttons the real header renders (0-4). */
  actions?: 0 | 1 | 2 | 3 | 4
  /**
   * The real headers pair icon-only squares on phones with labelled pills on
   * `sm+` (the `compactOnMobile` button pattern) — mirror that shrink.
   */
  compactOnMobile?: boolean
  className?: string
}) {
  return (
    <header className={cn('dashboard-page-header', className)}>
      <div className="grid grid-cols-[minmax(8rem,1fr)_auto] items-center gap-x-3 gap-y-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-center gap-3 sm:min-w-[min(100%,17rem)] sm:flex-1 sm:gap-3.5">
          <Skeleton delay={delay} className="h-10 w-10 shrink-0 rounded-control sm:h-11 sm:w-11" />
          <div className="min-w-0">
            <Skeleton delay={delay} className="h-7 w-44 max-w-full rounded-lg" />
            <Skeleton delay={delay} className="mt-2 hidden h-4 w-56 max-w-full rounded-md sm:block" />
          </div>
        </div>
        {actions > 0 && (
          <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto py-0.5 [scrollbar-width:none] sm:flex-wrap sm:justify-end sm:overflow-visible sm:py-0">
            {Array.from({ length: actions }).map((_, index) => (
              <Skeleton
                key={index}
                delay={delay - index * 80}
                className={cn(
                  'h-11 shrink-0 rounded-xl',
                  compactOnMobile ? 'w-11 sm:w-32' : 'w-32',
                )}
              />
            ))}
          </div>
        )}
        {/* Phones: the subtitle runs under the title and the actions at full width. */}
        <Skeleton delay={delay} className="col-span-2 h-4 w-56 max-w-full rounded-md sm:hidden" />
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
    <section className={cn('spatial-surface min-w-0 overflow-hidden rounded-card p-5 sm:p-6', className)}>
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
    <div className="dashboard-arrival dashboard-intro relative overflow-hidden rounded-sheet border border-[var(--border-default)] p-5 sm:p-7">
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
    <div className="dashboard-arrival dashboard-arrival--core min-h-[20rem] rounded-sheet border border-[var(--border-default)] bg-white/80 shadow-[var(--shadow-soft)]">
      <div className="m-6">
        <Skeleton delay={delay} className="h-4 w-32 rounded-full" />
        <Skeleton delay={delay - 90} className="mx-auto mt-14 h-24 w-24 rounded-full" />
        <Skeleton delay={delay - 180} className="mx-auto mt-8 h-3 w-44 rounded-full" />
      </div>
    </div>
  )
}

/**
 * Mirrors the Vigento card on /overview: the dark `rounded-sheet` panel with
 * the ink icon tile, title + subtitle, question pills and the white CTA — and
 * the live demo chat on the second column from `sm` up.
 */
export function VigentoCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <section className="relative overflow-hidden rounded-sheet bg-[#111] p-5 sm:p-7">
      <div className="relative grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <div>
          <div className="flex items-center gap-2.5">
            <Skeleton delay={delay} className="h-11 w-11 shrink-0 rounded-2xl" />
            <div className="min-w-0">
              <Skeleton delay={delay} className="h-7 w-20 max-w-full rounded-md" />
              <Skeleton delay={delay - 90} className="mt-1 h-3.5 w-28 max-w-full rounded-md" />
            </div>
          </div>
          <Skeleton delay={delay - 180} className="mt-4 hidden h-4 w-full max-w-md rounded-md sm:block" />
          <ul className="mt-4 flex flex-wrap gap-2">
            <li>
              <Skeleton delay={delay} className="h-11 w-52 rounded-full" />
            </li>
            <li>
              <Skeleton delay={delay - 90} className="h-11 w-44 rounded-full" />
            </li>
            <li>
              <Skeleton delay={delay - 180} className="h-11 w-40 rounded-full" />
            </li>
          </ul>
          <Skeleton delay={delay - 240} className="mt-5 h-11 w-40 rounded-xl" />
        </div>
        {/* Live demo exchange (sm+) */}
        <div className="hidden rounded-card border border-white/10 bg-white/[0.04] p-4 sm:block">
          <div className="flex items-center gap-2">
            <Skeleton delay={delay} className="h-1.5 w-1.5 rounded-full" />
            <Skeleton delay={delay - 90} className="h-3 w-28 rounded-full" />
          </div>
          <div className="mt-3 flex flex-col gap-2.5">
            <Skeleton delay={delay - 120} className="h-10 w-[88%] self-end rounded-2xl rounded-br-md" />
            <Skeleton delay={delay - 210} className="h-16 w-[70%] self-start rounded-2xl rounded-bl-md" />
            <Skeleton delay={delay - 300} className="h-6 w-36 self-start rounded-full" />
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Mirrors the Telegram manager bot card on /overview: the white
 * `rounded-sheet` panel split into a pitch column (avatar, title + status
 * chip, copy, two-up capability grid, buttons) and the Telegram phone mock
 * that joins at `md`.
 */
export function OperatorBotCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <section className="spatial-surface overflow-hidden rounded-sheet">
      <div className="grid gap-0 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <Skeleton delay={delay} className="h-11 w-11 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton delay={delay} className="h-7 w-40 max-w-full rounded-md" />
                <Skeleton delay={delay - 90} className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton delay={delay - 180} className="mt-2 h-4 w-full max-w-md rounded-full" />
            </div>
          </div>
          {/* Capability grid joins from md, like the real card. */}
          <div className="mt-4 hidden border-t border-[var(--border-subtle)] pt-4 sm:mt-5 sm:pt-5 md:block">
            <ul className="grid grid-cols-2 gap-1.5">
              {Array.from({ length: 6 }).map((_, index) => (
                <li key={index} className="flex min-w-0 items-center gap-2 rounded-xl bg-[var(--bg-surface)] px-2.5 py-2">
                  <Skeleton delay={delay - index * 80} className="h-8 w-8 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton delay={delay - index * 80} className="h-3.5 w-4/5 max-w-full rounded-full" />
                    <Skeleton delay={delay - index * 80} className="hidden h-3 w-3/5 rounded-full sm:block" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 sm:mt-5">
            <Skeleton delay={delay} className="h-11 w-36 rounded-xl" />
            <Skeleton delay={delay - 90} className="h-11 w-40 rounded-xl" />
          </div>
        </div>
        {/* Telegram mock joins at md. */}
        <div className="hidden md:block">
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] bg-white/95 px-4 py-2.5">
              <Skeleton delay={delay - 60} className="h-9 w-9 shrink-0 rounded-full" />
              <div className="min-w-0 space-y-1">
                <Skeleton delay={delay - 90} className="h-3.5 w-28 max-w-full rounded-full" />
                <Skeleton delay={delay - 120} className="h-3 w-10 rounded-full" />
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-2.5 p-4">
              <Skeleton delay={delay - 150} className="h-10 w-[62%] self-start rounded-2xl rounded-bl-md" />
              <Skeleton delay={delay - 240} className="h-9 w-[48%] self-end rounded-2xl rounded-br-md" />
              <div className="mt-auto grid grid-cols-2 gap-1.5">
                <Skeleton delay={delay - 300} className="h-9 w-full rounded-lg" />
                <Skeleton delay={delay - 330} className="h-9 w-full rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Mirrors OutcomeCard (KPI): label + icon, big value, hint, sparkline. */
export function OutcomeCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="dashboard-card relative overflow-hidden rounded-card border border-[var(--border-default)] bg-white/[0.94] p-4 sm:p-5">
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

/**
 * Mirrors the /conversations filter bar: the same sticky wrapper + `ui-fbar`
 * container-query bar the real page uses, so the compact row (search +
 * filters button) and the full row (search + selects) swap at the exact same
 * column width — not at a viewport guess.
 */
export function ConversationFiltersSkeleton({ delay = 0, selects = 4 }: { delay?: number; selects?: number }) {
  return (
    <div className="sticky top-[5.35rem] z-20 rounded-card border border-[var(--border-subtle)] bg-white p-2.5 shadow-[var(--elev-1)] md:static md:z-auto md:shrink-0 md:rounded-none md:border-0 md:border-b md:p-3 md:shadow-none">
      <div className="ui-fbar">
        <div className="ui-fbar-compact flex items-center gap-2">
          <Skeleton delay={delay} className="h-11 min-w-[12rem] flex-1 rounded-xl" />
          <Skeleton delay={delay - 90} className="h-11 w-11 shrink-0 rounded-xl" />
        </div>
        <div className="ui-fbar-full flex-wrap items-center gap-2">
          <Skeleton delay={delay} className="h-11 min-w-[12rem] flex-1 rounded-control" />
          {Array.from({ length: selects }).map((_, index) => (
            <Skeleton key={index} delay={delay - (index + 1) * 90} className="h-11 min-w-40 rounded-control" />
          ))}
        </div>
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
    <div className={cn('spatial-surface min-w-0 divide-y divide-[var(--border-subtle)] overflow-hidden rounded-card', className)}>
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
    <div className="spatial-surface flex flex-col rounded-card p-5">
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

/**
 * Mirrors the /contacts filter bar: the real page's sticky wrapper around the
 * `ui-fbar` container-query bar, so the compact row (search + filters button)
 * and the full row (search + the three stage/channel/tag selects) swap at the
 * exact same column width the loaded page swaps at.
 */
export function ContactsToolbarSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="sticky top-[5.35rem] z-20 md:static md:z-auto">
      <div className="ui-fbar spatial-surface rounded-card p-2.5 shadow-[var(--elev-1)] md:p-4 md:shadow-[var(--shadow-card)]">
        <div className="ui-fbar-compact flex items-center gap-2">
          <Skeleton delay={delay} className="h-11 min-w-[12rem] flex-1 rounded-xl" />
          <Skeleton delay={delay - 90} className="h-11 w-11 shrink-0 rounded-xl" />
        </div>
        <div className="ui-fbar-full flex-wrap items-center gap-2">
          <Skeleton delay={delay} className="h-11 min-w-[12rem] flex-1 rounded-control" />
          <Skeleton delay={delay - 90} className="h-11 min-w-40 rounded-control" />
          <Skeleton delay={delay - 180} className="h-11 min-w-40 rounded-control" />
          <Skeleton delay={delay - 270} className="h-11 min-w-40 rounded-control" />
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
    <div className={cn('spatial-surface divide-y divide-[var(--border-subtle)] overflow-hidden rounded-card', className)}>
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

/** Mirrors a desktop contacts row: checkbox + avatar + name/badges + meta + stage select. */
export function ContactRowSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center">
        <Skeleton delay={delay} className="h-4 w-4 rounded" />
      </span>
      <Skeleton delay={delay} className="h-9 w-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton delay={delay} className="h-4 w-28 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-5 w-14 shrink-0 rounded-md" />
          <Skeleton delay={delay - 90} className="h-5 w-16 shrink-0 rounded-md" />
        </div>
        <Skeleton delay={delay} className="mt-1 h-3 w-48 max-w-full rounded-full" />
      </div>
      <Skeleton delay={delay} className="h-11 w-20 shrink-0 rounded-xl" />
    </div>
  )
}

/**
 * Mirrors a mobile contacts card: avatar + name + stage pill + phone line,
 * the channel/tag badges, the two-stat footer, then the select + stage
 * toolbar row that carries the card's own height at the bottom.
 */
export function ContactCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <article className="spatial-surface overflow-hidden rounded-card">
      <div className="p-4">
        <div className="flex min-w-0 items-start gap-3">
          <Skeleton delay={delay} className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <Skeleton delay={delay} className="h-[15px] w-28 max-w-full rounded-md" />
              <Skeleton delay={delay - 90} className="h-7 w-16 shrink-0 rounded-full" />
            </div>
            <Skeleton delay={delay - 130} className="mt-1 h-3 w-24 max-w-full rounded-full" />
          </div>
          <Skeleton delay={delay - 170} className="mt-1 h-4 w-4 shrink-0 rounded-full" />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Skeleton delay={delay} className="h-5 w-16 rounded-md" />
          <Skeleton delay={delay - 90} className="h-5 w-14 rounded-md" />
          <Skeleton delay={delay - 180} className="h-5 w-12 rounded-full" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-black/[0.025] p-3">
          <div className="space-y-1.5">
            <Skeleton delay={delay} className="h-3 w-14 rounded-full" />
            <Skeleton delay={delay - 90} className="h-3.5 w-16 rounded-md" />
          </div>
          <div className="space-y-1.5">
            <Skeleton delay={delay - 180} className="h-3 w-14 rounded-full" />
            <Skeleton delay={delay - 270} className="h-3.5 w-20 rounded-md" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--border-subtle)] bg-black/[0.012] p-2.5">
        <div className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-2">
          <Skeleton delay={delay} className="h-4 w-4 rounded" />
          <Skeleton delay={delay - 90} className="h-3 w-20 rounded-full" />
        </div>
        <Skeleton delay={delay - 180} className="h-11 min-w-0 flex-1 rounded-xl" />
      </div>
    </article>
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
    <div className="spatial-surface flex items-center gap-3 rounded-card p-4">
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
    <div className="spatial-surface flex flex-col gap-4 rounded-card p-4 sm:flex-row sm:items-center sm:p-5">
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
    <div className="spatial-surface rounded-card p-4 sm:p-5">
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
    <div className="relative overflow-hidden rounded-card border border-[var(--border-default)] p-5 shadow-[var(--shadow-card)] sm:p-6">
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
    <div className={cn('spatial-surface flex flex-col rounded-card p-5', featured && 'ring-1 ring-[var(--border-strong)]')}>
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
    <nav className="ui-seg grid-cols-3 sm:inline-grid sm:min-w-[30rem]" aria-label="commerce tabs">
      {Array.from({ length: 3 }).map((_, index) => (
        <span key={index} className="ui-seg-tab gap-1.5 px-1.5 sm:gap-2 sm:px-4" data-active={index === 0 ? 'true' : undefined}>
          <Skeleton delay={delay - index * 90} className="h-7 w-7 shrink-0 rounded-lg" />
          <Skeleton delay={delay - index * 90} className="h-3.5 w-14 max-w-full rounded-full" />
        </span>
      ))}
    </nav>
  )
}

/** Mirrors the WooSetupCard: icon + title/desc + action. */
export function SetupCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface rounded-card p-4 sm:p-5">
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
    <div className="spatial-surface group relative flex flex-row overflow-hidden rounded-card sm:flex-col">
      {/* Phones: square thumb at the start; sm+: full-bleed video banner. */}
      <Skeleton
        delay={delay}
        className="m-3 me-0 size-20 shrink-0 rounded-2xl sm:m-0 sm:aspect-video sm:size-auto sm:rounded-none"
      />
      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
        <Skeleton delay={delay - 60} className="h-4 w-3/4 max-w-full rounded-md" />
        <Skeleton delay={delay - 120} className="mt-1.5 h-4 w-1/2 max-w-full rounded-md" />
        <Skeleton delay={delay - 180} className="mt-2 h-3 w-2/5 max-w-full rounded-full" />
        <div className="mt-auto flex items-baseline gap-2 pt-2 sm:pt-4">
          <Skeleton delay={delay - 240} className="h-5 w-16 max-w-full rounded-md" />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Skeleton delay={delay - 300} className="h-3 w-14 rounded-full" />
          <div className="flex items-center gap-2">
            <Skeleton delay={delay - 360} className="h-11 w-16 rounded-xl sm:h-9" />
            <Skeleton delay={delay - 420} className="h-11 w-11 rounded-xl sm:h-9 sm:w-9" />
          </div>
        </div>
      </div>
    </div>
  )
}
