import { PageHeaderSkeleton, StatCardSkeleton, TableSkeleton } from '../admin-skeletons'

/** Skeleton Screen for /admin/users — mirrors its real layout:
 *  header → 5 stat cards → user table (merged workspaces view). */
export default function AdminUsersLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only" role="status">
        در حال بارگذاری اطلاعات…Loading…
      </span>
      <PageHeaderSkeleton />

      <div className="grid grid-cols-2 gap-3 min-[1380px]:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton delay={-120} />
        <StatCardSkeleton delay={-240} />
        <StatCardSkeleton delay={-360} />
        <StatCardSkeleton delay={-480} />
      </div>

      <TableSkeleton delay={-160} rows={8} cols={6} minWidth={900} />
    </div>
  )
}
