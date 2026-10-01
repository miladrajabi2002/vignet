import { AdminLoadingShell, ChartSkeleton, PageHeaderSkeleton, PanelSkeleton, StatGridSkeleton } from '../admin-skeletons'

/** Skeleton for /admin/usage — header → 3 stat cards → usage chart, type
 *  breakdown, top models and top workspaces. */
export default function AdminUsageLoading() {
  return (
    <AdminLoadingShell>
      <PageHeaderSkeleton />
      <StatGridSkeleton count={3} className="grid grid-cols-1 gap-3 sm:grid-cols-3" />
      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <ChartSkeleton delay={-80} />
        <PanelSkeleton delay={-160} rows={4} />
        <PanelSkeleton delay={-240} rows={5} />
        <PanelSkeleton delay={-320} rows={5} />
      </div>
    </AdminLoadingShell>
  )
}
