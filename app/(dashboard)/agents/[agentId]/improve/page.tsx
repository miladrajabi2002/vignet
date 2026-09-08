import { getLocale } from 'next-intl/server'
import { AgentConfiguration } from '@/components/agents/agent-configuration'
import { AgentKnowledgeSection } from '@/components/knowledge/agent-knowledge-section'
import { AgentLearningSection } from '@/components/agent-builder/agent-learning-section'
import { ImprovementTabs, type ImprovementTab } from '@/components/agents/improvement-tabs'
import { requireUser } from '@/lib/session'
import { getLearningQueue } from '@/lib/ai/learning-queue'
import { prisma } from '@/lib/prisma'
import { ImprovementCenter } from '@/components/agents/improvement-center'

export default async function ImproveAgentPage({ params, searchParams }: {
  params: Promise<{ agentId: string }>
  searchParams: Promise<{ tab?: string; view?: string; page?: string }>
}) {
  const { agentId } = await params
  const query = await searchParams
  const active: ImprovementTab = query.tab === 'knowledge' || query.tab === 'learning' ? query.tab : 'behavior'
  const isFa = (await getLocale()) !== 'en'
  const user = await requireUser()
  const count = await prisma.improvementSuggestion.count({ where: { workspaceId: user.workspaceId, agentId, status: 'PENDING' } })
  const legacy = query.view === 'legacy' || query.view === 'approved'
  const queue = legacy ? await getLearningQueue(user.workspaceId, agentId) : undefined
  return <ImprovementTabs agentId={agentId} initialActive={active} isFa={isFa} learningCount={count} panels={{
    behavior: <AgentConfiguration agentId={agentId} section="behavior" />,
    knowledge: <AgentKnowledgeSection agentId={agentId} />,
    learning: legacy ? <AgentLearningSection agentId={agentId} query={query} initialQueue={queue} /> : <ImprovementCenter agentId={agentId} />,
  }} />
}
