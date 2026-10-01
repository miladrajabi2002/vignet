import { DashboardHeaderSkeleton } from '@/components/dashboard/dashboard-skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/** Route-level skeleton for /courses: header, KPI strip, filter, course cards. */
export default function CoursesLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <DashboardHeaderSkeleton actions={1} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Skeleton className="h-[3.6rem] w-full rounded-2xl lg:w-[24rem]" />
        <Skeleton delay={-90} className="h-14 w-full rounded-2xl lg:w-[28rem]" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="spatial-surface space-y-3 rounded-card p-4">
            <Skeleton delay={-index * 110} className="h-5 w-2/3 rounded-md" />
            <Skeleton delay={-index * 110 - 40} className="h-4 w-1/2 rounded-md" />
            <Skeleton delay={-index * 110 - 80} className="h-2 w-full rounded-full" />
            <Skeleton delay={-index * 110 - 120} className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}
