import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Database,
  MessageSquare,
  Package,
  Share2,
  Store,
} from 'lucide-react'
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
    select: { id: true, welcomeMessage: true },
  })
  if (!agent) notFound()

  const [storeCount, productCount, kbCount, channelCount, convCount] =
    await Promise.all([
      prisma.storeIntegration.count({
        where: { workspaceId: user.workspaceId, active: true },
      }),
      prisma.product.count({ where: { workspaceId: user.workspaceId } }),
      prisma.knowledgeBase.count({
        where: { agentId: agent.id, type: { not: 'PRODUCT_CATALOG' } },
      }),
      prisma.agentChannel.count({ where: { agentId: agent.id } }),
      prisma.conversation.count({ where: { agentId: agent.id } }),
    ])

  const steps = [
    {
      key: 'store',
      done: storeCount > 0,
      optional: true,
      icon: Store,
      title: t('setup.storeTitle'),
      desc: t('setup.storeDesc'),
      href: '/integrations',
      cta: t('setup.storeCta'),
    },
    {
      key: 'products',
      done: productCount > 0,
      optional: true,
      icon: Package,
      title: t('setup.productsTitle'),
      desc: t('setup.productsDesc'),
      href: '/products',
      cta: t('setup.productsCta'),
    },
    {
      key: 'knowledge',
      done: kbCount > 0,
      optional: false,
      icon: Database,
      title: t('setup.knowledgeTitle'),
      desc: t('setup.knowledgeDesc'),
      href: `/agents/${agent.id}/knowledge`,
      cta: t('setup.knowledgeCta'),
    },
    {
      key: 'channel',
      done: channelCount > 0,
      optional: false,
      icon: Share2,
      title: t('setup.channelTitle'),
      desc: t('setup.channelDesc'),
      href: `/agents/${agent.id}/channels`,
      cta: t('setup.channelCta'),
    },
    {
      key: 'test',
      done: convCount > 0,
      optional: false,
      icon: MessageSquare,
      title: t('setup.testTitle'),
      desc: t('setup.testDesc'),
      href: null,
      cta: null,
    },
  ] as const

  const doneCount = steps.filter((s) => s.done).length
  const allDone = steps.every((s) => s.done || s.optional)
    && steps.filter((s) => !s.optional).every((s) => s.done)

  return (
    <div className="space-y-6">
      {!allDone && (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--text-primary)]">
              {t('setup.title')}
            </h2>
            <span className="text-xs text-[var(--text-muted)]">
              {t('setup.progress', { done: doneCount, total: steps.length })}
            </span>
          </div>
          <ol className="space-y-1">
            {steps.map((step) => {
              const Icon = step.icon
              return (
                <li
                  key={step.key}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5',
                    !step.done && 'hover:bg-[var(--bg-muted)]',
                  )}
                >
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />
                  )}
                  <Icon className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm',
                        step.done
                          ? 'text-[var(--text-muted)] line-through'
                          : 'text-[var(--text-primary)]',
                      )}
                    >
                      {step.title}
                      {step.optional && !step.done && (
                        <span className="ms-2 text-[11px] text-[var(--text-muted)]">
                          {t('setup.optional')}
                        </span>
                      )}
                    </p>
                    {!step.done && (
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        {step.desc}
                      </p>
                    )}
                  </div>
                  {!step.done && step.href && (
                    <Link
                      href={step.href}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
                    >
                      {step.cta}
                      <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                    </Link>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
          {t('test')}
        </h2>
        <TestPlayground agentId={agent.id} welcomeMessage={agent.welcomeMessage} />
      </div>
    </div>
  )
}
