import { ConversationCardSkeleton, Skeleton } from '@/components/ui/skeleton'
import {
  ConversationFiltersSkeleton,
  DashboardHeaderSkeleton,
} from '@/components/dashboard/dashboard-skeletons'

/**
 * Route-level skeleton for /conversations — mirrors the inbox: PageHeader
 * (2 actions), the status tabs, then the mobile card feed or, from the tablet
 * breakpoint up, the list column beside the open conversation.
 */
export default function ConversationsLoading() {
  return (
    <div className="mx-auto flex min-w-0 max-w-[100rem] flex-col gap-3 md:h-[calc(100dvh-10.25rem)] md:min-h-[34rem]">
      <DashboardHeaderSkeleton actions={2} />

      {/* Status tabs */}
      <div className="flex shrink-0 items-center gap-4 border-b border-[var(--border-subtle)] pb-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} delay={-index * 80} className="h-5 w-16 rounded-full" />
        ))}
      </div>

      {/* Mobile: sticky filter card + card feed */}
      <div className="space-y-3 md:hidden">
        <ConversationFiltersSkeleton selects={0} />
        {Array.from({ length: 4 }).map((_, index) => (
          <ConversationCardSkeleton key={index} delay={-index * 130} />
        ))}
      </div>

      {/* Tablet and up: list column beside the thread */}
      <div className="hidden min-h-0 flex-1 overflow-hidden rounded-card border border-[var(--border-subtle)] bg-white md:grid md:grid-cols-[18rem_minmax(0,1fr)] lg:grid-cols-[21rem_minmax(0,1fr)]">
        <div className="space-y-4 border-e border-[var(--border-subtle)] p-3">
          <Skeleton className="h-11 w-full rounded-xl" />
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="flex items-center gap-2.5">
              <Skeleton delay={-index * 90} className="h-9 w-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton delay={-index * 90} className="h-3.5 w-28 max-w-full rounded-full" />
                <Skeleton delay={-index * 90} className="h-3 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col justify-end gap-3 p-4">
          <Skeleton className="h-10 w-2/5 self-end rounded-2xl" />
          <Skeleton delay={-120} className="h-14 w-3/5 rounded-2xl" />
          <Skeleton delay={-240} className="h-10 w-1/3 self-end rounded-2xl" />
          <Skeleton delay={-360} className="mt-2 h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
