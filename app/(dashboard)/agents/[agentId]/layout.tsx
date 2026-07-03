import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Bot } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { AgentTabs, type AgentTabItem } from '@/components/agents/agent-tabs'
import { cn } from '@/lib/utils'

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
    select: { id: true, name: true, description: true, active: true },
  })
  if (!agent) notFound()

  const learningCount = await prisma.message.count({
    where: {
      role: 'ASSISTANT',
      unanswered: true,
      conversation: { agentId: agent.id, workspaceId: user.workspaceId },
    },
  })

  const tabs: AgentTabItem[] = [
    { key: 'overview', href: `/agents/${agent.id}`, label: t('overview') },
    { key: 'settings', href: `/agents/${agent.id}/settings`, label: t('settings') },
    { key: 'knowledge', href: `/agents/${agent.id}/knowledge`, label: t('knowledge') },
    { key: 'catalog', href: `/agents/${agent.id}/catalog`, label: t('products') },
    { key: 'channels', href: `/agents/${agent.id}/channels`, label: t('channels') },
    { key: 'learning', href: `/agents/${agent.id}/learning`, label: t('learning'), badge: learningCount },
    { key: 'analytics', href: `/agents/${agent.id}/analytics`, label: t('analytics') },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-4">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
          {t('title')}
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-default)] text-[var(--text-secondary)]">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-medium text-[var(--text-primary)]">
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
