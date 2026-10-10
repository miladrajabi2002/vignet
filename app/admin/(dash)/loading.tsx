import { AdminLoadingShell, ChartSkeleton, PageHeaderSkeleton, PanelSkeleton, StatGridSkeleton } from './admin-skeletons'

/**
 * Skeleton for /admin (the dashboard home) — mirrors it exactly:
 * header with range switch → 8 KPI cards → active users + plan mix →
 * revenue + conversations charts. Every other admin page has its own
 * loading.tsx so no page borrows this shape.
 */
export default function AdminDashLoading() {
  return (
    <AdminLoadingShell>
      <PageHeaderSkeleton />
      <StatGridSkeleton count={8} />
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton delay={-140} rows={6} />
        <PanelSkeleton delay={-260} rows={6} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartSkeleton delay={-80} />
        <ChartSkeleton delay={-200} />
      </div>
    </AdminLoadingShell>
  )
}
