import {
  ArrivalIntroSkeleton,
  DashboardPanelSkeleton,
  IntelligenceCoreSkeleton,
  ModuleTileSkeleton,
  OutcomeCardSkeleton,
  PlanCreditSkeleton,
  RecentCaseRowSkeleton,
  VigentoCardSkeleton,
} from '@/components/dashboard/dashboard-skeletons'

/**
 * Route-level skeleton for /overview — an exact mirror of the page:
 * arrival hero (intro card + intelligence core), Vigento AI copilot card,
 * 4-up outcome KPI row, trend + recent cases, tools + plan & credit.
 * Same staggered mobile-style shimmer as the rest of the product.
 */
export default function OverviewLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
      {/* ── Arrival hero: intro card + intelligence core ── */}
      <section className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <ArrivalIntroSkeleton />
        <IntelligenceCoreSkeleton delay={-160} />
      </section>

      {/* ── Vigento AI copilot card ── */}
      <VigentoCardSkeleton delay={-80} />

      {/* ── KPI row (4 outcome cards) ── */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <OutcomeCardSkeleton />
        <OutcomeCardSkeleton delay={-110} />
        <OutcomeCardSkeleton delay={-220} />
        <OutcomeCardSkeleton delay={-330} />
      </section>

      {/* ── Trend chart + recent cases (same 2-col grid as the page at xl) ── */}
      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <DashboardPanelSkeleton chartHeight={220} />
        <DashboardPanelSkeleton
          delay={-130}
          bodyClassName="divide-y divide-[var(--border-subtle)] -mx-5 sm:-mx-6"
        >
          <div className="px-5 sm:px-6">
            <div className="divide-y divide-[var(--border-subtle)]">
              {Array.from({ length: 4 }).map((_, index) => (
                <RecentCaseRowSkeleton key={index} delay={-index * 110} />
              ))}
            </div>
          </div>
        </DashboardPanelSkeleton>
      </section>

      {/* ── Tools + plan & credit ── */}
      <section className="grid gap-4 xl:grid-cols-[1fr_0.72fr]">
        <DashboardPanelSkeleton>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <ModuleTileSkeleton key={index} delay={-index * 70} />
            ))}
          </div>
        </DashboardPanelSkeleton>
        <DashboardPanelSkeleton delay={-130} action>
          <PlanCreditSkeleton delay={-130} />
        </DashboardPanelSkeleton>
      </section>
    </div>
  )
}
