import { Skeleton } from '@/components/ui/skeleton'
import { AdminLoadingShell, ChartSkeleton, PageHeaderSkeleton, PanelSkeleton, StatCardSkeleton, StatGridSkeleton } from '../admin-skeletons'

/** Skeleton for /admin/revenue — header → summary panel with 6 cards →
 *  4 stat cards → monthly chart → two breakdown panels. */
export default function AdminRevenueLoading() {
  return (
    <AdminLoadingShell>
      <PageHeaderSkeleton />
      <div className="admin-card spatial-surface rounded-card p-4 sm:p-6">
        <Skeleton className="h-4 w-48 max-w-full rounded-md" />
        <Skeleton className="mt-2 h-3 w-64 max-w-full rounded-md" />
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <StatCardSkeleton key={index} delay={-index * 90} />)}
        </div>
      </div>
      <StatGridSkeleton count={4} />
      <ChartSkeleton delay={-120} />
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton delay={-160} rows={5} />
        <PanelSkeleton delay={-280} rows={4} />
      </div>
    </AdminLoadingShell>
  )
}
