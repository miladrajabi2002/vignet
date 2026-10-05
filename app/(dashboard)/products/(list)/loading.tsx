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
 * PageHeader (3 compact actions), commerce tabs, setup card, the desktop
 * stock tabs, the search/sort toolbar with view toggle, the product grid,
 * pagination, and the trend + top-products panels *under* the list.
 */
export default function ProductsLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="در حال بارگذاری محصولات"
      className="mx-auto max-w-6xl space-y-6"
    >
      <span className="sr-only">در حال بارگذاری محصولات...</span>
      <DashboardHeaderSkeleton actions={3} compactOnMobile />

      {/* Products / orders / requests tabs */}
      <CommerceTabsSkeleton delay={-80} />

      {/* WooSetupCard */}
      <SetupCardSkeleton delay={-160} />

      {/* Stock tabs (desktop only, underlined tab strip) */}
      <nav className="-mb-2 hidden gap-1 overflow-x-auto border-b border-[var(--border-subtle)] md:flex [scrollbar-width:none]" aria-label="stock filter">
        {Array.from({ length: 4 }).map((_, index) => (
          <span
            key={index}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 border-transparent px-2.5"
          >
            <Skeleton delay={-200 - index * 70} className="h-3.5 w-14 rounded-full" />
            <Skeleton delay={-230 - index * 70} className="h-5 w-8 rounded-full" />
          </span>
        ))}
      </nav>

      {/* Toolbar: compact search + filters on phones, search + selects + view toggle on md+ */}
      <div className="sticky top-[5.35rem] z-20 md:static md:z-auto">
        <div className="spatial-surface rounded-card p-2.5 shadow-[var(--elev-1)] md:p-4 md:shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 md:hidden">
            <Skeleton className="h-11 min-w-[12rem] flex-1 rounded-xl" />
            <Skeleton delay={-90} className="h-11 w-11 shrink-0 rounded-xl" />
          </div>
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            <Skeleton className="h-11 min-w-[12rem] flex-1 rounded-control" />
            <Skeleton delay={-90} className="h-11 min-w-40 rounded-control" />
            <Skeleton delay={-180} className="h-11 min-w-40 rounded-control" />
            <div className="ms-auto flex items-center gap-2">
              <Skeleton delay={-270} className="h-7 w-28 rounded-full" />
              <div className="flex items-center gap-1 rounded-xl border border-[var(--border-default)] p-1">
                <Skeleton delay={-320} className="h-9 w-9 rounded-lg" />
                <Skeleton delay={-360} className="h-9 w-9 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <ProductCardSkeleton key={index} delay={-index * 120} />
        ))}
      </div>

      {/* Pagination */}
      <nav className="flex items-center justify-center gap-1.5 pt-2 sm:gap-2">
        <Skeleton className="h-9 w-9 rounded-control" />
        <Skeleton delay={-90} className="h-9 min-w-9 rounded-control" />
        <Skeleton delay={-180} className="h-9 min-w-9 rounded-control" />
        <Skeleton delay={-270} className="h-9 min-w-9 rounded-control" />
        <Skeleton delay={-360} className="h-9 w-9 rounded-control" />
      </nav>

      {/* Trend chart + top products — under the list, like the page */}
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
    </div>
  )
}
