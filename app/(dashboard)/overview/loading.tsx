import { Skeleton } from '@/components/ui/skeleton'
import {
  DashboardHeaderSkeleton,
  DashboardPanelSkeleton,
  KpiCardSkeleton,
} from '@/components/dashboard/dashboard-skeletons'

/**
 * Route-level skeleton for /overview (the dashboard landing page).
 *
 * Mirrors the real page shape — arrival hero (intro card + intelligence
 * core), the Vigento AI card, the 4-up KPI row and the two dashboard
 * panels — with the same mobile-style shimmer (staggered per card) users
 * know from «تحلیل و بهبود» and the admin panel. The completion
 * checklist is intentionally not skeletoned: it renders only for
 * brand-new workspaces and is instant either way.
 */
export default function OverviewLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
      {/* ── Arrival hero: intro card + intelligence core ── */}
      <section className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="dashboard-arrival dashboard-intro relative overflow-hidden rounded-[1.75rem] border border-[var(--border-default)] p-5 sm:p-7">
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton delay={-90} className="h-3 w-24 rounded-full" />
            </div>
            <Skeleton className="mt-5 h-3 w-40 rounded-md" />
            <Skeleton className="mt-2 h-8 w-72 max-w-full rounded-lg" />
            <Skeleton delay={-120} className="mt-2.5 h-4 w-full max-w-xl rounded-md" />
            <Skeleton delay={-240} className="mt-1.5 h-4 w-2/3 max-w-xl rounded-md" />
            <div className="mt-5 divide-y divide-[var(--border-default)] overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between gap-3 px-3.5 py-3">
                  <div className="flex items-center gap-2.5">
                    <Skeleton delay={-index * 110} className="h-5 w-5 rounded" />
                    <Skeleton delay={-index * 110} className="h-3.5 w-28 rounded-md" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton delay={-index * 110} className="h-5 w-10 rounded-lg" />
                    <Skeleton delay={-index * 110} className="h-5 w-5 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Skeleton className="h-11 w-44 rounded-xl" />
              <Skeleton delay={-110} className="h-11 w-36 rounded-xl" />
            </div>
          </div>
        </div>
        <DashboardPanelSkeleton chartHeight={220} className="dashboard-arrival dashboard-arrival--core" />
      </section>

      {/* ── Vigento AI copilot card ── */}
      <div className="spatial-surface overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-5 w-36 max-w-full rounded-md" />
              <Skeleton delay={-90} className="h-3 w-48 max-w-full rounded-md" />
            </div>
          </div>
          <Skeleton delay={-140} className="h-11 w-40 shrink-0 rounded-xl" />
        </div>
      </div>

      {/* ── KPI row ── */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCardSkeleton />
        <KpiCardSkeleton delay={-110} />
        <KpiCardSkeleton delay={-220} />
        <KpiCardSkeleton delay={-330} />
      </section>

      {/* ── Panels: trend + recent conversations ── */}
      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <DashboardPanelSkeleton chartHeight={200} />
        <DashboardPanelSkeleton rows={5} delay={-130} />
      </section>

      {/* ── Panels: activity + modules ── */}
      <section className="grid min-w-0 gap-4 xl:grid-cols-[1fr_0.72fr]">
        <DashboardPanelSkeleton rows={4} />
        <DashboardPanelSkeleton rows={4} delay={-130} />
      </section>
    </div>
  )
}
