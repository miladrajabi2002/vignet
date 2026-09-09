import {
  AgentCardSkeleton,
  DashboardHeaderSkeleton,
} from '@/components/dashboard/dashboard-skeletons'

/**
 * Route-level skeleton for /agents.
 *
 * Mirrors the real page shape — PageHeader and the responsive agent
 * cards grid (1/2/3 columns) — with the staggered mobile-style shimmer.
 */
export default function AgentsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardHeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <AgentCardSkeleton key={index} delay={-index * 130} />
        ))}
      </div>
    </div>
  )
}
