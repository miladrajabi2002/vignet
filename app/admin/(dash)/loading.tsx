import { ChartSkeleton, PageHeaderSkeleton, PanelSkeleton, StatCardSkeleton } from './admin-skeletons'

/**
 * Route-level Skeleton Screen for every page in the admin dash segment.
 *
 * Admin pages are force-dynamic and run many Prisma aggregates, so the first
 * paint used to be a blank canvas. Next.js streams this skeleton while the
 * server works, and because the blocks mirror the real PageHeader → StatCard
 * grid → charts → panels layout, the swap to live data never jumps.
 * Pages with a distinctive layout (ai, agents, users) override this with a
 * dedicated loading.tsx; everything else inherits this generic shape.
 */
export default function AdminDashLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only" role="status">
        در حال بارگذاری اطلاعات…Loading…
      </span>
      <PageHeaderSkeleton />

      <div className="grid grid-cols-2 gap-3 min-[1380px]:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton delay={-120} />
        <StatCardSkeleton delay={-240} />
        <StatCardSkeleton delay={-360} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartSkeleton delay={-80} />
        <ChartSkeleton delay={-200} />
      </div>

      <div className="grid grid-cols-2 gap-3 min-[1380px]:grid-cols-4">
        <StatCardSkeleton delay={-60} />
        <StatCardSkeleton delay={-180} />
        <StatCardSkeleton delay={-300} />
        <StatCardSkeleton delay={-420} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PanelSkeleton delay={-140} rows={5} />
        <PanelSkeleton delay={-260} rows={5} />
      </div>
    </div>
  )
}
