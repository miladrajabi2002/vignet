import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { CheckCircle2, Database } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { KbManager } from '@/components/knowledge/kb-manager'

export default async function AgentKnowledgePage(
  props: {
    params: Promise<{ agentId: string }>
  }
) {
  const params = await props.params;
  const user = await requireUser()
  const t = await getTranslations('knowledge')

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: { id: true, name: true },
  })
  if (!agent) notFound()

  const items = await prisma.knowledgeBase.findMany({
    where: { agentId: agent.id, type: { not: 'PRODUCT_CATALOG' } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      chunkCount: true,
      errorMsg: true,
      // ─ F4: freshness tracking
      lastIngestedAt: true,
      refreshIntervalHours: true,
    },
  })
  const readyCount = items.filter((item) => item.status === 'READY').length

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[1rem] bg-black text-white shadow-[0_14px_30px_-20px_rgba(0,0,0,0.9)]">
            <Database className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-[-0.035em] text-[var(--text-primary)] sm:text-[1.75rem]">
              {t('title')}
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
              {t('subtitle')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 ps-[3.75rem] sm:ps-0" aria-label={t('sourcesSummaryAria')}>
          <span className="inline-flex min-h-9 items-center rounded-full border border-black/[0.06] bg-white/80 px-3 text-xs font-medium text-[var(--text-secondary)] shadow-[0_8px_20px_-18px_rgba(0,0,0,0.7)]">
            {t('sourceCount', { count: items.length })}
          </span>
          <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-success/15 bg-success/[0.07] px-3 text-xs font-semibold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t('readyCount', { count: readyCount })}
          </span>
        </div>
      </header>
      <KbManager agentId={agent.id} items={items} />
    </div>
  )
}
