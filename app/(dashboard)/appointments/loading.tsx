import {
  DashboardHeaderSkeleton,
  DayPickerSkeleton,
  SlotRowSkeleton,
} from '@/components/dashboard/dashboard-skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Route-level skeleton for /appointments — mirrors the workspace: header,
 * tabs + KPI strip, the schedule card (toolbar, week strip, day list) and the
 * agent panel beside it on wide screens.
 */
export default function AppointmentsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <DashboardHeaderSkeleton actions={2} />

      {/* Section tabs + 4-cell KPI strip */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="ui-seg w-full grid-cols-2 lg:w-[22rem]" role="tablist">
          <span className="ui-seg-tab text-sm" data-active="true">
            <Skeleton className="h-3.5 w-16 rounded-full" />
          </span>
          <span className="ui-seg-tab text-sm">
            <Skeleton delay={-90} className="h-3.5 w-16 rounded-full" />
          </span>
        </div>
        <dl className="grid grid-cols-4 divide-x divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white/80 rtl:divide-x-reverse lg:min-w-[30rem]">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-col items-center gap-1.5 py-3">
              <Skeleton delay={-120 - index * 80} className="h-6 w-10 max-w-full rounded-lg" />
              <Skeleton delay={-150 - index * 80} className="h-3 w-14 max-w-full rounded-full" />
            </div>
          ))}
        </dl>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="spatial-surface min-w-0 rounded-card p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-20 rounded-xl" />
            <Skeleton delay={-90} className="h-4 w-32 flex-1 rounded-md sm:flex-none" />
            <Skeleton delay={-180} className="ms-auto h-10 w-16 rounded-xl" />
          </div>
          <DayPickerSkeleton />
          <Skeleton delay={-200} className="mt-5 h-6 w-52 rounded-md" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <SlotRowSkeleton key={index} delay={-index * 110} />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="spatial-surface space-y-3 rounded-card p-4">
            <Skeleton className="h-9 w-40 rounded-xl" />
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} delay={-index * 90} className="h-4 w-full rounded-md" />
            ))}
          </div>
          <div className="spatial-surface space-y-2 rounded-card p-4">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton delay={-90} className="h-3 w-full rounded-md" />
            <Skeleton delay={-180} className="h-3 w-4/5 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  )
}
