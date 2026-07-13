import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Bot } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { AgentTabs, type AgentTabItem } from '@/components/agents/agent-tabs'
import { cn } from '@/lib/utils'
import { getDashboardModules } from '@/lib/verticals/registry'
import { readBusinessProfile } from '@/lib/verticals/profile'

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

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: { id: true, name: true, description: true, active: true, workspace: { select: { businessType: true, businessProfile: true } } },
  })
  if (!agent) notFound()

  const learningCount = await prisma.message.count({
    where: {
      role: 'ASSISTANT',
      unanswered: true,
      conversation: { agentId: agent.id, workspaceId: user.workspaceId },
    },
  })

  const profile = readBusinessProfile(agent.workspace.businessProfile)
  const modules = getDashboardModules(agent.workspace.businessType, profile?.services)
  const tabs: AgentTabItem[] = [
    { key: 'overview', href: `/agents/${agent.id}`, label: t('overview') },
    { key: 'settings', href: `/agents/${agent.id}/settings`, label: t('settings') },
    { key: 'knowledge', href: `/agents/${agent.id}/knowledge`, label: t('knowledge') },
    ...(modules.includes('products') ? [{ key: 'catalog', href: `/agents/${agent.id}/catalog`, label: t('products') }] : []),
    { key: 'channels', href: `/agents/${agent.id}/channels`, label: t('channels') },
    { key: 'instagram', href: `/agents/${agent.id}/instagram`, label: 'اینستاگرام' },
    { key: 'learning', href: `/agents/${agent.id}/learning`, label: t('learning'), badge: learningCount },
    { key: 'analytics', href: `/agents/${agent.id}/analytics`, label: t('analytics') },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="space-y-4">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
          {t('title')}
        </Link>
        <div className="spatial-surface flex items-center gap-4 rounded-[1.5rem] p-4 sm:p-5">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight text-[var(--text-primary)]">
              {agent.name}
            </h1>
            {agent.description && (
              <p className="truncate text-sm text-[var(--text-secondary)]">
                {agent.description}
              </p>
            )}
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs',
              agent.active
                ? 'bg-success/10 text-success'
                : 'bg-[var(--bg-muted)] text-[var(--text-muted)]',
            )}
          >
            {agent.active && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
            )}
            {agent.active ? t('active') : t('inactive')}
          </span>
        </div>
        <AgentTabs agentId={agent.id} tabs={tabs} />
      </div>

      {children}
    </div>
  )
}
