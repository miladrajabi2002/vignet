import { DashboardHeaderSkeleton } from '@/components/dashboard/dashboard-skeletons'
import {
  ChannelTileSkeleton,
  SectionHeadingRowSkeleton,
  StoreSectionSkeleton,
} from '@/components/dashboard/pages-skeletons'

/**
 * Route-level skeleton for /integrations — an exact mirror of the page:
 * PageHeader, the WordPress/WooCommerce store section (empty-state card +
 * footer help), the channels section heading and the 6-channel tile grid
 * (ChatLink + Web widget + Telegram + Bale + Rubika + Instagram).
 */
export default function IntegrationsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardHeaderSkeleton />

      {/* StoreIntegrationsSection — header + empty-state card + footer help */}
      <StoreSectionSkeleton delay={-80} />

      {/* «کانال‌ها» heading + manage-in-agent link */}
      <SectionHeadingRowSkeleton delay={-160} />

      {/* Channel tiles: 1 chat-link + 5 channels */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <ChannelTileSkeleton key={index} delay={-200 - index * 90} />
        ))}
      </div>
    </div>
  )
}
