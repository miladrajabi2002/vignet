import { Skeleton } from '@/components/ui/skeleton'
import {
  DashboardHeaderSkeleton,
  DashboardPanelSkeleton,
} from '@/components/dashboard/dashboard-skeletons'

/**
 * Route-level skeleton for /billing.
 *
 * Mirrors the real page shape — PageHeader, the plan/credit summary
 * cards, the three stat boxes and the usage history panels — with the
 * staggered mobile-style shimmer.
 */
export default function BillingLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardHeaderSkeleton />

      {/* Plan + credit summary cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="spatial-surface overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton delay={-90} className="h-3 w-40 rounded-md" />
            </div>
            <Skeleton delay={-90} className="h-7 w-24 rounded-full" />
          </div>
          <div className="mt-4 grid gap-3 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Skeleton className="h-2.5 w-16 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton delay={-90} className="h-2.5 w-16 rounded-md" />
              <Skeleton delay={-90} className="h-5 w-24 rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton delay={-180} className="h-2.5 w-16 rounded-md" />
              <Skeleton delay={-180} className="h-5 w-20 rounded-lg" />
            </div>
          </div>
        </div>
        <div className="spatial-surface overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton delay={-90} className="h-3 w-44 rounded-md" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-[var(--border-default)] bg-white/90 p-4">
                <Skeleton delay={-index * 90} className="h-9 w-9 rounded-xl" />
                <Skeleton delay={-index * 90} className="mt-3 h-2.5 w-14 rounded-md" />
                <Skeleton delay={-index * 90} className="mt-1.5 h-6 w-20 rounded-lg" />
              </div>
            ))}
          </div>
          <Skeleton delay={-140} className="mt-4 h-11 w-full rounded-xl" />
        </div>
      </div>

      {/* Usage history panels */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <DashboardPanelSkeleton rows={4} />
        <DashboardPanelSkeleton rows={4} delay={-110} />
        <DashboardPanelSkeleton rows={4} delay={-220} />
      </div>
    </div>
  )
}
