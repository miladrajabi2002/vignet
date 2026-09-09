import { CommerceTabsSkeleton, DashboardHeaderSkeleton } from '@/components/dashboard/dashboard-skeletons'
import {
  MobileOrderCardSkeleton,
  OrdersSearchSkeleton,
  OrdersTableSkeleton,
} from '@/components/dashboard/pages-skeletons'

/**
 * Route-level skeleton for /products/orders — an exact mirror of the page:
 * PageHeader (bulk-delete + total-count actions), commerce tabs, the
 * orders search form, the 7-column desktop table and the mobile order
 * cards.
 */
export default function ProductOrdersLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardHeaderSkeleton actions={2} />

      {/* Products / orders tabs */}
      <CommerceTabsSkeleton delay={-80} />

      {/* Search + status filter form */}
      <OrdersSearchSkeleton delay={-160} />

      {/* Desktop table */}
      <OrdersTableSkeleton delay={-200} rows={8} />

      {/* Mobile order cards */}
      <div className="grid gap-3 md:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <MobileOrderCardSkeleton key={index} delay={-200 - index * 110} />
        ))}
      </div>
    </div>
  )
}
