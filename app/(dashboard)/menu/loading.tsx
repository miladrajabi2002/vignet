import { DashboardHeaderSkeleton } from '@/components/dashboard/dashboard-skeletons'
import { MenuShareSkeleton } from '@/components/dashboard/pages-skeletons'

/** Route-level skeleton for /menu — mirrors MenuWorkspace. */
export default function MenuLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <DashboardHeaderSkeleton />
      <MenuShareSkeleton delay={-80} />
    </div>
  )
}
