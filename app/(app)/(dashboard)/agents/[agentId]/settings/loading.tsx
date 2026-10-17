import {
  DangerZoneCardSkeleton,
  SettingsFormCardSkeleton,
} from '@/components/dashboard/agent-detail-skeletons'

/**
 * Route-level skeleton for /agents/[agentId]/settings — mirrors the page
 * below the agent tabs (AgentConfiguration, section="general"): the
 * name/description card, customer-identification card, messages card,
 * handoff card and the danger zone.
 */
export default function AgentSettingsLoading() {
  return (
    <div className="space-y-6">
      {/* Name + description */}
      <SettingsFormCardSkeleton rows={2} />

      {/* Customer identification */}
      <SettingsFormCardSkeleton delay={-90} rows={1} switchRow />

      {/* Messages (welcome / fallback) */}
      <SettingsFormCardSkeleton delay={-180} rows={2} />

      {/* Handoff to operator */}
      <SettingsFormCardSkeleton delay={-260} rows={1} switchRow />

      {/* Danger zone */}
      <DangerZoneCardSkeleton delay={-330} />
    </div>
  )
}
