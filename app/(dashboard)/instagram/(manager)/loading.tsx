import { DashboardHeaderSkeleton } from '@/components/dashboard/dashboard-skeletons'
import {
  CollapsibleSettingsCardSkeleton,
  ScenariosSectionSkeleton,
} from '@/components/dashboard/pages-skeletons'

/**
 * Route-level skeleton for the workspace /instagram page — mirrors the
 * connected state (agent Instagram tab embedded here): PageHeader with the
 * add-scenario action, the collapsible channel-settings card and the
 * scenarios section (3-tab bar + 2 scenario cards).
 */
export default function InstagramWorkspaceLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <DashboardHeaderSkeleton actions={1} />

      {/* Channel settings card (reply policy + stop words, collapsed) */}
      <CollapsibleSettingsCardSkeleton delay={-80} />

      {/* Scenarios: header + tab bar + cards */}
      <ScenariosSectionSkeleton delay={-160} />
    </div>
  )
}
