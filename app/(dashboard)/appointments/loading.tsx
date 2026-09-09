import { Skeleton } from '@/components/ui/skeleton'
import {
  DashboardHeaderSkeleton,
  KpiCardSkeleton,
} from '@/components/dashboard/dashboard-skeletons'

/**
 * Route-level skeleton for /appointments.
 *
 * Mirrors the real page shape — PageHeader, the stats row, the 7-day
 * selector and the day schedule panel — with the staggered mobile-style
 * shimmer.
 */
export default function AppointmentsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardHeaderSkeleton />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCardSkeleton />
        <KpiCardSkeleton delay={-110} />
        <KpiCardSkeleton delay={-220} />
        <KpiCardSkeleton delay={-330} />
      </div>

      {/* Day selector + schedule */}
      <div className="spatial-surface overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton delay={-90} className="h-3 w-44 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton delay={-90} className="h-11 w-11 rounded-xl" />
            <Skeleton delay={-180} className="h-11 w-11 rounded-xl" />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5 sm:gap-2" aria-hidden="true">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-[var(--border-subtle)] p-2 text-center">
              <Skeleton delay={-index * 80} className="mx-auto h-2.5 w-6 rounded-md" />
              <Skeleton delay={-index * 80} className="mx-auto mt-1.5 h-5 w-8 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] p-3.5">
              <Skeleton delay={-index * 100} className="h-11 w-11 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton delay={-index * 100} className="h-4 w-36 max-w-full rounded-md" />
                <Skeleton delay={-index * 100} className="h-3 w-24 max-w-full rounded-md" />
              </div>
              <Skeleton delay={-index * 100} className="h-8 w-24 shrink-0 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
