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
  TrendingUp,
  Zap,
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { DashboardPanel } from '@/components/dashboard/panel'
import { PageHeader } from '@/components/dashboard/page-header'
import { ConversationChart, ChannelDonut, SatisfactionGauge } from '@/components/dashboard/charts/lazy'
import type { TrendPoint } from '@/components/dashboard/charts/conversation-chart'
import { CHANNEL_LABELS } from '@/components/crm/channel-badge'
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
        _count: { select: { conversations: { where: { createdAt: { gte: since } } } } },
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
    prisma.message.findMany({
      where: { conversation: { workspaceId }, rating: { not: null }, createdAt: { gte: since } },
      select: { rating: true },
    }),
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
    label: CHANNEL_LABELS[c.channel as keyof typeof CHANNEL_LABELS] ?? c.channel,
    value: c._count._all,
  }))

  const avgMsgsPerConv = totalConversations > 0 ? Math.round((assistantMsgCount._count._all / totalConversations) * 10) / 10 : null
  const csatCount = csatRows.length
  const csatAvg = csatCount > 0 ? csatRows.reduce((s, m) => s + (m.rating ?? 0), 0) / csatCount : null

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
      value: avgMsgsPerConv !== null ? `${nfFa(avgMsgsPerConv, fa)}` : '—',
      hint: fa ? 'میانگین پاسخ‌های ایجنت' : 'avg agent replies',
      tone: 'default' as const,
    },
    {
      icon: Star,
      label: fa ? 'رضایت مشتری' : 'CSAT',
      value: csatAvg !== null ? `${nfFa(Math.round(csatAvg * 20), fa)}${fa ? '٪' : '%'}` : '—',
      hint: fa ? `از ${nfFa(csatCount, fa)} امتیاز` : `from ${nfFa(csatCount, fa)} ratings`,
      tone: 'success' as const,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        icon={BarChart3}
        title={fa ? 'تحلیل عمیق گفتگوها و عملکرد' : 'Deep performance analytics'}
        subtitle={fa ? `۳۰ روز گذشته · ${workspace.name}` : `Last 30 days · ${workspace.name}`}
        actions={
          <Link
            href="/overview"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <Arrow className="h-3.5 w-3.5 rtl:rotate-180" />
            {fa ? 'بازگشت به نمای کلی' : 'Back to overview'}
          </Link>
        }
      />

      {/* KPI row */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div
              key={kpi.label}
              className="relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white p-4 shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'grid h-9 w-9 place-items-center rounded-xl',
                    kpi.tone === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <TrendingUp className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{kpi.value}</p>
              <p className="mt-0.5 text-[11px] font-medium text-[var(--text-secondary)]">{kpi.label}</p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">{kpi.hint}</p>
            </div>
          )
        })}
      </section>

      {/* Main trend + channel donut */}
      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <DashboardPanel
          title={fa ? 'روند ۳۰ روزه گفتگوها' : '30-day conversation trend'}
          subtitle={fa ? 'گفتگوهای روزانه به‌همراه حل‌شده و تحویل اپراتور' : 'Daily conversations, resolutions and handoffs'}
        >
          <ConversationChart data={trend} />
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px]">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--text-primary)]" />{fa ? 'کل گفتگوها' : 'Total'}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />{fa ? 'حل‌شده' : 'Resolved'}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />{fa ? 'تحویل اپراتور' : 'Handed off'}</span>
          </div>
        </DashboardPanel>

        <DashboardPanel
          title={fa ? 'توزیع کانال‌ها' : 'Channel distribution'}
          subtitle={fa ? 'کدام کانال بیشترین ترافیک را دارد' : 'Where conversations come from'}
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
            <div className="grid h-40 place-items-center text-sm text-[var(--text-muted)]">{fa ? 'داده‌ای نیست' : 'No data'}</div>
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
                        <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{nfFa(share, fa)}{fa ? '٪' : '%'}</span>
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
              { label: fa ? 'گفتگو دریافت شد' : 'Conversations received', value: totalConversations, color: 'bg-[var(--text-primary)]' },
              { label: fa ? 'توسط ایجنت پاسخ داده شد' : 'Answered by agent', value: totalConversations - handedOff, color: 'bg-emerald-500' },
              { label: fa ? 'حل شد' : 'Resolved', value: resolvedConversations, color: 'bg-emerald-600' },
              { label: fa ? 'تحویل اپراتور' : 'Handed to operator', value: handedOff, color: 'bg-amber-500' },
            ].map((step, i, arr) => {
              const max = arr[0].value || 1
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
          subtitle={fa ? 'میانگین امتیاز در ۳۰ روز' : 'Average rating, last 30 days'}
        >
          {csatCount > 0 ? (
            <div className="grid place-items-center py-4">
              <SatisfactionGauge
                value={csatAvg}
                count={csatCount}
                label={fa ? 'امتیاز' : 'ratings'}
              />
            </div>
          ) : (
            <div className="grid h-40 place-items-center text-sm text-[var(--text-muted)]">{fa ? 'هنوز امتیازی ثبت نشده' : 'No ratings yet'}</div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title={fa ? 'وضعیت فعلی' : 'Current status'}
          subtitle={fa ? 'تصویری لحظه‌ای از گفتگوهای در جریان' : 'Live snapshot of active conversations'}
        >
          <div className="grid grid-cols-3 gap-3 py-2">
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 text-center">
              <p className="text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{nfFa(openConversations, fa)}</p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">{fa ? 'گفتگوی باز' : 'Open'}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
              <p className="text-2xl font-semibold tabular-nums text-amber-700">{nfFa(handedOff, fa)}</p>
              <p className="mt-1 text-[11px] text-amber-700/70">{fa ? 'تحویل اپراتور' : 'Handed off'}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
              <p className="text-2xl font-semibold tabular-nums text-emerald-700">{nfFa(resolvedConversations, fa)}</p>
              <p className="mt-1 text-[11px] text-emerald-700/70">{fa ? 'حل‌شده (۳۰ روز)' : 'Resolved (30d)'}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--bg-surface)] p-3 text-[11px] text-[var(--text-muted)]">
            <Zap className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            {fa ? 'برای بهبود نرخ حل، قوانین انتقال به اپراتور را در تنظیمات ایجنت دقیق‌تر کنید.' : 'Tune handoff rules per agent to lift your resolution rate.'}
          </div>
        </DashboardPanel>
      </section>
    </div>
  )
}
