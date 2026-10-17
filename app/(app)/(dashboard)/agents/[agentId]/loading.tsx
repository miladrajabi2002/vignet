import {
  AgentGrowthPanelSkeleton,
  PlaygroundCardSkeleton,
} from '@/components/dashboard/agent-detail-skeletons'

/**
 * Route-level skeleton for /agents/[agentId] — mirrors ONLY the page
 * content below the agent layout (header card + tabs stay mounted during
 * tab switches): the test-playground/growth grid. The source class carries
 * an `inmax` typo whose rule lands in the page's (late) CSS chunk, so the
 * loading file uses the equivalent well-formed arbitrary class — identical
 * column ratios, available from the first painted frame.
 */
export default function AgentDetailLoading() {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      {/* LEFT: instant response test playground */}
      <PlaygroundCardSkeleton />

      {/* RIGHT: growth panel (connections + actions) */}
      <AgentGrowthPanelSkeleton delay={-120} />
    </div>
  )
}
