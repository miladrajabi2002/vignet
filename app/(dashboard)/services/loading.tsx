import { DashboardHeaderSkeleton } from '@/components/dashboard/dashboard-skeletons'
import {
  EmptyDashedCardSkeleton,
  SearchBarSkeleton,
  ServiceStatTileSkeleton,
} from '@/components/dashboard/pages-skeletons'

/**
 * Route-level skeleton for /services — mirrors the page: PageHeader with
 * the new-service action, the 2 horizontal stat tiles, the search bar and
 * the catalog state (empty dashed card for a fresh catalog, service cards
 * appear once registered).
 */
export default function ServicesLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <DashboardHeaderSkeleton actions={1} />

      {/* Stat row — two compact tiles */}
      <div className="grid grid-cols-2 gap-4">
        <ServiceStatTileSkeleton />
        <ServiceStatTileSkeleton delay={-90} />
      </div>

      {/* Sticky search bar */}
      <SearchBarSkeleton delay={-160} />

      {/* Catalog */}
      <EmptyDashedCardSkeleton delay={-200} />
    </div>
  )
}
