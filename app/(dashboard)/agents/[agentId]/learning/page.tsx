import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { LEARNED_PREFIX } from '@/lib/ai/learning'
import { LearningCenter, type LearningItem } from '@/components/agent-builder/learning-center'

export const dynamic = 'force-dynamic'

export default async function AgentLearningPage(
  props: {
    params: Promise<{ agentId: string }>
  }
) {
  const params = await props.params;
  const user = await requireUser()

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: { id: true },
  })
  if (!agent) notFound()

  const [rows, learnedCount] = await Promise.all([
    prisma.message.findMany({
      where: {
        role: 'ASSISTANT',
        unanswered: true,
        conversation: { agentId: agent.id, workspaceId: user.workspaceId },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, metadata: true, conversationId: true },
    }),
    prisma.knowledgeBase.count({
      where: {
        agentId: agent.id,
        type: 'FAQ',
        name: { startsWith: LEARNED_PREFIX },
      },
    }),
  ])

  const items: LearningItem[] = rows
    .map((m) => {
      const meta = m.metadata as Record<string, unknown> | null
      const question = meta && typeof meta.question === 'string' ? meta.question : ''
      const operatorAnswer =
        meta && typeof meta.operatorAnswer === 'string' ? meta.operatorAnswer : undefined
      return { id: m.id, question, conversationId: m.conversationId, operatorAnswer }
    })
    .filter((m) => m.question.length > 0)

  return (
    <div className="space-y-6">
      <LearningCenter
        agentId={agent.id}
        initial={items}
        initialLearnedCount={learnedCount}
      />
    </div>
  )
}
