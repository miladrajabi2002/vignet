import { InboxCardSkeleton, Skeleton } from '@/components/ui/skeleton'
import {
  ConversationFiltersSkeleton,
  DashboardHeaderSkeleton,
} from '@/components/dashboard/dashboard-skeletons'

/**
 * Route-level skeleton for /conversations — an exact mirror of the inbox:
 * PageHeader (2 compact actions), then one wrapper card holding the sticky
 * filter bar, the "N conversations" strip, and either the mobile card feed
 * or the desktop row list.
 */
export default function ConversationsLoading() {
  return (
    <div className="mx-auto flex min-w-0 max-w-6xl flex-col gap-3">
      <DashboardHeaderSkeleton actions={2} compactOnMobile />

      <div className="min-w-0 md:overflow-hidden md:rounded-card md:border md:border-[var(--border-subtle)] md:bg-white md:shadow-[var(--elev-1)]">
        <div className="flex min-w-0 flex-col gap-3 md:gap-0">
          {/* Filter bar — same sticky wrapper + ui-fbar swap point as the page */}
          <ConversationFiltersSkeleton delay={-60} selects={4} />

          {/* Result count strip */}
          <div className="flex items-center justify-between gap-3 px-1 md:shrink-0 md:border-b md:border-[var(--border-subtle)] md:px-3 md:py-1.5">
            <Skeleton delay={-120} className="h-3.5 w-20 rounded-full" />
            <div className="flex items-center gap-2">
              <Skeleton delay={-160} className="h-7 w-24 rounded-full" />
              <Skeleton delay={-200} className="h-7 w-24 rounded-full" />
            </div>
          </div>

          {/* Mobile: card feed */}
          <div className="space-y-3 md:hidden">
            {Array.from({ length: 4 }).map((_, index) => (
              <InboxCardSkeleton key={index} delay={-240 - index * 130} />
            ))}
          </div>

          {/* Tablet and up: row list */}
          <div className="hidden divide-y divide-[var(--border-subtle)] md:block">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 sm:px-5"
              >
                <Skeleton delay={-index * 90} className="h-2 w-2 shrink-0 rounded-full" />
                <Skeleton delay={-index * 90} className="h-9 w-9 shrink-0 rounded-full" />
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Skeleton delay={-index * 90} className="h-4 w-28 max-w-full rounded-md" />
                    <Skeleton delay={-index * 90 - 40} className="h-5 w-20 rounded-full" />
                    <Skeleton delay={-index * 90 - 80} className="h-5 w-16 rounded-md" />
                    <Skeleton delay={-index * 90 - 120} className="ms-auto h-3 w-12 shrink-0 rounded-full" />
                  </div>
                  <Skeleton delay={-index * 90 - 60} className="mt-0.5 h-[13px] w-2/3 max-w-full rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
