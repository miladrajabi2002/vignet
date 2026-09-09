import {
  DashboardHeaderSkeleton,
  DashboardPanelSkeleton,
  KpiCardSkeleton,
} from '@/components/dashboard/dashboard-skeletons'

/**
 * Route-level skeleton for /analytics.
 *
 * Mirrors the real page shape — PageHeader, the 4-up KPI row and the
 * chart/panel sections in their asymmetric two-column grids — with the
 * staggered mobile-style shimmer.
 */
export default function AnalyticsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <DashboardHeaderSkeleton />

      {/* KPI row */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCardSkeleton />
        <KpiCardSkeleton delay={-110} />
        <KpiCardSkeleton delay={-220} />
        <KpiCardSkeleton delay={-330} />
      </section>

      {/* Main chart + side breakdown */}
      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <DashboardPanelSkeleton chartHeight={230} />
        <DashboardPanelSkeleton rows={5} delay={-130} />
      </section>

      {/* Two equal panels */}
      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <DashboardPanelSkeleton chartHeight={190} />
        <DashboardPanelSkeleton chartHeight={190} delay={-130} />
      </section>

      {/* Funnel + detail list */}
      <section className="grid gap-4 xl:grid-cols-[0.6fr_1fr]">
        <DashboardPanelSkeleton rows={4} />
        <DashboardPanelSkeleton rows={6} delay={-130} />
      </section>
    </div>
  )
}
