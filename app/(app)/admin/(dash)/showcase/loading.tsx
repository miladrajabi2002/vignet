import { AdminLoadingShell, BlockSkeleton, PageHeaderSkeleton, StatGridSkeleton } from '../admin-skeletons'

/** Skeleton for /admin/showcase — header → 4 stat cards → showcase
 *  manager → trusted logos manager. */
export default function AdminShowcaseLoading() {
  return (
    <AdminLoadingShell>
      <PageHeaderSkeleton />
      <StatGridSkeleton count={4} />
      <BlockSkeleton delay={-120} />
      <BlockSkeleton delay={-240} />
    </AdminLoadingShell>
  )
}
