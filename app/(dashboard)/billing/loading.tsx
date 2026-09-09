import {
  BillingBannerSkeleton,
  DashboardHeaderSkeleton,
  PlanCardSkeleton,
  PlanTileSkeleton,
  ValueCardSkeleton,
} from '@/components/dashboard/dashboard-skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Route-level skeleton for /billing — an exact mirror of the page:
 * PageHeader, free-automation banner, plan card, value-created card,
 * estimator + top-up panels and the 3-up plans grid.
 */
export default function BillingLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardHeaderSkeleton actions={0} />

      {/* Free automation banner */}
      <BillingBannerSkeleton />

      {/* Plan card */}
      <PlanCardSkeleton delay={-80} />

      {/* Value created this month */}
      <ValueCardSkeleton delay={-160} />

      {/* Credit estimator + top-up */}
      <div className="spatial-surface rounded-[1.5rem] p-4 sm:p-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40 rounded-md" />
          <Skeleton delay={-90} className="h-3 w-56 rounded-md" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton delay={-90} className="h-11 w-full rounded-xl" />
        </div>
        <Skeleton delay={-180} className="mt-3 h-11 w-full rounded-xl" />
      </div>
      <div className="spatial-surface rounded-[1.5rem] p-4 sm:p-5">
        <div className="space-y-2">
          <Skeleton delay={-90} className="h-4 w-36 rounded-md" />
          <Skeleton delay={-180} className="h-3 w-48 rounded-md" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} delay={-90 - index * 90} className="h-20 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton delay={-270} className="mt-3 h-11 w-full rounded-xl" />
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
    </div>
  )
}
