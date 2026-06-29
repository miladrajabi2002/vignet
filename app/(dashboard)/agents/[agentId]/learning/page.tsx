import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { LEARNED_PREFIX } from '@/lib/ai/learning'
import { LearningCenter, type LearningItem } from '@/components/agent-builder/learning-center'

export const dynamic = 'force-dynamic'

export default async function AgentLearningPage({
  params,
}: {
  params: { agentId: string }
}) {
  const user = await requireUser()
  const t = await getTranslations('learning')

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
      return { id: m.id, question, conversationId: m.conversationId }
    })
    .filter((m) => m.question.length > 0)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-light text-[var(--text-primary)]">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <span className="text-xs text-[var(--text-secondary)]">{t('pending')}</span>
          <p className="mt-1 text-2xl font-light text-[var(--text-primary)]">
            {items.length.toLocaleString('fa-IR')}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <span className="text-xs text-[var(--text-secondary)]">{t('learned')}</span>
          <p className="mt-1 text-2xl font-light text-success">
            {learnedCount.toLocaleString('fa-IR')}
          </p>
        </div>
      </div>

      <LearningCenter agentId={agent.id} initial={items} />
    </div>
  )
}
