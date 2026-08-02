import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
  AgentSettingsForm,
  type AgentSettingsData,
} from '@/components/agents/agent-settings-form'
import { getPlatformAiConfig } from '@/lib/ai/platform-config'
import { getEffectivePlanReplyPricesIRR } from '@/lib/billing/plans'

export default async function AgentSettingsPage(
  props: {
    params: Promise<{ agentId: string }>
  }
) {
  const params = await props.params;
  const user = await requireUser()

  const [agent, workspace, platformPolicy] = await Promise.all([
    prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    }),
    prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: { plan: true, aiCreditBalanceIRR: true, businessType: true },
    }),
    getPlatformAiConfig(),
  ])
  if (!agent) notFound()

  return (
    <div className="space-y-6">
      <AgentSettingsForm
        businessType={workspace?.businessType}
        modelPolicy={{
          plan: workspace?.plan ?? 'TRIAL',
          enabledModels: platformPolicy.enabledModels,
          trialModel: platformPolicy.trialModel,
          creditBalanceIRR: workspace?.aiCreditBalanceIRR ?? 0,
          replyPricesIRR: await getEffectivePlanReplyPricesIRR(workspace?.plan ?? 'TRIAL'),
        }}
        agent={{
          id: agent.id,
          name: agent.name,
          description: agent.description,
          systemPrompt: agent.systemPrompt,
          model: agent.model,
          language: agent.language,
          welcomeMessage: agent.welcomeMessage,
          fallbackMessage: agent.fallbackMessage,
          handoffEnabled: agent.handoffEnabled,
          handoffMessage: agent.handoffMessage,
          handoffKeywords: agent.handoffKeywords,
          active: agent.active,
          // ─ F1: layered prompt
          promptConfig: agent.promptConfig as AgentSettingsData['promptConfig'],
          roleTemplate: agent.roleTemplate,
          // ─ F3: customer identification
          requireCustomerInfo: agent.requireCustomerInfo,
          customerInfoPrompt: agent.customerInfoPrompt,
        }}
      />
    </div>
  )
}
