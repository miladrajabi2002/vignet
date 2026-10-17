import {
  ImproveBehaviorSkeleton,
  TabPillsBarSkeleton,
} from '@/components/dashboard/agent-detail-skeletons'

/**
 * Route-level skeleton for /agents/[agentId]/improve — mirrors the page
 * below the agent tabs: the ImprovementTabs bar (behavior / knowledge /
 * learning + pending badge) and the default behavior panel (intro card +
 * prompt-engine card with layer tabs and editors).
 */
export default function AgentImproveLoading() {
  return (
    <div className="space-y-6">
      <TabPillsBarSkeleton />
      <ImproveBehaviorSkeleton delay={-80} />
    </div>
  )
}
