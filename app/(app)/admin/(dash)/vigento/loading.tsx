import { Skeleton } from '@/components/ui/skeleton'

/** Skeleton for /admin/vigento — the full-height console plus its rail. */
export default function AdminVigentoLoading() {
  return (
    <div className="flex h-[calc(100dvh-8.25rem)] min-h-[38rem] gap-4 overflow-hidden" aria-busy="true">
      <span className="sr-only" role="status">در حال بارگذاری اطلاعات…</span>
      <div className="spatial-surface flex min-w-0 flex-1 flex-col rounded-card p-4">
        <Skeleton className="h-10 w-56 max-w-full rounded-xl" />
        <div className="flex-1" />
        <Skeleton delay={-120} className="h-14 w-full rounded-2xl" />
      </div>
      <div className="spatial-surface hidden w-[17.5rem] shrink-0 space-y-2 rounded-card p-4 lg:block">
        {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} delay={-index * 70} className="h-11 w-full rounded-xl" />)}
      </div>
    </div>
  )
}
