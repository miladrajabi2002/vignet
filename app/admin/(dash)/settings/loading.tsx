import { AdminLoadingShell, BlockSkeleton, PageHeaderSkeleton } from '../admin-skeletons'

/** Skeleton for /admin/settings — header → the page's single main panel. */
export default function AdminSettingsLoading() {
  return (
    <AdminLoadingShell className="space-y-5">
      <PageHeaderSkeleton action={false} />
      <BlockSkeleton className="min-h-[24rem]" />
    </AdminLoadingShell>
  )
}
