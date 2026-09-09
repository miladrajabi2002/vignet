import { ConversationCardSkeleton } from '@/components/ui/skeleton'
import {
  ConversationFiltersSkeleton,
  DashboardHeaderSkeleton,
  DashboardPanelSkeleton,
  InboxFeedHeaderSkeleton,
  InboxPanelSkeleton,
} from '@/components/dashboard/dashboard-skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Route-level skeleton for /conversations — an exact mirror of the page:
 * PageHeader (2 actions), status donut + 14-day trend panels, sticky filter
 * card, then the mobile card feed (same ConversationCardSkeleton as the
 * Analyze & Improve tab) / desktop inbox panel + pagination.
 */
export default function ConversationsLoading() {
  return (
    <div className="mx-auto max-w-6xl min-w-0 space-y-6">
      <DashboardHeaderSkeleton actions={2} />

      {/* Status donut + trend chart (lg:grid-cols-2) */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <DashboardPanelSkeleton action={false}>
          <div className="flex items-center gap-4">
            <Skeleton className="h-[11.25rem] w-[11.25rem] shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2.5">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Skeleton delay={-index * 90} className="h-2.5 w-2.5 shrink-0 rounded" />
                  <Skeleton delay={-index * 90} className="h-3.5 w-20 max-w-full rounded-full" />
                  <Skeleton delay={-index * 90} className="ms-auto h-3.5 w-10 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </DashboardPanelSkeleton>
        <DashboardPanelSkeleton delay={-130} chartHeight={200} />
      </div>

      {/* Sticky filter card */}
      <div className="sticky top-[5.35rem] z-20 md:static md:z-auto">
        <ConversationFiltersSkeleton selects={4} />
      </div>

      {/* Mobile inbox feed — same card skeleton as the improve tab */}
      <div className="space-y-3 md:hidden">
        <InboxFeedHeaderSkeleton />
        {Array.from({ length: 4 }).map((_, index) => (
          <ConversationCardSkeleton key={index} delay={-index * 130} />
        ))}
      </div>

      {/* Desktop inbox panel */}
      <InboxPanelSkeleton className="hidden md:block" rows={6} />

      {/* Pagination */}
      <nav className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <Skeleton className="h-11 w-24 rounded-xl" />
        <Skeleton delay={-80} className="h-11 w-11 rounded-xl" />
        <Skeleton delay={-160} className="h-11 w-11 rounded-xl" />
        <Skeleton delay={-240} className="h-11 w-24 rounded-xl" />
      </nav>
    </div>
  )
}
