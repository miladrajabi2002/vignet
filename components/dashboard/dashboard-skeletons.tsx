import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * User-dashboard Skeleton Screen building blocks.
 *
 * Each skeleton mirrors its real counterpart in the (dashboard) segment —
 * `components/dashboard/page-header.tsx` (PageHeader), `panel.tsx`
 * (DashboardPanel) and the inbox/overview layouts — so a slow
 * force-dynamic page paints its own shape instantly instead of a blank
 * canvas. Same mobile-style shimmer (with per-card stagger) users know
 * from «تحلیل و بهبود» and the admin panel; reduced-motion users see the
 * static muted blocks. Used by the `loading.tsx` route files in this
 * segment.
 */

/** Mirrors PageHeader: icon square + title + subtitle + action buttons. */
export function DashboardHeaderSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <header className="dashboard-page-header spatial-surface overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Skeleton delay={delay} className="h-11 w-11 shrink-0 rounded-2xl" />
          <div className="min-w-0 space-y-2">
            <Skeleton delay={delay} className="h-7 w-40 max-w-full rounded-lg" />
            <Skeleton delay={delay} className="h-4 w-56 max-w-full rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton delay={delay} className="h-11 w-36 rounded-xl" />
          <Skeleton delay={delay} className="h-11 w-28 rounded-xl" />
        </div>
      </div>
    </header>
  )
}

/** Mirrors DashboardPanel: title + subtitle + action link + content rows. */
export function DashboardPanelSkeleton({
  delay = 0,
  rows = 4,
  className,
  chartHeight,
}: {
  delay?: number
  rows?: number
  className?: string
  /** When set, renders one big chart-shaped block instead of rows. */
  chartHeight?: number
}) {
  return (
    <section className={cn('spatial-surface min-w-0 overflow-hidden rounded-[1.5rem] p-5 sm:p-6', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton delay={delay} className="h-4 w-44 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3 w-56 max-w-full rounded-md" />
        </div>
        <Skeleton delay={delay} className="h-4 w-20 shrink-0 rounded-md" />
      </div>
      {chartHeight !== undefined ? (
        <Skeleton
          delay={delay - 60}
          className="w-full rounded-xl"
          style={{ height: chartHeight } as CSSProperties}
        />
      ) : (
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
      )}
    </section>
  )
}

/** Mirrors the compact KPI stat cards (icon + label + big value). */
export function KpiCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface rounded-[1.5rem] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton delay={delay} className="h-3 w-20 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-7 w-24 max-w-full rounded-lg" />
        </div>
        <Skeleton delay={delay} className="h-9 w-9 shrink-0 rounded-xl" />
      </div>
    </div>
  )
}

/** Mirrors an inbox conversation row: avatar + name + preview + badges. */
export function ConversationRowSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex min-w-0 items-start gap-3 px-4 py-3.5 sm:px-5">
      <Skeleton delay={delay} className="h-11 w-11 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Skeleton delay={delay} className="h-4 w-32 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3 w-16 shrink-0 rounded-full" />
        </div>
        <Skeleton delay={delay} className="mt-1.5 h-3.5 w-3/4 max-w-full rounded-md" />
        <div className="mt-2 flex items-center gap-2">
          <Skeleton delay={delay} className="h-5 w-16 rounded-full" />
          <Skeleton delay={delay} className="h-5 w-14 rounded-full" />
          <Skeleton delay={delay} className="h-3 w-12 rounded-full" />
        </div>
      </div>
    </div>
  )
}

/** Mirrors the desktop inbox panel: header + divide-y rows + pagination. */
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
    <div className={cn('spatial-surface min-w-0 overflow-hidden rounded-[1.5rem]', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5 sm:px-5">
        <div className="min-w-0 space-y-2">
          <Skeleton delay={delay} className="h-5 w-36 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3 w-48 max-w-full rounded-md" />
        </div>
        <Skeleton delay={delay} className="h-8 w-8 shrink-0 rounded-lg" />
      </div>
      <div className="divide-y divide-[var(--border-subtle)]">
        {Array.from({ length: rows }).map((_, index) => (
          <ConversationRowSkeleton key={index} delay={delay - index * 90} />
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 border-t border-[var(--border-subtle)] px-4 py-3">
        <Skeleton delay={delay} className="h-9 w-24 rounded-xl" />
        <Skeleton delay={delay} className="h-9 w-9 rounded-xl" />
        <Skeleton delay={delay} className="h-9 w-9 rounded-xl" />
        <Skeleton delay={delay} className="h-9 w-24 rounded-xl" />
      </div>
    </div>
  )
}

/** Mirrors the agent cards grid on /agents (icon + name + stats strip). */
export function AgentCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface overflow-hidden rounded-[1.5rem] p-5">
      <div className="flex items-start gap-3">
        <Skeleton delay={delay} className="h-11 w-11 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton delay={delay} className="h-4 w-32 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3 w-24 max-w-full rounded-md" />
        </div>
        <Skeleton delay={delay} className="h-6 w-16 shrink-0 rounded-full" />
      </div>
      <div className="mt-4 grid grid-cols-3 divide-x divide-x-reverse divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-3 text-center">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-2 px-2">
            <Skeleton delay={delay - index * 60} className="mx-auto h-3 w-10 rounded-md" />
            <Skeleton delay={delay - index * 60} className="mx-auto h-5 w-8 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Skeleton delay={delay} className="h-6 w-24 rounded-md" />
        <Skeleton delay={delay} className="h-3 w-20 rounded-md" />
      </div>
    </div>
  )
}

/** Mirrors the contact cards grid on /contacts. */
export function ContactCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface overflow-hidden rounded-[1.5rem] p-4">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <Skeleton delay={delay} className="h-11 w-11 rounded-full" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton delay={delay} className="h-4 w-28 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3 w-24 max-w-full rounded-md" />
          <div className="flex items-center gap-1.5">
            <Skeleton delay={delay} className="h-5 w-14 rounded-full" />
            <Skeleton delay={delay} className="h-5 w-12 rounded-full" />
          </div>
        </div>
        <Skeleton delay={delay} className="h-8 w-8 shrink-0 rounded-lg" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-[var(--bg-muted)] p-3">
        <Skeleton delay={delay} className="h-3 w-16 rounded-md" />
        <Skeleton delay={delay} className="h-3 w-16 rounded-md" />
        <Skeleton delay={delay} className="h-3 w-20 rounded-md" />
        <Skeleton delay={delay} className="h-3 w-14 rounded-md" />
      </div>
    </div>
  )
}

/** Mirrors the sticky toolbar card (search input + filter chips). */
export function ToolbarSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface rounded-[1.35rem] p-2.5 shadow-[0_14px_36px_rgba(0,0,0,0.08)] md:rounded-[1.5rem] md:p-4 md:shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton delay={delay} className="h-11 min-w-[10rem] flex-1 rounded-xl" />
        <Skeleton delay={delay} className="h-11 w-32 rounded-xl" />
        <Skeleton delay={delay} className="h-11 w-28 rounded-xl" />
        <Skeleton delay={delay} className="h-11 w-24 rounded-xl" />
      </div>
    </div>
  )
}
