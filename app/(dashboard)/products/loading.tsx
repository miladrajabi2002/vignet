import {
  CommerceTabsSkeleton,
  DashboardHeaderSkeleton,
  DashboardPanelSkeleton,
  ProductCardSkeleton,
  SetupCardSkeleton,
} from '@/components/dashboard/dashboard-skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Route-level skeleton for /products — an exact mirror of the page:
 * PageHeader (3 actions), commerce tabs, setup card, trend/top-products
 * panels, toolbar, 3-column product grid and pagination. Uses the shared
 * mobile-style shimmer primitive.
 */
export default function ProductsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardHeaderSkeleton actions={3} />

      {/* Products / orders tabs */}
      <CommerceTabsSkeleton delay={-80} />

      {/* WooSetupCard */}
      <SetupCardSkeleton delay={-160} />

      {/* Trend chart + top products */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardPanelSkeleton action={false}>
          <Skeleton className="h-[12.5rem] w-full rounded-xl sm:h-60" />
        </DashboardPanelSkeleton>
        <DashboardPanelSkeleton delay={-130} action={false}>
          <div className="space-y-3.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-3">
                <Skeleton delay={-130 - index * 90} className="h-3.5 w-32 max-w-full rounded-full" />
                <Skeleton delay={-130 - index * 90} className="h-4 w-10 shrink-0 rounded-md" />
              </div>
            ))}
          </div>
        </DashboardPanelSkeleton>
      </div>

      {/* Toolbar */}
      <div className="spatial-surface flex flex-wrap items-center gap-2 rounded-[1.35rem] p-2.5 shadow-[0_14px_36px_rgba(0,0,0,0.08)] md:rounded-[1.5rem] md:p-4 md:shadow-[var(--shadow-card)]">
        <Skeleton className="h-11 min-w-[12rem] flex-1 rounded-xl" />
        <Skeleton delay={-90} className="h-11 min-w-40 rounded-xl" />
        <Skeleton delay={-180} className="h-11 min-w-40 rounded-xl" />
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <ProductCardSkeleton key={index} delay={-index * 120} />
        ))}
      </div>

      {/* Pagination */}
      <nav className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <Skeleton className="h-11 w-24 rounded-xl" />
        <Skeleton delay={-80} className="h-11 w-11 rounded-xl" />
        <Skeleton delay={-160} className="h-11 w-11 rounded-xl" />
        <Skeleton delay={-240} className="h-11 w-24 rounded-xl" />
      </nav>
    </div>
  )
}
