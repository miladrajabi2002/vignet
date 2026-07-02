import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import {
  ArrowLeft,
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

  const [convos, channelGroups, ratingAgg, resolved, totalConvos, usageAgg, products, unansweredMsgs] =
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
      prisma.message.findMany({
        where: {
          unanswered: true,
          conversation: { workspaceId: ws, agentId: agent.id, createdAt: { gte: since } },
        },
        select: { metadata: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
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
                ? 'کل گفتگوهای این ایجنت در همه کانال‌ها و همه زمان‌ها. یک گفتگو ممکن است چند پیام داشته باشد ولی فقط یک‌بار شمرده می‌شود.'
                : 'All conversations this agent has ever had across every channel. A conversation may contain many messages but is counted once.',
          },
          {
            icon: CheckCircle2,
            iconClass: 'text-success',
            term: locale === 'fa' ? 'نرخ تکمیل: ' : 'Resolve rate: ',
            body:
              locale === 'fa'
                ? 'درصد گفتگوهایی که با وضعیت RESOLVED بسته شده‌اند. گفتگوهای باز یا تحویل‌داده‌شده به اپراتور در این درصد حساب نمی‌شوند. بسته‌شدن خودکار پس از ۲۴ ساعت بی‌فعالیتی.'
                : 'Percentage of conversations closed with status RESOLVED. Open or handed-off conversations are excluded. Auto-close after 24h of inactivity.',
          },
          {
            icon: Star,
            iconClass: 'text-warning',
            term: locale === 'fa' ? 'میانگین رضایت: ' : 'Average rating: ',
            body:
              locale === 'fa'
                ? 'میانگین امتیاز ۱ تا ۵ ستاره‌ای که کاربران به این ایجنت داده‌اند. فقط گفتگوهایی که امتیاز دریافت کرده‌اند وارد محاسبه می‌شوند.'
                : 'Average 1–5 star rating users gave this agent. Only rated conversations are included.',
          },
          {
            icon: Cpu,
            term: locale === 'fa' ? 'توکن مصرفی: ' : 'Tokens used: ',
            body:
              locale === 'fa'
                ? 'مجموع توکن‌های prompt + completion برای این ایجنت (chat + embedding + TTS + STT). هزینه واقعی در پنل OpenRouter شما قابل مشاهده است.'
                : 'Total prompt + completion tokens for this agent (chat + embedding + TTS + STT). Actual cost is in your OpenRouter dashboard.',
          },
          {
            icon: TrendingUp,
            term:
              locale === 'fa' ? 'روند گفتگوها: ' : 'Conversations trend: ',
            body:
              locale === 'fa'
                ? 'تعداد گفتگوهای جدید در ۱۴ روز گذشته. فقط زمان شروع گفتگو لحاظ می‌شود، نه تعداد پیام‌ها.'
                : 'New conversations per day over the past 14 days. Counts conversation starts, not message volume.',
          },
          {
            icon: PieChart,
            term:
              locale === 'fa'
                ? 'تفکیک کانال‌ها: '
                : 'Channel breakdown: ',
            body:
              locale === 'fa'
                ? 'تعداد گفتگوها به تفکیک کانال (تلگرام، بله، روبیکا، واتساپ، اینستاگرام، وب‌ویجت). به شما نشان می‌دهد مشتریان بیشتر از کدام کانال می‌آیند.'
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
                ? 'محصولات این ایجنت که بیشترین بار در پاسخ‌ها retriev شده‌اند. شمارنده هر بار که محصول در context پرامپت ظاهر می‌شود افزایش می‌یابد.'
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
                ? 'پیام‌های کاربر که ایجنت نتوانسته پاسخ بدهد (fallback message داده یا گفتگو بی‌جواب مانده). این‌ها فرصت‌های بهبود پایگاه دانش هستند — به صفحه یادگیری بروید تا پاسخ اضافه کنید.'
                : 'User messages the agent could not answer (fallback given or left unanswered). These are knowledge-base improvement opportunities — visit the Learning page to add answers.',
          },
        ]}
      />
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
