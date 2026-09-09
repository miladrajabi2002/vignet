import {
  ChannelAccordionSkeleton,
  ChannelCardSkeleton,
  DashedStoreLinkSkeleton,
  QuotaCardSkeleton,
} from '@/components/dashboard/agent-detail-skeletons'

/**
 * Route-level skeleton for /agents/[agentId]/channels — mirrors the page
 * below the agent tabs: quota card with progress bar, the 6 channel
 * sections (accordion on mobile, stacked cards on desktop) and the dashed
 * store-integrations link card.
 */
export default function AgentChannelsLoading() {
  return (
    <div className="space-y-6">
      {/* Channel quota */}
      <QuotaCardSkeleton />

      {/* Channel sections — mobile accordion + desktop cards */}
      <ChannelAccordionSkeleton delay={-80} />
      <div className="hidden space-y-6 md:block">
        {Array.from({ length: 6 }).map((_, index) => (
          <ChannelCardSkeleton key={index} delay={-120 - index * 90} />
        ))}
      </div>

      {/* Store integrations link */}
      <DashedStoreLinkSkeleton delay={-300} />
    </div>
  )
}
