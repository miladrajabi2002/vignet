import { AdminLoadingShell, BlockSkeleton, ChartSkeleton, PageHeaderSkeleton, PanelSkeleton, StatGridSkeleton } from '../admin-skeletons'

/** Skeleton for /admin/blog — header → 4 stat cards → views chart + top
 *  posts → the post manager. */
export default function AdminBlogLoading() {
  return (
    <AdminLoadingShell>
      <PageHeaderSkeleton />
      <StatGridSkeleton count={4} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartSkeleton delay={-100} />
        <PanelSkeleton delay={-220} rows={5} />
      </div>
      <BlockSkeleton delay={-160} />
    </AdminLoadingShell>
  )
}
