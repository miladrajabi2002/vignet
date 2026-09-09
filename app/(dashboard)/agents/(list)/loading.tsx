import {
  AgentCardSkeleton,
  DashboardHeaderSkeleton,
  TipCardSkeleton,
} from '@/components/dashboard/dashboard-skeletons'

/**
 * Route-level skeleton for /agents — an exact mirror of the page:
 * PageHeader (1 action), the 1/2/3-column agent cards grid and the tip
 * card, with the staggered mobile-style shimmer.
 */
export default function AgentsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardHeaderSkeleton actions={1} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <AgentCardSkeleton key={index} delay={-index * 130} />
        ))}
      </div>
      <TipCardSkeleton delay={-200} />
    </div>
  )
}
