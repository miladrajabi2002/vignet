import { DashboardHeaderSkeleton } from '@/components/dashboard/dashboard-skeletons'
import {
  CollapsibleSettingsCardSkeleton,
  ScenariosSectionSkeleton,
} from '@/components/dashboard/pages-skeletons'

/**
 * Route-level skeleton for /agents/[agentId]/instagram — mirrors the
 * connected state below the agent tabs: PageHeader with add-scenario
 * action, the collapsible channel settings card and the scenarios section.
 */
export default function AgentInstagramLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <DashboardHeaderSkeleton actions={1} />
      <CollapsibleSettingsCardSkeleton delay={-80} />
      <ScenariosSectionSkeleton delay={-160} />
    </div>
  )
}
