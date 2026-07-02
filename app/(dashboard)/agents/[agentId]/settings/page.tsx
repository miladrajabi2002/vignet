import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
  AgentSettingsForm,
  type AgentSettingsData,
} from '@/components/agents/agent-settings-form'

export default async function AgentSettingsPage({
  params,
}: {
  params: { agentId: string }
}) {
  const user = await requireUser()
  const t = await getTranslations('agents.settingsForm')

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
  })
  if (!agent) notFound()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-light text-[var(--text-primary)]">
        {t('title')}
      </h1>
      <AgentSettingsForm
        agent={{
          id: agent.id,
          name: agent.name,
          description: agent.description,
          systemPrompt: agent.systemPrompt,
          model: agent.model,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
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
