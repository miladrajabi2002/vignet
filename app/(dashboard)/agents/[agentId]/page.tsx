import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Bot, Settings, Database, Share2, Package, Workflow } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { TestPlayground } from '@/components/agent-builder/test-playground'
import { cn } from '@/lib/utils'

export default async function AgentDetailPage({
  params,
}: {
  params: { agentId: string }
}) {
  const user = await requireUser()
  const t = await getTranslations('agents')

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
  })
  if (!agent) notFound()

  const tabs = [
    { href: `/agents/${agent.id}/builder`, label: t('builder'), icon: Workflow },
    { href: `/agents/${agent.id}/settings`, label: t('settings'), icon: Settings },
    { href: `/agents/${agent.id}/knowledge`, label: t('knowledge'), icon: Database },
    { href: `/agents/${agent.id}/catalog`, label: t('products'), icon: Package },
    { href: `/agents/${agent.id}/channels`, label: t('channels'), icon: Share2 },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border-default)] text-[var(--text-secondary)]">
          <Bot className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-light text-[var(--text-primary)]">
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
            'rounded-full px-2.5 py-1 text-xs',
            agent.active
              ? 'bg-success/10 text-success'
              : 'bg-[var(--bg-muted)] text-[var(--text-muted)]',
          )}
        >
          {agent.active ? t('active') : t('inactive')}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
          {t('test')}
        </h2>
        <TestPlayground agentId={agent.id} welcomeMessage={agent.welcomeMessage} />
      </div>
    </div>
  )
}
