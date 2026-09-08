import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { LearningCenter } from '@/components/agent-builder/learning-center'
import { getLearningQueue } from '@/lib/ai/learning-queue'
import { Pagination } from '@/components/ui/pagination'

export const dynamic = 'force-dynamic'
const PAGE_SIZE = 20

export async function AgentLearningSection({ agentId, query, initialQueue }: {
  agentId: string; query: { view?: string; page?: string }
  initialQueue?: Awaited<ReturnType<typeof getLearningQueue>>
}) {
  const user = await requireUser()
  const agent = await prisma.agent.findFirst({ where: { id: agentId, workspaceId: user.workspaceId }, select: { id: true } })
  if (!agent) notFound()
  const where = { agentId, workspaceId: user.workspaceId }
  const learnedCount = await prisma.knowledgeApproval.count({ where })
  const page = Math.min(Math.max(1, Math.floor(Number(query.page)) || 1), Math.max(1, Math.ceil(learnedCount / PAGE_SIZE)))
  const [queue, approvals] = await Promise.all([
    initialQueue ?? getLearningQueue(user.workspaceId, agentId),
    prisma.knowledgeApproval.findMany({
      where, orderBy: { verifiedAt: 'desc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      select: {
        knowledgeBaseId: true, question: true, answer: true, verifiedAt: true,
        knowledgeVersion: true, validUntil: true,
        sourceMessage: { select: { conversationId: true } },
        knowledgeBase: { select: { status: true } },
      },
    }),
  ])
  return (
    <div className="space-y-6">
      <LearningCenter agentId={agentId} initial={queue.items} initialLearnedCount={learnedCount}
        unanalyzedCount={queue.unanalyzedCount} excludedCount={queue.excludedCount}
        initialView={query.view === 'approved' ? 'approved' : 'pending'}
        approved={approvals.map((row) => ({
          id: row.knowledgeBaseId, question: row.question, answer: row.answer,
          verifiedAt: row.verifiedAt.toISOString(), version: row.knowledgeVersion,
          expired: !!row.validUntil && row.validUntil.getTime() <= Date.now(),
          conversationId: row.sourceMessage?.conversationId ?? null, status: row.knowledgeBase.status,
        }))} />
      {query.view === 'approved' && learnedCount > PAGE_SIZE && <Pagination
        page={page} totalPages={Math.ceil(learnedCount / PAGE_SIZE)} hasNext={page * PAGE_SIZE < learnedCount}
        makeHref={(nextPage) => `/agents/${agentId}/improve?tab=learning&view=approved&page=${nextPage}`} />}
    </div>
  )
}
