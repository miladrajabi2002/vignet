import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import {
  ArrowLeft,
  MessagesSquare,
  Star,
  CheckCircle2,
  Cpu,
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { StatsCard } from '@/components/dashboard/stats-card'
import {
  ConversationChart,
  type TrendPoint,
} from '@/components/dashboard/charts/conversation-chart'
import { ChannelDonut } from '@/components/dashboard/charts/channel-donut'
import { BarList } from '@/components/dashboard/charts/bar-list'
import { CHANNEL_LABELS } from '@/components/crm/channel-badge'

const DAYS = 14

export default async function AgentAnalyticsPage({
  params,
}: {
  params: { agentId: string }
}) {
  const user = await requireUser()
  const t = await getTranslations('analytics')
  const ta = await getTranslations('agents')
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const ws = user.workspaceId

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: ws },
    select: { id: true, name: true },
  })
  if (!agent) notFound()

  const since = new Date()
  since.setHours(0, 0, 0, 0)
  since.setDate(since.getDate() - (DAYS - 1))

  const where = { workspaceId: ws, agentId: agent.id }

  const [convos, channelGroups, ratingAgg, resolved, totalConvos, usageAgg, products] =
    await Promise.all([
      prisma.conversation.findMany({
        where: { ...where, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      prisma.conversation.groupBy({
        by: ['channel'],
        where,
        _count: { _all: true },
      }),
      prisma.conversation.aggregate({
        where: { ...where, rating: { not: null } },
        _avg: { rating: true },
      }),
      prisma.conversation.count({ where: { ...where, status: 'RESOLVED' } }),
      prisma.conversation.count({ where }),
      prisma.usageLog.aggregate({
        where,
        _sum: { promptTokens: true, completionTokens: true },
      }),
      prisma.product.findMany({
        where: {
          workspaceId: ws,
          queryCount: { gt: 0 },
          catalogItems: { some: { agentId: agent.id } },
        },
        orderBy: { queryCount: 'desc' },
        take: 6,
        select: { name: true, queryCount: true },
      }),
    ])

  const dayFmt = new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
    month: 'short',
    day: 'numeric',
  })
  const buckets = new Map<string, number>()
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(since)
    d.setDate(since.getDate() + i)
    buckets.set(d.toDateString(), 0)
  }
  for (const c of convos) {
    const key = new Date(c.createdAt).toDateString()
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  const trend: TrendPoint[] = [...buckets.entries()].map(([key, value]) => ({
    label: dayFmt.format(new Date(key)),
    value,
  }))

  const channels = channelGroups
    .map((g) => ({ label: CHANNEL_LABELS[g.channel] ?? g.channel, value: g._count._all }))
    .sort((a, b) => b.value - a.value)

  const avgRating = ratingAgg._avg.rating
  const totalTokens =
    (usageAgg._sum.promptTokens ?? 0) + (usageAgg._sum.completionTokens ?? 0)
  const resolveRate = totalConvos ? Math.round((resolved / totalConvos) * 100) : 0
  const nf = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        href={`/agents/${agent.id}`}
        className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {agent.name}
      </Link>

      <div>
        <h1 className="text-2xl font-light text-[var(--text-primary)]">
          {ta('analytics')}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          label={t('totalConversations')}
          value={nf.format(totalConvos)}
          icon={MessagesSquare}
        />
        <StatsCard
          label={t('resolveRate')}
          value={`${nf.format(resolveRate)}${locale === 'fa' ? '٪' : '%'}`}
          icon={CheckCircle2}
        />
        <StatsCard
          label={t('avgRating')}
          value={avgRating ? avgRating.toFixed(1) : '—'}
          icon={Star}
        />
        <StatsCard
          label={t('tokensUsed')}
          value={nf.format(totalTokens)}
          icon={Cpu}
        />
      </div>

      <Panel title={t('conversationsTrend')}>
        <ConversationChart data={trend} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('channelBreakdown')}>
          {channels.length ? <ChannelDonut data={channels} /> : <Empty text={t('noData')} />}
        </Panel>
        <Panel title={t('topProducts')}>
          {products.length ? (
            <BarList
              data={products.map((p) => ({ label: p.name, value: p.queryCount }))}
            />
          ) : (
            <Empty text={t('noData')} />
          )}
        </Panel>
      </div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
      <h2 className="mb-4 text-sm font-medium text-[var(--text-secondary)]">{title}</h2>
      {children}
    </section>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-[180px] items-center justify-center text-sm text-[var(--text-muted)]">
      {text}
    </div>
  )
}
