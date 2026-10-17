import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { Bot } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { AgentTabs, type AgentTabItem } from '@/components/agents/agent-tabs'
import { BackButton } from '@/components/dashboard/back-button'
import { cn } from '@/lib/utils'
import { LearningCountProvider } from '@/components/agents/learning-count'
import { getDashboardModules } from '@/lib/verticals/registry'
import { workspaceCapabilities } from '@/lib/verticals/profile'

export default async function AgentLayout(
  props: {
    children: React.ReactNode
    params: Promise<{ agentId: string }>
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

  const user = await requireUser()
  const t = await getTranslations('agents')
  const isFa = (await getLocale()) !== 'en'

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: { id: true, name: true, active: true, workspace: { select: { businessType: true, businessProfile: true } } },
  })
  if (!agent) notFound()

  const learningCount = await prisma.improvementSuggestion.count({ where: { workspaceId: user.workspaceId, agentId: agent.id, status: 'PENDING' } })

  const hasProducts = getDashboardModules(workspaceCapabilities(agent.workspace)).includes('products')

  const tabs: AgentTabItem[] = [
    { key: 'overview', href: `/agents/${agent.id}`, label: t('overview') },
    { key: 'improve', href: `/agents/${agent.id}/improve`, label: isFa ? 'بهبود ایجنت' : 'Improve agent', badge: learningCount },
    { key: 'settings', href: `/agents/${agent.id}/settings`, label: t('settings') },
    ...(hasProducts ? [{ key: 'catalog', href: `/agents/${agent.id}/catalog`, label: t('storeAccessTab') }] : []),
    { key: 'channels', href: `/agents/${agent.id}/channels`, label: t('channels') },
    { key: 'analytics', href: `/agents/${agent.id}/analytics`, label: t('analytics') },
  ]

  return (
    <LearningCountProvider key={agent.id} initialCount={learningCount}>
    <div className="mx-auto max-w-none space-y-6">
      <BackButton href="/agents" label={t('title')} />
      <section className="spatial-surface overflow-hidden rounded-card">
        <div className="flex items-center gap-4 p-4 sm:p-5">
          {/* The status is a light on the icon — green and pulsing while the
              agent is on, red when it is off — so the name keeps the full row. */}
          <div className="relative shrink-0" title={agent.active ? t('active') : t('inactive')}>
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
              <Bot className="h-5 w-5" />
            </div>
            <span className="absolute -end-1 -top-1 flex h-3.5 w-3.5">
              {agent.active && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75 motion-reduce:animate-none" />
              )}
              <span className={cn('relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white', agent.active ? 'bg-emerald-500' : 'bg-red-500')} />
            </span>
            <span className="sr-only">{agent.active ? t('active') : t('inactive')}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="line-clamp-2 text-xl font-bold leading-8 tracking-tight text-[var(--text-primary)] [overflow-wrap:anywhere]">
              {agent.name}
            </h1>
          </div>
        </div>
        <AgentTabs agentId={agent.id} tabs={tabs} />
      </section>

      {children}
    </div>
    </LearningCountProvider>
  )
}
