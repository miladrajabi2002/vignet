import { AgentBuilderEntry } from '@/components/agent-builder/agent-builder-entry'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getPlatformAiConfig } from '@/lib/ai/platform-config'
import { getPlanReplyPricesIRR } from '@/lib/billing/plans'

const BUSINESSES = new Set([
  'instagram',
  'commerce',
  'store',
  'food',
  'appointments',
  'services',
  'education',
  'support',
  'messaging',
  'custom',
])

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
  const [workspace, policy, workspaceProductCount] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { plan: true, aiCreditBalanceIRR: true },
    }),
    getPlatformAiConfig(),
    prisma.product.count({ where: { workspaceId: user.workspaceId, active: true } }),
  ])

  return (
    <div className="py-4">
      <AgentBuilderEntry
        initialBusiness={business}
        workspaceProductCount={workspaceProductCount}
        modelPolicy={{
          plan: workspace?.plan ?? 'TRIAL',
          enabledModels: policy.enabledModels,
          trialModel: policy.trialModel,
          creditBalanceIRR: workspace?.aiCreditBalanceIRR ?? 0,
          replyPricesIRR: getPlanReplyPricesIRR(workspace?.plan ?? 'TRIAL'),
        }}
      />
    </div>
  )
}
