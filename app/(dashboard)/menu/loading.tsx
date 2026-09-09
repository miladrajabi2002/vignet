import { DashboardHeaderSkeleton } from '@/components/dashboard/dashboard-skeletons'
import { MenuShareSkeleton } from '@/components/dashboard/pages-skeletons'

/**
 * Route-level skeleton for /menu — mirrors the MenuShareCard page:
 * PageHeader and the 1fr/22rem grid (info section with link row and mini
 * stats + the QR code aside).
 */
export default function MenuLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <DashboardHeaderSkeleton />
      <MenuShareSkeleton delay={-80} />
    </div>
  )
}
