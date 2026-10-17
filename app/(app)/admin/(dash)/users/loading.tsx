import { AdminLoadingShell, MobileCardsSkeleton, PageHeaderSkeleton, SearchBarSkeleton, StatGridSkeleton, TableSkeleton } from '../admin-skeletons'

/** Skeleton for /admin/users — header → search bar → 4 stat cards →
 *  phone cards (below md) / user table (md+). */
export default function AdminUsersLoading() {
  return (
    <AdminLoadingShell>
      <PageHeaderSkeleton />
      <SearchBarSkeleton />
      <StatGridSkeleton count={4} />
      <MobileCardsSkeleton delay={-160} />
      <div className="hidden md:block">
        <TableSkeleton delay={-160} rows={8} cols={6} minWidth={900} />
      </div>
    </AdminLoadingShell>
  )
}
