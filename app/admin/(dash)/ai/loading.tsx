import { Skeleton } from '@/components/ui/skeleton'
import { ChartSkeleton, ModelCardSkeleton, PageHeaderSkeleton, PanelSkeleton, StatCardSkeleton, TableSkeleton } from '../admin-skeletons'

/** Skeleton Screen for /admin/ai — mirrors its real layout:
 *  header → account status card → 4 stat cards → 2 charts → managed models
 *  grid → usage tables. */
export default function AdminAiLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only" role="status">
        در حال بارگذاری اطلاعات…Loading…
      </span>
      <PageHeaderSkeleton />

      <div className="admin-card spatial-surface overflow-hidden rounded-[1.5rem] p-0">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4 border-b border-zinc-200 p-5 sm:p-6 lg:border-b-0 lg:border-l">
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-5 w-44 max-w-full rounded-md" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <Skeleton className="h-3.5 w-full rounded-md" />
                <Skeleton className="h-3.5 w-3/4 rounded-md" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton delay={-100} className="h-9 w-48 max-w-full rounded-xl" />
              <Skeleton delay={-220} className="h-9 w-44 max-w-full rounded-xl" />
            </div>
          </div>
          <div className="space-y-3 p-5 sm:p-6">
            <div className="space-y-3 rounded-2xl bg-zinc-50 p-3.5 ring-1 ring-zinc-200">
              <Skeleton className="h-5 w-44 max-w-full rounded-md" />
              <Skeleton className="h-3 w-full rounded-md" />
              <Skeleton className="h-3 w-5/6 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <Skeleton delay={index * -80} className="h-3 w-20 rounded-md" />
                  <Skeleton delay={index * -80} className="h-4 w-16 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton delay={-120} />
        <StatCardSkeleton delay={-240} />
        <StatCardSkeleton delay={-360} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartSkeleton delay={-80} />
        <ChartSkeleton delay={-200} />
      </div>

      <PanelSkeleton delay={-160} rows={4} />

      <div className="grid gap-2 xl:grid-cols-4">
        <ModelCardSkeleton />
        <ModelCardSkeleton delay={-110} />
        <ModelCardSkeleton delay={-220} />
        <ModelCardSkeleton delay={-330} />
      </div>

      <div className="space-y-4">
        <TableSkeleton delay={-100} rows={6} cols={6} minWidth={800} />
        <TableSkeleton delay={-220} rows={6} cols={7} minWidth={860} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <PanelSkeleton delay={-140} rows={5} />
        <PanelSkeleton delay={-260} rows={5} />
      </div>
    </div>
  )
}
