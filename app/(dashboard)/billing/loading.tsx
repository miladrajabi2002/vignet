import {
  DashboardHeaderSkeleton,
  PlanTileSkeleton,
} from '@/components/dashboard/dashboard-skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Route-level skeleton for /billing — an exact mirror of the page:
 * PageHeader, plan + credit cards, two usage tiles, the 3-up plans grid
 * and the recent payments list.
 */
export default function BillingLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardHeaderSkeleton actions={0} />

      {/* Plan + credit */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="spatial-surface rounded-card p-4 sm:p-5">
          <Skeleton className="h-3.5 w-20 rounded-md" />
          <Skeleton delay={-90} className="mt-2 h-8 w-32 rounded-lg" />
          <Skeleton delay={-180} className="mt-3 h-1.5 w-full rounded-full" />
          <div className="mt-4 space-y-4 border-t border-[var(--border-subtle)] pt-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton delay={-90 - index * 70} className="h-3 w-36 max-w-full rounded-md" />
                <Skeleton delay={-90 - index * 70} className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
          <Skeleton delay={-270} className="mt-5 h-11 w-40 rounded-xl" />
        </div>
        <div className="spatial-surface rounded-card p-4 sm:p-5">
          <Skeleton delay={-80} className="h-3.5 w-28 rounded-md" />
          <Skeleton delay={-170} className="mt-2 h-8 w-40 rounded-lg" />
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <Skeleton delay={-170} className="h-14 w-full rounded-xl" />
            <Skeleton delay={-260} className="h-14 w-full rounded-xl" />
          </div>
          <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} delay={-90 - index * 90} className="h-14 w-full rounded-xl" />
              ))}
            </div>
            <Skeleton delay={-270} className="mt-4 h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>

      {/* Usage */}
      <div>
        <Skeleton className="mb-3 h-4 w-24 rounded-md" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton delay={-110} className="h-24 w-full rounded-card" />
        </div>
      </div>

      {/* Plans */}
      <div className="scroll-mt-24">
        <Skeleton className="mb-3 h-4 w-20 rounded-md" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <PlanTileSkeleton />
          <PlanTileSkeleton delay={-110} featured />
          <PlanTileSkeleton delay={-220} />
        </div>
      </div>

      {/* Recent payments */}
      <div>
        <Skeleton className="mb-3 h-4 w-28 rounded-md" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} delay={-90 - index * 90} className="h-14 w-full rounded-card" />
          ))}
        </div>
      </div>
    </div>
  )
}
