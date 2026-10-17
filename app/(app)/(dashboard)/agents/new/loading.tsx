import { AgentWizardSkeleton } from '@/components/dashboard/agent-detail-skeletons'

/**
 * Route-level skeleton for /agents/new — mirrors the AgentWizard:
 * step label, progress bar, the step card with its fields and the
 * previous/next navigation buttons.
 */
export default function NewAgentLoading() {
  return (
    <div className="py-4">
      <AgentWizardSkeleton />
    </div>
  )
}
