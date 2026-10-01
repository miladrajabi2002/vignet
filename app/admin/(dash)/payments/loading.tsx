import { AdminLoadingShell, MobileCardsSkeleton, PageHeaderSkeleton, SearchBarSkeleton, StatGridSkeleton, TableSkeleton } from '../admin-skeletons'

/** Skeleton for /admin/payments — header → search + filters → 4 stat
 *  cards → phone cards / payments table. */
export default function AdminPaymentsLoading() {
  return (
    <AdminLoadingShell>
      <PageHeaderSkeleton />
      <SearchBarSkeleton />
      <StatGridSkeleton count={4} />
      <MobileCardsSkeleton delay={-160} />
      <div className="hidden md:block">
        <TableSkeleton delay={-160} rows={8} cols={7} minWidth={900} />
      </div>
    </AdminLoadingShell>
  )
}
