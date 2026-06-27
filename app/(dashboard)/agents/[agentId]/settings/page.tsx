import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { AgentSettingsForm } from '@/components/agents/agent-settings-form'

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
      <Link
        href={`/agents/${agent.id}`}
        className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {agent.name}
      </Link>
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
        }}
      />
    </div>
  )
}
