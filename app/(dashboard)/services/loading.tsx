import { DashboardHeaderSkeleton } from '@/components/dashboard/dashboard-skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Route-level skeleton for /services — an exact mirror of the page:
 * PageHeader (1 action), the 3-cell KPI strip beside search + status tabs,
 * then the service card grid with its dashed "add service" tile.
 */
export default function ServicesLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="در حال بارگذاری خدمات"
      className="mx-auto max-w-6xl space-y-5"
    >
      <span className="sr-only">در حال بارگذاری خدمات...</span>
      <DashboardHeaderSkeleton actions={1} />

      {/* KPI strip beside search + status tabs */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <dl className="grid grid-cols-3 divide-x divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white/80 rtl:divide-x-reverse lg:w-[26rem] lg:shrink-0">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex flex-col items-center gap-1.5 py-3">
              <Skeleton delay={-index * 80} className="h-6 w-10 max-w-full rounded-lg" />
              <Skeleton delay={-index * 80 - 40} className="h-3 w-14 max-w-full rounded-full" />
            </div>
          ))}
        </dl>
        <div className="relative min-w-0 flex-1">
          <Skeleton delay={-180} className="h-12 w-full rounded-2xl" />
        </div>
        <div className="ui-seg grid-cols-3 sm:w-64" role="tablist">
          {Array.from({ length: 3 }).map((_, index) => (
            <span key={index} className="ui-seg-tab text-xs" data-active={index === 0 ? 'true' : undefined}>
              <Skeleton delay={-240 - index * 90} className="h-3.5 w-12 rounded-full" />
            </span>
          ))}
        </div>
      </div>

      {/* Service cards + dashed add tile */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <article key={index} className="spatial-surface flex flex-col rounded-card p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <Skeleton delay={-index * 110} className="h-4 w-1/2 max-w-full rounded-md" />
                <Skeleton delay={-index * 110 - 60} className="mt-1.5 h-3 w-3/4 max-w-full rounded-full" />
                <Skeleton delay={-index * 110 - 120} className="mt-1 h-3 w-2/3 max-w-full rounded-full" />
              </div>
              <Skeleton delay={-index * 110 - 180} className="h-5 w-9 shrink-0 rounded-full" />
            </div>
            <Skeleton delay={-index * 110 - 240} className="mt-2 h-3 w-2/3 max-w-full rounded-full" />
            <div className="mt-2.5 flex items-center gap-1.5">
              {Array.from({ length: 7 }).map((_, dot) => (
                <Skeleton key={dot} delay={-index * 110 - 280 - dot * 30} className="h-2 w-2 rounded-full" />
              ))}
            </div>
            <div className="mt-auto flex items-center gap-1.5 pt-3">
              <Skeleton delay={-index * 110 - 340} className="h-3 w-12 rounded-full" />
              <Skeleton delay={-index * 110 - 380} className="ms-auto h-11 w-24 rounded-xl" />
              <Skeleton delay={-index * 110 - 420} className="h-10 w-10 shrink-0 rounded-xl" />
              <Skeleton delay={-index * 110 - 460} className="h-11 w-20 shrink-0 rounded-xl" />
            </div>
          </article>
        ))}
        <div className="grid min-h-[9rem] place-items-center rounded-card border-2 border-dashed border-[var(--border-default)] p-6 text-center">
          <span className="flex flex-col items-center gap-2">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <Skeleton delay={-90} className="h-4 w-24 rounded-md" />
          </span>
        </div>
      </div>
    </div>
  )
}
