import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  MessagesSquare,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { DashboardPanel } from '@/components/dashboard/panel'
import { PageHeader } from '@/components/dashboard/page-header'
import { StatsCard } from '@/components/dashboard/stats-card'
import { ConversationChart, ChannelDonut } from '@/components/dashboard/charts/lazy'
import { satisfactionBucket } from '@/lib/ai/turn-signal'
import { topicLabel } from '@/lib/conversations/topic-labels'
import type { TrendPoint } from '@/components/dashboard/charts/conversation-chart'
import { channelLabel } from '@/components/crm/channel-badge'
import { cn } from '@/lib/utils'

const TREND_DAYS = 30

function daysAgo(n: number) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d
}

function nfFa(n: number, fa: boolean) {
  return n.toLocaleString(fa ? 'fa-IR' : 'en-US')
}

export default async function AnalyticsPage() {
  const user = await requireUser()
  const locale = await getLocale()
  const lang: 'fa' | 'en' = locale === 'en' ? 'en' : 'fa'
  const fa = lang === 'fa'
  const workspaceId = user.workspaceId

  const since = daysAgo(TREND_DAYS)
  const prevSince = daysAgo(TREND_DAYS * 2)

  const [
    workspace,
    totalConversations,
    resolvedConversations,
    handedOff,
    openConversations,
    prevPeriodConversations,
    channelCounts,
    agentStats,
    trendRows,
    assistantMsgCount,
    csatRows,
  ] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { name: true, businessType: true, createdAt: true },
    }),
    prisma.conversation.count({ where: { workspaceId, createdAt: { gte: since } } }),
    prisma.conversation.count({ where: { workspaceId, status: 'RESOLVED', createdAt: { gte: since } } }),
    prisma.conversation.count({ where: { workspaceId, status: 'HANDED_OFF', createdAt: { gte: since } } }),
    prisma.conversation.count({ where: { workspaceId, status: 'OPEN' } }),
    prisma.conversation.count({ where: { workspaceId, createdAt: { gte: prevSince, lt: since } } }),
    prisma.conversation.groupBy({
      by: ['channel'],
      where: { workspaceId, createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { channel: 'desc' } },
    }),
    prisma.agent.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        roleTemplate: true,
        _count: { select: { conversations: { where: { createdAt: { gte: since }, deletedAt: null } } } },
      },
      orderBy: { conversations: { _count: 'desc' } },
      take: 6,
    }),
    prisma.conversation.findMany({
      where: { workspaceId, createdAt: { gte: since } },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.message.aggregate({
      where: {
        conversation: { workspaceId },
        role: 'ASSISTANT',
        createdAt: { gte: since },
      },
      _count: { _all: true },
    }),
    // Satisfaction is read from the conversations themselves (see
    // lib/ai/turn-signal.ts) — customers are never asked to rate.
    prisma.conversationSalesInsight.findMany({
      where: {
        workspaceId,
        satisfaction: { not: null },
        conversation: { lastMessageAt: { gte: since }, deletedAt: null },
      },
      select: { satisfaction: true, topics: true },
      // Empty until the satisfaction migration is applied.
    }).catch(() => [] as Array<{ satisfaction: number | null; topics: string[] }>),
  ])

  const resolveRate = totalConversations > 0 ? Math.round((resolvedConversations / totalConversations) * 100) : 0
  const delta = prevPeriodConversations > 0 ? Math.round(((totalConversations - prevPeriodConversations) / prevPeriodConversations) * 100) : null

  // Build 30-day trend
  const dayMap = new Map<string, { total: number; resolved: number; handoff: number }>()
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const d = daysAgo(i)
    const key = d.toISOString().slice(0, 10)
    dayMap.set(key, { total: 0, resolved: 0, handoff: 0 })
  }
  for (const row of trendRows) {
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(row.createdAt)
    const bucket = dayMap.get(key)
    if (bucket) {
      bucket.total += 1
      if (row.status === 'RESOLVED') bucket.resolved += 1
      if (row.status === 'HANDED_OFF') bucket.handoff += 1
    }
  }
  const trend: TrendPoint[] = Array.from(dayMap.values()).map((b, i) => ({
    label: `${i + 1}`,
    value: b.total,
    resolved: b.resolved,
    handoff: b.handoff,
  }))

  const channelData = channelCounts.map((c) => ({
    label: channelLabel(c.channel, locale),
    value: c._count._all,
  }))

  const avgMsgsPerConv = totalConversations > 0 ? Math.round((assistantMsgCount._count._all / totalConversations) * 10) / 10 : null
  const csat = { satisfied: 0, neutral: 0, dissatisfied: 0 }
  const topicCounts = new Map<string, number>()
  for (const row of csatRows) {
    if (row.satisfaction === null) continue
    csat[satisfactionBucket(row.satisfaction)] += 1
    for (const topic of row.topics) topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1)
  }
  const csatCount = csat.satisfied + csat.neutral + csat.dissatisfied
  // The headline is the classic CSAT ratio: of the customers who showed how
  // they felt, how many left satisfied. Neutral threads are neither counted
  // nor shown.
  const csatDecided = csat.satisfied + csat.dissatisfied
  const csatPct = csatDecided > 0 ? Math.round((csat.satisfied / csatDecided) * 100) : null
  const topTopics = Array.from(topicCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4)
  const pctSign = fa ? '٪' : '%'

  const Arrow = fa ? ArrowLeft : ArrowRight

  const kpis = [
    {
      icon: MessagesSquare,
      label: fa ? 'گفتگو در ۳۰ روز' : 'Conversations, 30d',
      value: nfFa(totalConversations, fa),
      hint: delta === null ? (fa ? 'شروع اندازه‌گیری' : 'just started') : `${delta > 0 ? '+' : ''}${nfFa(delta, fa)}${fa ? '٪' : '%'} ${fa ? 'نسبت به ماه قبل' : 'vs last month'}`,
      tone: 'default' as const,
    },
    {
      icon: CheckCircle2,
      label: fa ? 'نرخ حل گفتگو' : 'Resolution rate',
      value: `${nfFa(resolveRate, fa)}${fa ? '٪' : '%'}`,
      hint: fa ? `${nfFa(resolvedConversations, fa)} از ${nfFa(totalConversations, fa)}` : `${nfFa(resolvedConversations, fa)} of ${nfFa(totalConversations, fa)}`,
      tone: 'success' as const,
    },
    {
      icon: Clock,
      label: fa ? 'پیام در هر گفتگو' : 'Msgs per convo',
      value: avgMsgsPerConv !== null ? `${nfFa(avgMsgsPerConv, fa)}` : null,
      hint: fa ? 'میانگین پاسخ‌های ایجنت' : 'avg agent replies',
      tone: 'default' as const,
    },
    {
      icon: Star,
      label: fa ? 'رضایت مشتری' : 'CSAT',
      value: csatPct !== null ? `${nfFa(csatPct, fa)}${pctSign}` : null,
      hint: fa ? `از ${nfFa(csatDecided, fa)} گفتگو` : `from ${nfFa(csatDecided, fa)} conversations`,
      tone: 'success' as const,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        icon={BarChart3}
        title={fa ? 'تحلیل گفتگوها' : 'Conversation analytics'}
        subtitle={fa ? `۳۰ روز گذشته · ${workspace.name}` : `Last 30 days · ${workspace.name}`}
      />

      {/* KPI row */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <StatsCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            hint={kpi.hint}
            emptyText={fa ? 'بدون داده' : 'No data'}
            tone={kpi.tone === 'success' ? 'signal' : 'default'}
          />
        ))}
      </section>

      {/* Main trend + channel donut */}
      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <DashboardPanel
          title={fa ? 'روند ۳۰ روزه گفتگوها' : '30-day conversation trend'}
          subtitle={fa ? 'گفتگوهای روزانه به‌همراه حل‌شده و تحویل اپراتور' : 'Daily conversations, resolutions and handoffs'}
        >
          <ConversationChart
            data={trend}
            empty={{
              title: fa ? 'هنوز گفتگویی ثبت نشده' : 'No conversations yet',
              hint: fa ? 'با اولین گفتگو، روند همین‌جا رسم می‌شود.' : 'The trend is drawn here from the first conversation.',
              action: { href: '/integrations', label: fa ? 'اتصال برنامه' : 'Connect an app' },
            }}
          />
          <div className={cn('mt-3 flex flex-wrap items-center gap-4 text-[12px]', totalConversations === 0 && 'text-[var(--text-muted)]')}>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--text-primary)]" />{fa ? 'کل گفتگوها' : 'Total'}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />{fa ? 'حل‌شده' : 'Resolved'}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />{fa ? 'تحویل اپراتور' : 'Handed off'}</span>
          </div>
        </DashboardPanel>

        <DashboardPanel
          title={fa ? 'توزیع برنامه‌ها' : 'Channel distribution'}
          subtitle={fa ? 'کدام برنامه بیشترین ترافیک را دارد' : 'Where conversations come from'}
        >
          {channelData.length > 0 ? (
            <>
              <ChannelDonut data={channelData} />
              <div className="mt-3 space-y-1.5">
                {channelData.slice(0, 5).map((c) => (
                  <div key={c.label} className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">{c.label}</span>
                    <span className="font-medium tabular-nums text-[var(--text-primary)]">{nfFa(c.value, fa)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="grid h-40 place-items-center px-3 text-center text-sm leading-6 text-[var(--text-muted)]">{fa ? 'سهم هر برنامه بعد از اولین گفتگوها اینجا دیده می‌شود.' : 'Each app’s share appears here after the first conversations.'}</div>
          )}
        </DashboardPanel>
      </section>

      {/* Agent performance + funnel */}
      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <DashboardPanel
          title={fa ? 'عملکرد ایجنت‌ها' : 'Agent performance'}
          subtitle={fa ? 'تعداد گفتگو و سهم هر ایجنت در ۳۰ روز' : 'Conversations handled per agent, 30 days'}
        >
          {agentStats.length > 0 ? (
            <div className="divide-y divide-[var(--border-subtle)]">
              {agentStats.map((agent) => {
                const total = agentStats.reduce((s, a) => s + a._count.conversations, 0) || 1
                const share = Math.round((agent._count.conversations / total) * 100)
                return (
                  <div key={agent.id} className="flex items-center gap-3 py-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-secondary)]">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-[var(--text-primary)]">{agent.name}</span>
                        <span className="shrink-0 text-[12px] text-[var(--text-muted)]">{nfFa(share, fa)}{fa ? '٪' : '%'}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                        <div className="h-full rounded-full bg-[var(--text-primary)]" style={{ width: `${share}%` }} />
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-medium tabular-nums text-[var(--text-secondary)]">{nfFa(agent._count.conversations, fa)}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="grid h-32 place-items-center text-sm text-[var(--text-muted)]">{fa ? 'ایجنتی ساخته نشده' : 'No agents yet'}</div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title={fa ? 'قیف حل گفتگو' : 'Resolution funnel'}
          subtitle={fa ? 'از دریافت تا حل موفق' : 'From received to successfully resolved'}
        >
          <div className="space-y-3 py-2">
            {[
              { label: fa ? 'گفتگو دریافت شد' : 'Conversations received', value: totalConversations, color: 'bg-[color-mix(in_srgb,var(--signal)_30%,white)]' },
              { label: fa ? 'توسط ایجنت پاسخ داده شد' : 'Answered by agent', value: totalConversations - handedOff, color: 'bg-[color-mix(in_srgb,var(--signal)_62%,white)]' },
              { label: fa ? 'حل شد' : 'Resolved', value: resolvedConversations, color: 'bg-[var(--signal)]' },
              { label: fa ? 'تحویل اپراتور' : 'Handed to operator', value: handedOff, color: 'bg-amber-600' },
            ].map((step) => {
              const max = totalConversations || 1
              const pct = Math.round((step.value / max) * 100)
              return (
                <div key={step.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">{step.label}</span>
                    <span className="font-medium tabular-nums text-[var(--text-primary)]">{nfFa(step.value, fa)} · {nfFa(pct, fa)}{fa ? '٪' : '%'}</span>
                  </div>
                  <div className="h-7 overflow-hidden rounded-lg bg-[var(--bg-muted)]">
                    <div className={cn('h-full rounded-lg transition-[width] duration-300', step.color)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </DashboardPanel>
      </section>

      {/* CSAT + open conversations */}
      <section className="grid gap-4 xl:grid-cols-[0.6fr_1fr]">
        <DashboardPanel
          title={fa ? 'رضایت مشتری' : 'Customer satisfaction'}
          subtitle={fa ? 'از لحن و نتیجهٔ گفتگوهای ۳۰ روز اخیر' : 'From the tone and outcome of the last 30 days of conversations'}
        >
          {csatCount > 0 ? (
            <div className="py-2">
              <div className="flex items-end justify-between gap-3">
                <p className="text-3xl font-bold tabular-nums text-[var(--text-primary)]">
                  {csatPct !== null ? `${nfFa(csatPct, fa)}${pctSign}` : '—'}
                </p>
                <p className="text-end text-xs leading-5 text-[var(--text-muted)]">
                  {csatPct !== null
                    ? (fa
                        ? `${nfFa(csat.satisfied, fa)} راضی از ${nfFa(csatDecided, fa)} گفتگو با نظر روشن`
                        : `${nfFa(csat.satisfied, fa)} satisfied of ${nfFa(csatDecided, fa)} with a clear view`)
                    : (fa ? 'هنوز هیچ مشتری نظر روشنی نشان نداده' : 'No customer has shown a clear view yet')}
                </p>
              </div>
              <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-[var(--bg-muted)]" aria-hidden="true">
                {csatDecided > 0 && (
                  <>
                    <div className="h-full bg-emerald-500" style={{ width: `${(csat.satisfied / csatDecided) * 100}%` }} />
                    <div className="h-full bg-red-500" style={{ width: `${(csat.dissatisfied / csatDecided) * 100}%` }} />
                  </>
                )}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
                {([
                  ['satisfied', fa ? 'راضی' : 'Satisfied', 'bg-emerald-500'],
                  ['dissatisfied', fa ? 'ناراضی' : 'Dissatisfied', 'bg-red-500'],
                ] as const).map(([key, label, dot]) => (
                  <div key={key} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-2">
                    <dd className="text-lg font-bold tabular-nums text-[var(--text-primary)]">{nfFa(csat[key], fa)}</dd>
                    <dt className="mt-0.5 flex items-center justify-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} aria-hidden="true" />
                      {label}
                    </dt>
                  </div>
                ))}
              </dl>
              {csat.dissatisfied > 0 && (
                <Link
                  href="/conversations?sales=DISSATISFIED"
                  className="ui-link mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--signal-strong)]"
                >
                  {fa ? 'دیدن گفتگوهای ناراضی' : 'See dissatisfied conversations'}
                  <Arrow className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
              {topTopics.length > 0 && (
                <p className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-xs leading-6 text-[var(--text-secondary)]">
                  <span className="font-semibold">{fa ? 'بیشترین موضوع‌ها: ' : 'Top topics: '}</span>
                  {topTopics
                    .map(([topic, count]) => `${topicLabel(topic, lang)} (${nfFa(count, fa)})`)
                    .join(fa ? '، ' : ', ')}
                </p>
              )}
            </div>
          ) : (
            <div className="grid h-40 place-items-center px-2 text-center">
              <div>
                <p className="text-sm font-medium text-[var(--text-secondary)]">{fa ? 'هنوز گفتگویی تحلیل نشده' : 'No conversations analysed yet'}</p>
                <p className="mx-auto mt-1.5 max-w-xs text-xs leading-6 text-[var(--text-muted)]">
                  {fa
                    ? 'رضایت از خودِ گفتگوها خوانده می‌شود؛ لازم نیست مشتری امتیاز بدهد. با اولین گفتگوها همین‌جا دیده می‌شود.'
                    : 'Satisfaction is read from the conversations themselves; customers never have to rate. It appears here with the first conversations.'}
                </p>
              </div>
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title={fa ? 'وضعیت فعلی' : 'Current status'}
          subtitle={fa ? 'تصویری لحظه‌ای از گفتگوهای در جریان' : 'Live snapshot of active conversations'}
        >
          <div className="grid grid-cols-3 gap-3 py-2">
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 text-center">
              <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">{nfFa(openConversations, fa)}</p>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">{fa ? 'گفتگوی باز' : 'Open'}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
              <p className="text-2xl font-bold tabular-nums text-amber-700">{nfFa(handedOff, fa)}</p>
              <p className="mt-1 text-[12px] text-amber-700/70">{fa ? 'تحویل اپراتور' : 'Handed off'}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
              <p className="text-2xl font-bold tabular-nums text-emerald-700">{nfFa(resolvedConversations, fa)}</p>
              <p className="mt-1 text-[12px] text-emerald-700/70">{fa ? 'حل‌شده (۳۰ روز)' : 'Resolved (30d)'}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--bg-surface)] p-3 text-[12px] text-[var(--text-muted)]">
            <Zap className="h-3.5 w-3.5 shrink-0 text-[var(--ok)]" />
            {fa ? 'برای بهبود نرخ حل، قوانین انتقال به اپراتور را در تنظیمات ایجنت دقیق‌تر کنید.' : 'Tune handoff rules per agent to lift your resolution rate.'}
          </div>
        </DashboardPanel>
      </section>
    </div>
  )
}
