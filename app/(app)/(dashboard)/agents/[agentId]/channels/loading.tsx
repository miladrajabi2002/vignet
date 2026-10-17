import {
  ChannelBoardSkeleton,
  DashedStoreLinkSkeleton,
  QuotaCardSkeleton,
} from '@/components/dashboard/agent-detail-skeletons'

/**
 * Route-level skeleton for /agents/[agentId]/channels — mirrors the page
 * below the agent tabs: quota card with progress bar, the board of 6
 * connection cards and the dashed store-integrations link card.
 */
export default function AgentChannelsLoading() {
  return (
    <div className="space-y-6">
      {/* Channel quota */}
      <QuotaCardSkeleton />

      {/* Connection cards */}
      <ChannelBoardSkeleton delay={-80} />

      {/* Store integrations link */}
      <DashedStoreLinkSkeleton delay={-300} />
    </div>
  )
}
