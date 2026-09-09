import {
  AppointmentStatSkeleton,
  DashboardHeaderSkeleton,
  DayPickerSkeleton,
  SlotRowSkeleton,
} from '@/components/dashboard/dashboard-skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Route-level skeleton for /appointments — an exact mirror of the page:
 * header, 4 horizontal stat tiles, the calendar panel (title + arrows +
 * 7-day picker + slot rows), then the pending/services aside.
 */
export default function AppointmentsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardHeaderSkeleton actions={2} />

      {/* Stat tiles — horizontal icon + label/value */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <AppointmentStatSkeleton />
        <AppointmentStatSkeleton delay={-110} />
        <AppointmentStatSkeleton delay={-220} />
        <AppointmentStatSkeleton delay={-330} />
      </div>

      {/* Calendar panel: title + arrows + day picker + slots */}
      <div className="spatial-surface min-w-0 rounded-[1.5rem] p-4 sm:p-5">
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
        <DayPickerSkeleton />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-[var(--border-subtle)] p-3 text-center">
              <Skeleton delay={-index * 90} className="mx-auto h-2.5 w-12 rounded-full" />
              <div className="mx-auto mt-2 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--bg-surface)]">
                <Skeleton delay={-index * 90} className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton delay={-index * 90} className="mx-auto mt-2 h-3 w-16 rounded-full" />
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <SlotRowSkeleton key={index} delay={-index * 110} />
          ))}
        </div>
      </div>

      {/* Aside: pending requests + services */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="spatial-surface rounded-[1.5rem] p-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton delay={-90} className="h-3 w-44 rounded-md" />
          </div>
          <div className="mt-4 space-y-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <SlotRowSkeleton key={index} delay={-index * 110} />
            ))}
          </div>
        </div>
        <div className="spatial-surface rounded-[1.5rem] p-5">
          <div className="space-y-2">
            <Skeleton delay={-130} className="h-4 w-32 rounded-md" />
            <Skeleton delay={-220} className="h-3 w-40 rounded-md" />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <SlotRowSkeleton key={index} delay={-130 - index * 90} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
