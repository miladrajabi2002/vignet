import { ConversationCardSkeleton, Skeleton } from '@/components/ui/skeleton'
import {
  ConversationFiltersSkeleton,
  DashboardHeaderSkeleton,
  InboxFeedHeaderSkeleton,
  InboxPanelSkeleton,
} from '@/components/dashboard/dashboard-skeletons'

/**
 * Route-level skeleton for /conversations — mirrors the page: PageHeader
 * (2 actions), the status count pills, the sticky filter card, then the mobile
 * card feed or the desktop inbox list, and pagination.
 */
export default function ConversationsLoading() {
  return (
    <div className="mx-auto max-w-6xl min-w-0 space-y-6">
      <DashboardHeaderSkeleton actions={2} />

      {/* Status count pills */}
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} delay={-index * 80} className="h-10 w-28 rounded-full" />
        ))}
      </div>

      {/* Sticky filter card */}
      <div className="sticky top-[5.35rem] z-20 md:static md:z-auto">
        <ConversationFiltersSkeleton selects={4} />
      </div>

      {/* Mobile inbox feed */}
      <div className="space-y-3 md:hidden">
        <InboxFeedHeaderSkeleton />
        {Array.from({ length: 4 }).map((_, index) => (
          <ConversationCardSkeleton key={index} delay={-index * 130} />
        ))}
      </div>

      {/* Desktop inbox list */}
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
