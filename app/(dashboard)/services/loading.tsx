import { DashboardHeaderSkeleton } from '@/components/dashboard/dashboard-skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Route-level skeleton for /services — mirrors the catalog: header, KPI strip
 * beside search + status filter, then the service card grid.
 */
export default function ServicesLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <DashboardHeaderSkeleton actions={1} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Skeleton className="h-[3.6rem] w-full rounded-2xl lg:w-[26rem]" />
        <Skeleton delay={-90} className="h-12 flex-1 rounded-2xl" />
        <Skeleton delay={-180} className="h-12 w-full rounded-2xl sm:w-64" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="spatial-surface space-y-3 rounded-card p-4">
            <Skeleton delay={-index * 110} className="h-5 w-2/3 rounded-md" />
            <Skeleton delay={-index * 110 - 60} className="h-3 w-full rounded-md" />
            <div className="flex gap-1.5">
              <Skeleton delay={-index * 110 - 120} className="h-6 w-20 rounded-full" />
              <Skeleton delay={-index * 110 - 150} className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton delay={-index * 110 - 180} className="ms-auto h-10 w-24 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}
