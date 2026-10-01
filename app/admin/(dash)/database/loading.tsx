import { AdminLoadingShell, BlockSkeleton, PageHeaderSkeleton } from '../admin-skeletons'

/** Skeleton for /admin/database — header → the page's single main panel. */
export default function AdminDBLoading() {
  return (
    <AdminLoadingShell className="space-y-5">
      <PageHeaderSkeleton />
      <BlockSkeleton className="min-h-[24rem]" />
    </AdminLoadingShell>
  )
}
