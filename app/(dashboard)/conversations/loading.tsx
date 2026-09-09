import { ConversationCardSkeleton, Skeleton } from '@/components/ui/skeleton'
import {
  DashboardHeaderSkeleton,
  DashboardPanelSkeleton,
  InboxPanelSkeleton,
  ToolbarSkeleton,
} from '@/components/dashboard/dashboard-skeletons'

/**
 * Route-level skeleton for /conversations (the inbox).
 *
 * Mirrors the real page shape — PageHeader, the status/trend panels, the
 * sticky filter card, then the mobile card feed (the same
 * ConversationCardSkeleton used in «تحلیل و بهبود») / desktop inbox panel
 * with pagination. Same staggered mobile-style shimmer as the rest of
 * the product.
 */
export default function ConversationsLoading() {
  return (
    <div className="mx-auto max-w-6xl min-w-0 space-y-6">
      <DashboardHeaderSkeleton />

      {/* Status donut + trend chart */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <DashboardPanelSkeleton chartHeight={190} />
        <DashboardPanelSkeleton chartHeight={190} delay={-130} />
      </div>

      {/* Sticky filter card */}
      <div className="sticky top-[5.35rem] z-20 md:static md:z-auto">
        <ToolbarSkeleton />
      </div>

      {/* Mobile inbox feed — same card skeleton as the improve tab */}
      <div className="space-y-3 md:hidden">
        <div className="flex items-end justify-between gap-3 px-1">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-5 w-32 rounded-md" />
            <Skeleton delay={-90} className="h-3 w-24 rounded-md" />
          </div>
          <Skeleton delay={-140} className="h-5 w-20 rounded-full" />
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <ConversationCardSkeleton key={index} delay={-index * 130} />
        ))}
      </div>

      {/* Desktop inbox panel */}
      <InboxPanelSkeleton className="hidden md:block" rows={7} />
    </div>
  )
}
