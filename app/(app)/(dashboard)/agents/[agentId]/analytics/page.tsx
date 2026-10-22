import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import {
  MessagesSquare,
  Star,
  CheckCircle2,
  Cpu,
  HelpCircle,
  TrendingUp,
  PieChart,
  BarChart3,
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { StatsCard } from '@/components/dashboard/stats-card'
import { MetricsExplainer } from '@/components/dashboard/metrics-explainer'

import { DashboardPanel } from '@/components/dashboard/panel'
import { DashboardDonut } from '@/components/dashboard/donut'
import { type TrendPoint } from '@/components/dashboard/charts/conversation-chart'
import {
  ConversationChart,
  ChannelDonut,
} from '@/components/dashboard/charts/lazy'
import { BarList } from '@/components/dashboard/charts/bar-list'
import { channelLabel } from '@/components/crm/channel-badge'
import { dateLocaleTag } from '@/lib/localized-date'
import { dashboardTitle } from '@/lib/dashboard/page-title'

export const generateMetadata = dashboardTitle('تحلیل ایجنت', 'Agent analytics')

const DAYS = 14

export default async function AgentAnalyticsPage(
  props: {
    params: Promise<{ agentId: string }>
  }
) {
  const params = await props.params;
  const user = await requireUser()
  const t = await getTranslations('analytics')
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

  const [convos, channelGroups, ratingAgg, resolved, totalConvos, usageAgg, products, unansweredMsgs, openCount, handedOffCount] =
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
        _sum: { chargedIRR: true },
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
      prisma.message.findMany({
        where: {
          unanswered: true,
          conversation: { workspaceId: ws, agentId: agent.id, createdAt: { gte: since }, isPlayground: false },
        },
        select: { metadata: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.conversation.count({ where: { ...where, status: 'OPEN' } }),
      prisma.conversation.count({ where: { ...where, status: 'HANDED_OFF' } }),
    ])

  const dayFmt = new Intl.DateTimeFormat(dateLocaleTag(locale), {
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
    .map((g) => ({ label: channelLabel(g.channel, locale), value: g._count._all }))
    .sort((a, b) => b.value - a.value)

  const avgRating = ratingAgg._avg.rating
  const totalChargedIRR = usageAgg._sum.chargedIRR ?? 0
  const resolveRate = totalConvos ? Math.round((resolved / totalConvos) * 100) : 0
  const nf = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')

  return (
    <div className="space-y-6">
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
          value={avgRating ? avgRating.toFixed(1) : null}
          emptyText={locale === 'fa' ? 'بدون داده' : 'No data'}
          icon={Star}
        />
        <StatsCard
          label={locale === 'fa' ? 'هزینه پاسخ‌ها' : 'Reply cost'}
          value={nf.format(Math.round(totalChargedIRR / 10))}
          unit={locale === 'fa' ? 'تومان' : 'toman'}
          icon={Cpu}
        />
      </div>

      {/* ─── Status donut + 14-day conversation trend — side by side ─── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardPanel
          title={locale === 'fa' ? 'وضعیت گفتگوهای این ایجنت' : 'Conversation Status'}
          subtitle={locale === 'fa' ? 'توزیع بر اساس وضعیت فعلی' : 'Distribution by current status'}
        >
          <DashboardDonut
            data={[
              { label: locale === 'fa' ? 'باز' : 'Open', value: openCount },
              { label: locale === 'fa' ? 'بسته‌شده' : 'Resolved', value: resolved },
              { label: locale === 'fa' ? 'تحویل اپراتور' : 'Handed off', value: handedOffCount },
            ].filter((d) => d.value > 0)}
            centerValue={totalConvos}
            centerLabel={locale === 'fa' ? 'مکالمه' : 'total'}
          />
        </DashboardPanel>

        <Panel title={t('conversationsTrend')}>
          <ConversationChart
            data={trend}
            empty={{
              title: locale === 'fa' ? 'هنوز گفتگویی ثبت نشده' : 'No conversations yet',
              hint: locale === 'fa' ? 'با اولین گفتگوی این ایجنت، روند همین‌جا رسم می‌شود.' : 'The trend is drawn here from this agent’s first conversation.',
            }}
          />
        </Panel>
      </div>

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

      <Panel title={t('unansweredQueries')}>
        {unansweredMsgs.length === 0 ? (
          <Empty text={t('noUnanswered')} />
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {unansweredMsgs.map((msg, i) => {
              const question =
                msg.metadata && typeof msg.metadata === 'object' && 'question' in msg.metadata
                  ? String((msg.metadata as Record<string, unknown>).question)
                  : null
              if (!question) return null
              return (
                <li key={i} className="flex items-start gap-3 py-3">
                  <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <span className="text-sm text-[var(--text-secondary)]">{question}</span>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <MetricsExplainer
        title={
          locale === 'fa'
            ? 'این اعداد از کجا می‌آیند؟'
            : 'Where do these numbers come from?'
        }
        items={[
          {
            icon: MessagesSquare,
            term:
              locale === 'fa' ? 'تعداد گفتگوها: ' : 'Total conversations: ',
            body:
              locale === 'fa'
                ? 'کل گفتگوهای این ایجنت در همهٔ اتصال‌ها و همهٔ زمان‌ها. یک گفتگو ممکن است چند پیام داشته باشد ولی فقط یک‌بار شمرده می‌شود.'
                : 'All conversations this agent has ever had across every channel. A conversation may contain many messages but is counted once.',
          },
          {
            icon: CheckCircle2,
            iconClass: 'text-success',
            term: locale === 'fa' ? 'نرخ تکمیل: ' : 'Resolve rate: ',
            body:
              locale === 'fa'
                ? 'درصد گفتگوهایی که حل‌شده بسته شده‌اند. گفتگوهای باز یا سپرده‌شده به اپراتور حساب نمی‌شوند. گفتگویی که ۲۴ ساعت پیامی نگیرد، خودکار بسته می‌شود.'
                : 'Percentage of conversations closed with status RESOLVED. Open or handed-off conversations are excluded. Auto-close after 24h of inactivity.',
          },
          {
            icon: Star,
            iconClass: 'text-warning',
            term: locale === 'fa' ? 'میانگین رضایت: ' : 'Average rating: ',
            body:
              locale === 'fa'
                ? 'میانگین امتیاز ۱ تا ۵ ستاره‌ای که مشتری‌ها به این ایجنت داده‌اند. فقط گفتگوهای امتیازدار حساب می‌شوند.'
                : 'Average 1–5 star rating users gave this agent. Only rated conversations are included.',
          },
          {
            icon: Cpu,
            term: locale === 'fa' ? 'هزینه پاسخ‌ها: ' : 'Reply cost: ',
            body:
              locale === 'fa'
                ? 'جمع مبلغی که برای جواب‌های موفق این ایجنت از اعتبار کم شده. جزئیاتش در «اشتراک و اعتبار» است.'
                : 'Total amount deducted for successful replies from this agent. Details are shown on the billing page.',
          },
          {
            icon: TrendingUp,
            term:
              locale === 'fa' ? 'روند گفتگوها: ' : 'Conversations trend: ',
            body:
              locale === 'fa'
                ? 'تعداد گفتگوهای تازه در ۱۴ روز گذشته. هر گفتگو یک بار، در روزی که شروع شده، شمرده می‌شود.'
                : 'New conversations per day over the past 14 days. Counts conversation starts, not message volume.',
          },
          {
            icon: PieChart,
            term:
              locale === 'fa'
                ? 'به تفکیک اتصال: '
                : 'Channel breakdown: ',
            body:
              locale === 'fa'
                ? 'تعداد گفتگوهای هر اتصال (تلگرام، بله، روبیکا، واتساپ، اینستاگرام، ویجت سایت)؛ اینکه مشتری‌ها بیشتر از کجا می‌آیند.'
                : 'Conversation count per channel (Telegram, Bale, Rubika, WhatsApp, Instagram, web widget). Shows where your customers reach you most.',
          },
          {
            icon: BarChart3,
            term:
              locale === 'fa'
                ? 'محصولات پرجستجو: '
                : 'Top products: ',
            body:
              locale === 'fa'
                ? 'محصولاتی که ایجنت برای جواب دادن بیشتر از همه سراغشان رفته. هر بار ایجنت محصولی را برای جوابش بیرون بکشد، یکی به شمارش اضافه می‌شود.'
                : 'This agent\'s products retrieved most often in replies. Counter increments each time the product appears in the prompt context.',
          },
          {
            icon: HelpCircle,
            iconClass: 'text-warning',
            term:
              locale === 'fa'
                ? 'سؤالات بی‌پاسخ: '
                : 'Unanswered queries: ',
            body:
              locale === 'fa'
                ? 'پیام‌هایی که ایجنت جوابشان را نمی‌دانست و پیام پیش‌فرض فرستاد یا بی‌جواب ماند. جواب درستشان را از صفحهٔ یادگیری اضافه کنید تا دفعهٔ بعد بداند.'
                : 'User messages the agent could not answer (fallback given or left unanswered). These are knowledge-base improvement opportunities — visit the Learning page to add answers.',
          },
        ]}
      />
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="spatial-surface rounded-card p-5">
      <h2 className="mb-4 text-sm font-bold text-[var(--text-secondary)]">{title}</h2>
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
