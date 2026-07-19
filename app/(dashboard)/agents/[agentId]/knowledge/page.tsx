import { notFound } from 'next/navigation'
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
    <div className="space-y-6">
      <KbManager agentId={agent.id} items={items} />
    </div>
  )
}
