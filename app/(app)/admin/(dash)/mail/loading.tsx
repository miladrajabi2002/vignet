import { AdminLoadingShell, BlockSkeleton, PageHeaderSkeleton } from '../admin-skeletons'

/** Skeleton for /admin/mail — header → the page's single main panel. */
export default function AdminMailLoading() {
  return (
    <AdminLoadingShell className="space-y-5">
      <PageHeaderSkeleton action={false} />
      <BlockSkeleton className="min-h-[24rem]" />
    </AdminLoadingShell>
  )
}
