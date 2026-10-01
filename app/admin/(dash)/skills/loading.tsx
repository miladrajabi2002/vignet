import { AdminLoadingShell, BlockSkeleton, PageHeaderSkeleton } from '../admin-skeletons'

/** Skeleton for /admin/skills — header → the page's single main panel. */
export default function AdminSkillsLoading() {
  return (
    <AdminLoadingShell className="space-y-5">
      <PageHeaderSkeleton action={false} />
      <BlockSkeleton className="min-h-[24rem]" />
    </AdminLoadingShell>
  )
}
