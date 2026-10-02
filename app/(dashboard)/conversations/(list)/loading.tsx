import { ConversationCardSkeleton, Skeleton } from '@/components/ui/skeleton'
import {
  ConversationFiltersSkeleton,
  DashboardHeaderSkeleton,
} from '@/components/dashboard/dashboard-skeletons'

/**
 * Route-level skeleton for /conversations — mirrors the inbox: PageHeader
 * (2 actions), then the mobile card feed or, from the tablet
 * breakpoint up, the full-width list card with its filter bar.
 */
export default function ConversationsLoading() {
  return (
    <div className="mx-auto flex min-w-0 max-w-6xl flex-col gap-3">
      <DashboardHeaderSkeleton actions={2} />

      {/* Mobile: sticky filter card + card feed */}
      <div className="space-y-3 md:hidden">
        <ConversationFiltersSkeleton selects={0} />
        {Array.from({ length: 4 }).map((_, index) => (
          <ConversationCardSkeleton key={index} delay={-index * 130} />
        ))}
      </div>

      {/* Tablet and up: filter bar above a full-width list */}
      <div className="hidden overflow-hidden rounded-card border border-[var(--border-subtle)] bg-white md:block">
        <div className="border-b border-[var(--border-subtle)] p-3">
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
        <div className="divide-y divide-[var(--border-subtle)]">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 px-5 py-3">
              <Skeleton delay={-index * 90} className="h-2 w-2 shrink-0 rounded-full" />
              <Skeleton delay={-index * 90} className="h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton delay={-index * 90} className="h-3.5 w-36 max-w-full rounded-full" />
                <Skeleton delay={-index * 90} className="h-3 w-3/4 rounded-full" />
              </div>
              <Skeleton delay={-index * 90} className="h-3 w-12 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
