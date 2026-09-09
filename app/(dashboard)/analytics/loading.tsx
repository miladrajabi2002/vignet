import {
  AgentPerfRowSkeleton,
  AnalyticsKpiSkeleton,
  CurrentStatusSkeleton,
  DashboardHeaderSkeleton,
  DashboardPanelSkeleton,
  FunnelStepSkeleton,
} from '@/components/dashboard/dashboard-skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Route-level skeleton for /analytics — an exact mirror of the page:
 * PageHeader (1 action), 4-up KPI row, trend+donut, agent performance +
 * resolution funnel, CSAT gauge + current status.
 */
export default function AnalyticsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <DashboardHeaderSkeleton actions={1} />

      {/* KPI row */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <AnalyticsKpiSkeleton />
        <AnalyticsKpiSkeleton delay={-110} />
        <AnalyticsKpiSkeleton delay={-220} />
        <AnalyticsKpiSkeleton delay={-330} />
      </section>

      {/* Main trend + channel donut */}
      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <DashboardPanelSkeleton action={false}>
          <Skeleton className="h-[12.5rem] w-full rounded-xl sm:h-60" />
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Skeleton delay={-90} className="h-3 w-16 rounded-full" />
            <Skeleton delay={-160} className="h-3 w-14 rounded-full" />
            <Skeleton delay={-230} className="h-3 w-16 rounded-full" />
          </div>
        </DashboardPanelSkeleton>
        <DashboardPanelSkeleton delay={-130} action={false}>
          <div className="flex items-center gap-4">
            <Skeleton delay={-130} className="h-[11.25rem] w-[11.25rem] shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2.5">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Skeleton delay={-130 - index * 90} className="h-2.5 w-2.5 shrink-0 rounded" />
                  <Skeleton delay={-130 - index * 90} className="h-3.5 w-20 max-w-full rounded-full" />
                  <Skeleton delay={-130 - index * 90} className="ms-auto h-3.5 w-10 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </DashboardPanelSkeleton>
      </section>

      {/* Agent performance + resolution funnel */}
      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <DashboardPanelSkeleton action={false}>
          <div className="divide-y divide-[var(--border-subtle)]">
            {Array.from({ length: 3 }).map((_, index) => (
              <AgentPerfRowSkeleton key={index} delay={-index * 100} />
            ))}
          </div>
        </DashboardPanelSkeleton>
        <DashboardPanelSkeleton delay={-130} action={false}>
          <div className="space-y-3 py-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <FunnelStepSkeleton key={index} delay={-130 - index * 100} />
            ))}
          </div>
        </DashboardPanelSkeleton>
      </section>

      {/* CSAT + current status */}
      <section className="grid gap-4 xl:grid-cols-[0.6fr_1fr]">
        <DashboardPanelSkeleton action={false}>
          <div className="grid place-items-center py-4">
            <Skeleton className="h-[11.25rem] w-[11.25rem] rounded-full" />
          </div>
        </DashboardPanelSkeleton>
        <DashboardPanelSkeleton delay={-130} action={false}>
          <CurrentStatusSkeleton delay={-130} />
        </DashboardPanelSkeleton>
      </section>
    </div>
  )
}
