import { DashboardPanelSkeleton } from '@/components/dashboard/dashboard-skeletons'
import { AgentStatCardSkeleton } from '@/components/dashboard/agent-detail-skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Route-level skeleton for /agents/[agentId]/analytics — mirrors the page
 * below the agent tabs: 4 stat cards (grid-cols-2 → lg:4), the status
 * donut + 14-day trend grid, the channel breakdown + top products grid and
 * the unanswered-queries panel.
 */
export default function AgentAnalyticsLoading() {
  return (
    <div className="space-y-6">
      {/* Stat row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <AgentStatCardSkeleton key={index} delay={-index * 90} />
        ))}
      </div>

      {/* Status donut + conversation trend */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardPanelSkeleton delay={-120}>
          <div className="flex items-center justify-center">
            <Skeleton className="h-[11.25rem] w-[11.25rem] rounded-full" />
          </div>
        </DashboardPanelSkeleton>
        <DashboardPanelSkeleton delay={-180} action={false}>
          <Skeleton className="h-[12.5rem] w-full rounded-xl sm:h-60" />
        </DashboardPanelSkeleton>
      </div>

      {/* Channel breakdown + top products */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardPanelSkeleton delay={-220}>
          <div className="flex items-center justify-center">
            <Skeleton className="h-[11.25rem] w-[11.25rem] rounded-full" />
          </div>
        </DashboardPanelSkeleton>
        <DashboardPanelSkeleton delay={-260} action={false}>
          <div className="space-y-3.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-3">
                <Skeleton delay={-260 - index * 90} className="h-3.5 w-32 max-w-full rounded-full" />
                <Skeleton delay={-260 - index * 90} className="h-4 w-10 shrink-0 rounded-md" />
              </div>
            ))}
          </div>
        </DashboardPanelSkeleton>
      </div>

      {/* Unanswered queries */}
      <DashboardPanelSkeleton delay={-300} action={false}>
        <ul className="divide-y divide-[var(--border-subtle)]">
          {Array.from({ length: 3 }).map((_, index) => (
            <li key={index} className="flex items-start gap-3 py-3">
              <Skeleton delay={-300 - index * 100} className="mt-0.5 h-8 w-8 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton delay={-300 - index * 100} className="h-3.5 w-3/4 max-w-full rounded-md" />
                <Skeleton delay={-300 - index * 100} className="h-3 w-24 rounded-md" />
              </div>
            </li>
          ))}
        </ul>
      </DashboardPanelSkeleton>
    </div>
  )
}
