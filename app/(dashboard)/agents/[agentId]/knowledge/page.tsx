import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { KbManager } from '@/components/knowledge/kb-manager'

export default async function AgentKnowledgePage(
  props: {
    params: Promise<{ agentId: string }>
  }
) {
  const params = await props.params;
  const user = await requireUser()
  const t = await getTranslations('knowledge')

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: { id: true, name: true },
  })
  if (!agent) notFound()

  const items = await prisma.knowledgeBase.findMany({
    where: { agentId: agent.id, type: { not: 'PRODUCT_CATALOG' } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      chunkCount: true,
      errorMsg: true,
      // ─ F4: freshness tracking
      lastIngestedAt: true,
      refreshIntervalHours: true,
    },
  })

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-light text-[var(--text-primary)]">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {t('subtitle')}
        </p>
      </div>
      <KbManager agentId={agent.id} items={items} />
    </div>
  )
}
