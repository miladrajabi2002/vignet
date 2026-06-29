import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ExperimentsPanel } from '@/components/agent-builder/experiments-panel'

export const dynamic = 'force-dynamic'

export default async function AgentExperimentsPage({
  params,
}: {
  params: { agentId: string }
}) {
  const user = await requireUser()
  const t = await getTranslations('experiments')

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: { id: true },
  })
  if (!agent) notFound()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-light text-[var(--text-primary)]">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('subtitle')}</p>
      </div>
      <ExperimentsPanel agentId={agent.id} />
    </div>
  )
}
