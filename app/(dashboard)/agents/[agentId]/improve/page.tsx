import { getLocale } from 'next-intl/server'
import { AgentConfiguration } from '@/components/agents/agent-configuration'
import { AgentKnowledgeSection } from '@/components/knowledge/agent-knowledge-section'
import { ImprovementTabs, type ImprovementTab } from '@/components/agents/improvement-tabs'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ImprovementCenter } from '@/components/agents/improvement-center'

export default async function ImproveAgentPage({ params, searchParams }: {
  params: Promise<{ agentId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { agentId } = await params
  const query = await searchParams
  const active: ImprovementTab = query.tab === 'knowledge' || query.tab === 'learning' ? query.tab : 'behavior'
  const isFa = (await getLocale()) !== 'en'
  const user = await requireUser()
  const [count, knowledgeCount] = await Promise.all([
    prisma.improvementSuggestion.count({ where: { workspaceId: user.workspaceId, agentId, status: 'PENDING' } }),
    prisma.knowledgeBase.count({ where: { workspaceId: user.workspaceId, agentId, type: { not: 'PRODUCT_CATALOG' } } }),
  ])
  return <ImprovementTabs agentId={agentId} initialActive={active} isFa={isFa} learningCount={count} knowledgeCount={knowledgeCount} panels={{
    behavior: <AgentConfiguration agentId={agentId} section="behavior" />,
    knowledge: <AgentKnowledgeSection agentId={agentId} />,
    learning: <ImprovementCenter agentId={agentId} />,
  }} />
}
