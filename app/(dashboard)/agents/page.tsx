import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Bot, Plus, MessagesSquare, Share2 } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'

function healthScore(agent: {
  systemPrompt: string
  _count: { catalogItems: number; knowledgeBases: number; channels: number }
}): 'green' | 'yellow' | 'red' {
  let score = 0
  if (agent.systemPrompt.length > 80) score++
  if (agent._count.catalogItems > 0) score++
  if (agent._count.knowledgeBases > 0) score++
  if (agent._count.channels > 0) score++
  if (score >= 3) return 'green'
  if (score >= 1) return 'yellow'
  return 'red'
}

const HEALTH_COLORS = {
  green: 'bg-success',
  yellow: 'bg-warning',
  red: 'bg-danger',
}

export default async function AgentsPage() {
  const user = await requireUser()
  const t = await getTranslations('agents')

  const agents = await prisma.agent.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      systemPrompt: true,
      active: true,
      _count: {
        select: {
          conversations: true,
          channels: true,
          catalogItems: true,
          knowledgeBases: true,
        },
      },
    },
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light text-[var(--text-primary)]">
          {t('title')}
        </h1>
        <Link
          href="/agents/new"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition-transform hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4" />
          {t('new')}
        </Link>
      </div>

      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-16 text-center">
          <Bot className="h-8 w-8 text-[var(--text-muted)]" />
          <h2 className="mt-4 text-lg text-[var(--text-primary)]">
            {t('empty')}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {t('emptyDesc')}
          </p>
          <Link
            href="/agents/new"
            className="mt-6 rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-black"
          >
            {t('create')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => {
            const health = healthScore(agent)
            return (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className="group rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 transition-colors hover:border-[var(--border-hover)]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)]">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      title={t(`health_${health}` as Parameters<typeof t>[0])}
                      className={cn('h-2 w-2 rounded-full', HEALTH_COLORS[health])}
                    />
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs',
                        agent.active
                          ? 'bg-success/10 text-success'
                          : 'bg-[var(--bg-muted)] text-[var(--text-muted)]',
                      )}
                    >
                      {agent.active ? t('active') : t('inactive')}
                    </span>
                  </div>
                </div>
                <h3 className="mt-4 truncate font-medium text-[var(--text-primary)]">
                  {agent.name}
                </h3>
                {agent.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">
                    {agent.description}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-4 text-xs text-[var(--text-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <MessagesSquare className="h-3.5 w-3.5" />
                    {agent._count.conversations}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Share2 className="h-3.5 w-3.5" />
                    {agent._count.channels}
                  </span>
                  <span className={cn('ms-auto text-xs font-medium', {
                    'text-success': health === 'green',
                    'text-warning': health === 'yellow',
                    'text-danger': health === 'red',
                  })}>
                    {t(`health_${health}` as Parameters<typeof t>[0])}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
