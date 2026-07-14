import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { GraduationCap } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { LEARNED_PREFIX } from '@/lib/ai/learning'
import { LearningCenter, type LearningItem } from '@/components/agent-builder/learning-center'
import { PageHeader } from '@/components/dashboard/page-header'

export const dynamic = 'force-dynamic'

export default async function AgentLearningPage(
  props: {
    params: Promise<{ agentId: string }>
  }
) {
  const params = await props.params;
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
      const operatorAnswer =
        meta && typeof meta.operatorAnswer === 'string' ? meta.operatorAnswer : undefined
      return { id: m.id, question, conversationId: m.conversationId, operatorAnswer }
    })
    .filter((m) => m.question.length > 0)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        icon={GraduationCap}
        title={t('title')}
        subtitle={t('subtitle')}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="spatial-surface rounded-[1.5rem] p-4">
          <span className="text-xs text-[var(--text-secondary)]">{t('pending')}</span>
          <p className="mt-1 text-2xl font-light text-[var(--text-primary)]">
            {items.length.toLocaleString('fa-IR')}
          </p>
        </div>
        <div className="spatial-surface rounded-[1.5rem] p-4">
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
