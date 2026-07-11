import { AgentWizard } from '@/components/agent-builder/agent-wizard'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getPlatformAiConfig } from '@/lib/ai/platform-config'

const BUSINESSES = new Set(['instagram', 'store', 'services', 'education', 'messaging'])

export default async function NewAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ business?: string }>
}) {
  const query = await searchParams
  const business = query.business && BUSINESSES.has(query.business)
    ? query.business
    : undefined
  const user = await requireUser()
  const [workspace, policy] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: user.workspaceId }, select: { plan: true } }),
    getPlatformAiConfig(),
  ])

  return (
    <div className="py-4">
      <AgentWizard
        initialBusiness={business}
        modelPolicy={{
          plan: workspace?.plan ?? 'TRIAL',
          enabledModels: policy.enabledModels,
          trialModel: policy.trialModel,
        }}
      />
    </div>
  )
}
