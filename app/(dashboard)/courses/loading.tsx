import { DashboardHeaderSkeleton } from '@/components/dashboard/dashboard-skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Route-level skeleton for /courses — an exact mirror of the page:
 * PageHeader (1 action), the status segmented tabs beside the 4-cell KPI
 * strip, the 2-column course cards, and the agent enrollment strip.
 */
export default function CoursesLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto max-w-6xl space-y-5"
    >
      <span className="sr-only">در حال بارگذاری دوره‌ها...</span>
      <DashboardHeaderSkeleton actions={1} />

      {/* Status tabs + 4-cell KPI strip */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="ui-seg w-full grid-cols-3 lg:w-[24rem]" role="tablist">
          {Array.from({ length: 3 }).map((_, index) => (
            <span key={index} className="ui-seg-tab text-sm" data-active={index === 0 ? 'true' : undefined}>
              <Skeleton delay={-index * 90} className="h-3.5 w-12 rounded-full" />
              <Skeleton delay={-index * 90} className="h-5 w-7 rounded-full" />
            </span>
          ))}
        </div>
        <dl className="grid grid-cols-4 divide-x divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white/80 rtl:divide-x-reverse lg:min-w-[28rem]">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-col items-center gap-1.5 py-3">
              <Skeleton delay={-120 - index * 80} className="h-6 w-10 max-w-full rounded-lg" />
              <Skeleton delay={-150 - index * 80} className="h-3 w-14 max-w-full rounded-full" />
            </div>
          ))}
        </dl>
      </div>

      {/* Course cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={index} className="spatial-surface flex flex-col gap-3 rounded-card p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <Skeleton delay={-index * 110} className="h-10 w-10 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Skeleton delay={-index * 110} className="h-[15px] w-32 max-w-full rounded-md" />
                  <Skeleton delay={-index * 110 - 60} className="h-5 w-16 shrink-0 rounded-full" />
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <Skeleton delay={-index * 110 - 120} className="h-3 w-14 rounded-full" />
                  <Skeleton delay={-index * 110 - 160} className="h-3 w-16 rounded-full" />
                  <Skeleton delay={-index * 110 - 200} className="h-3 w-12 rounded-full" />
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Skeleton delay={-index * 110 - 240} className="h-3 w-20 rounded-full" />
                <Skeleton delay={-index * 110 - 280} className="h-3 w-14 rounded-full" />
              </div>
              <Skeleton delay={-index * 110 - 320} className="mt-1.5 h-2 w-full rounded-full" />
            </div>
            <Skeleton delay={-index * 110 - 360} className="h-9 w-full rounded-xl" />
            <div className="mt-auto flex gap-2">
              <Skeleton delay={-index * 110 - 400} className="h-11 flex-1 rounded-xl" />
              <Skeleton delay={-index * 110 - 440} className="h-11 w-24 rounded-xl" />
            </div>
          </article>
        ))}
      </div>

      {/* Agent enrollment strip */}
      <section className="spatial-surface rounded-card p-4 sm:p-5">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
          <Skeleton delay={-90} className="h-5 w-36 rounded-md" />
        </div>
        <ol className="mt-3 grid gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <li key={index} className="flex items-start gap-2 rounded-xl bg-[var(--bg-subtle)] px-3 py-2">
              <Skeleton delay={-index * 90} className="mt-0.5 h-5 w-5 shrink-0 rounded-full" />
              <Skeleton delay={-index * 90 - 60} className="h-3.5 w-full max-w-[9rem] rounded-full" />
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
