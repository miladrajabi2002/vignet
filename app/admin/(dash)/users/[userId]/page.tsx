import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  MessageSquare,
  CreditCard,
  Activity,
  Settings,
  Bot,
  Cable,
  Check,
  Database,
  Sparkles,
  UserRoundCheck,
  Package,
  ShoppingCart,
  Users,
  Eye,
  Boxes,
  HeartPulse,
  FileText,
} from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { ADMIN_VISIBLE_USER_WHERE } from '@/lib/admin/reporting-scope'
import { cn } from '@/lib/utils'
import { getEffectivePlanDefs } from '@/lib/billing/plans'
import { getActiveChannelConnectionCount } from '@/lib/billing/entitlements'
import { displayPhone } from '@/lib/phone'
import { readBusinessProfile } from '@/lib/verticals/profile'
import { getVerticalPack } from '@/lib/verticals/registry'
import { getOnboardingProgress } from '@/lib/onboarding-progress'
import { TrendChart, type DailyPoint } from '@/components/admin/trend-chart'
import { conversationsDailyByWorkspace, paymentsDailyByWorkspace } from '@/lib/admin/charts'
import { PERSIAN_DATE_LOCALE } from '@/lib/localized-date'
import { StartImpersonationButton } from '@/components/admin/start-impersonation-button'
import {
  PageHeader,
  Panel,
  SectionLabel,
  KV,
  StatCard,
  Badge,
  EmptyState,
  Th,
  Td,
  TableShell,
  fa,
  fmtDay,
  fmtDate,
  fmtIRR,
  fmtUSD,
} from '../../ui'

export const dynamic = 'force-dynamic'

type BadgeTone = 'default' | 'info' | 'muted' | 'success' | 'warning' | 'danger'

const PLAN_LABEL: Record<string, { label: string; tone: BadgeTone }> = {
  TRIAL: { label: 'آزمایشی', tone: 'muted' },
  STARTER: { label: 'استارتر', tone: 'info' },
  PRO: { label: 'حرفه‌ای', tone: 'success' },
  BUSINESS: { label: 'سازمانی', tone: 'default' },
}

const CONV_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  OPEN: { label: 'باز', tone: 'info' },
  RESOLVED: { label: 'بسته‌شده', tone: 'success' },
  HANDED_OFF: { label: 'تحویل اپراتور', tone: 'warning' },
}

const PAY_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  PAID: { label: 'پرداخت‌شده', tone: 'success' },
  PENDING: { label: 'در انتظار', tone: 'warning' },
  FAILED: { label: 'ناموفق', tone: 'danger' },
  EXPIRED: { label: 'منقضی', tone: 'muted' },
}

const CHANNEL_LABEL: Record<string, string> = {
  TELEGRAM: 'تلگرام',
  WHATSAPP: 'واتساپ',
  INSTAGRAM: 'اینستاگرام',
  RUBIKA: 'روبیکا',
  BALE: 'بله',
  WEB_WIDGET: 'ویجت وب',
  API: 'API',
  CHAT_LINK: 'لینک چت',
}

const GATEWAY_LABEL: Record<string, string> = {
  ZARINPAY: 'زرین‌پال',
  NOWPAYMENTS: 'کریپتو',
}

const KB_TYPE_LABEL: Record<string, string> = {
  PDF: 'فایل PDF',
  CSV: 'فایل CSV',
  URL: 'صفحه وب',
  TEXT: 'متن',
  FAQ: 'سوالات متداول',
  PRODUCT_CATALOG: 'کاتالوگ محصولات',
}

const KB_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  READY: { label: 'آماده', tone: 'success' },
  PENDING: { label: 'در انتظار', tone: 'warning' },
  PROCESSING: { label: 'در حال پردازش', tone: 'info' },
  ERROR: { label: 'خطا', tone: 'danger' },
}

const HEALTH_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  ok: { label: 'سالم', tone: 'success' },
  degraded: { label: 'ضعیف', tone: 'warning' },
  down: { label: 'قطع', tone: 'danger' },
  unknown: { label: 'بررسی نشده', tone: 'muted' },
}

/** WooCommerce-style statuses stored verbatim on StoreOrder.status. */
const ORDER_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  completed: { label: 'تکمیل‌شده', tone: 'success' },
  processing: { label: 'در حال پردازش', tone: 'info' },
  pending: { label: 'در انتظار پرداخت', tone: 'warning' },
  'on-hold': { label: 'معلق', tone: 'muted' },
  cancelled: { label: 'لغوشده', tone: 'danger' },
  refunded: { label: 'مرجوع‌شده', tone: 'danger' },
  failed: { label: 'ناموفق', tone: 'danger' },
}

/** Store money is synced from WooCommerce in the store's own currency.
 * 'IRT'/'TMN' rows are already Toman; 'IRR' rows are Rial and divide by 10. */
function fmtStoreMoney(total: number, currency: string): string {
  const normalized = currency.toUpperCase()
  if (normalized === 'IRR') {
    return `${Math.round(total / 10).toLocaleString('fa-IR')} تومان`
  }
  return `${Math.round(total).toLocaleString('fa-IR')} تومان`
}

const TABS = [
  { key: 'overview', label: 'خلاصه' },
  { key: 'conversations', label: 'گفتگوها' },
  { key: 'channels', label: 'کانال‌ها' },
  { key: 'knowledge', label: 'دانش' },
  { key: 'products', label: 'محصولات' },
  { key: 'orders', label: 'سفارش‌ها' },
] as const

type TabKey = (typeof TABS)[number]['key']
const VALID_TABS: readonly TabKey[] = TABS.map((t) => t.key)

export default async function AdminUserDetailPage(
  props: {
    params: Promise<{ userId: string }>
    searchParams: Promise<{ tab?: string }>
  },
) {
  const params = await props.params
  const searchParams = await props.searchParams
  const tab: TabKey = VALID_TABS.includes(searchParams.tab as TabKey)
    ? (searchParams.tab as TabKey)
    : 'overview'

  const user = await prisma.user.findFirst({
    where: { ...ADMIN_VISIBLE_USER_WHERE, id: params.userId },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          reportEmail: true,
          trialEndsAt: true,
          onboardingCompleted: true,
          onboardingKnowledgeSkipped: true,
          onboardingChannelSkipped: true,
          businessType: true,
          businessProfile: true,
          createdAt: true,
          services: {
            orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
            select: {
              id: true,
              name: true,
              active: true,
              durationMinutes: true,
              location: true,
            },
          },
          _count: {
            select: {
              agents: true,
              conversations: true,
              payments: true,
              products: true,
              contacts: true,
            },
          },
        },
      },
    },
  })

  if (!user) notFound()

  const ws = user.workspace
  const workspaceId = user.workspaceId
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // ── shared queries (all tabs) ──
  const [usage, activeChannelCount, convSpark, paySpark, journeySignals, contactStats, orderStats] = await Promise.all([
    prisma.usageLog.aggregate({
      where: { workspaceId, date: { gte: since30 } },
      _sum: { promptTokens: true, completionTokens: true, chargedIRR: true, cost: true },
      _count: { _all: true },
    }),
    getActiveChannelConnectionCount(workspaceId),
    conversationsDailyByWorkspace(7),
    paymentsDailyByWorkspace(7),
    Promise.all([
      prisma.agent.findFirst({ where: { workspaceId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, createdAt: true, updatedAt: true, active: true } }),
      prisma.knowledgeBase.findFirst({ where: { workspaceId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, status: true, createdAt: true, updatedAt: true } }),
      prisma.agentChannel.findFirst({ where: { agent: { workspaceId } }, orderBy: { createdAt: 'asc' }, select: { id: true, type: true, active: true, createdAt: true, lastInboundAt: true } }),
      prisma.conversation.findFirst({ where: { workspaceId }, orderBy: { createdAt: 'asc' }, select: { id: true, createdAt: true, lastMessageAt: true } }),
      prisma.payment.findFirst({ where: { workspaceId, status: 'PAID' }, orderBy: { paidAt: 'asc' }, select: { id: true, paidAt: true, createdAt: true, amount: true, currency: true } }),
      prisma.usageLog.findFirst({ where: { workspaceId, status: 'CAPTURED' }, orderBy: { date: 'asc' }, select: { id: true, date: true, type: true, chargedIRR: true } }),
      prisma.oTPLog.findFirst({ where: { phone: user.phone, verified: true }, orderBy: { sentAt: 'desc' }, select: { sentAt: true } }),
    ]).then(([agent, knowledge, channel, conversation, payment, firstUsage, lastLogin]) => ({ agent, knowledge, channel, conversation, payment, firstUsage, lastLogin })),
    // customer (CRM contact) health: total + active in the last 30 days
    Promise.all([
      prisma.contact.count({ where: { workspaceId } }),
      prisma.contact.count({ where: { workspaceId, lastActivityAt: { gte: since30 } } }),
    ]).then(([total, active30]) => ({ total, active30 })),
    // store orders: total + status distribution (WooCommerce statuses)
    prisma.storeOrder
      .groupBy({ by: ['status'], where: { workspaceId }, _count: { _all: true } })
      .then((rows) => {
        const byStatus = new Map(rows.map((r) => [r.status, r._count._all]))
        return {
          total: rows.reduce((s, r) => s + r._count._all, 0),
          completed: byStatus.get('completed') ?? 0,
          pending: (byStatus.get('pending') ?? 0) + (byStatus.get('on-hold') ?? 0),
          processing: byStatus.get('processing') ?? 0,
          refunded: (byStatus.get('refunded') ?? 0) + (byStatus.get('cancelled') ?? 0) + (byStatus.get('failed') ?? 0),
        }
      }),
  ])

  // ── overview-only queries ──
  const [overviewPayments, overviewConversations] =
    tab === 'overview'
      ? await Promise.all([
          prisma.payment.findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'desc' },
            take: 8,
            select: {
              id: true,
              gateway: true,
              plan: true,
              kind: true,
              amount: true,
              currency: true,
              status: true,
              createdAt: true,
              paidAt: true,
            },
          }),
          prisma.conversation.findMany({
            where: { workspaceId },
            orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
            take: 8,
            select: {
              id: true,
              channel: true,
              status: true,
              messageCount: true,
              lastMessageAt: true,
              createdAt: true,
              agent: { select: { name: true } },
              contact: { select: { name: true, phone: true } },
            },
          }),
        ])
      : [[], []]

  // ── conversations tab ──
  const conversationsTab =
    tab === 'conversations'
      ? await Promise.all([
          prisma.conversation.findMany({
            where: { workspaceId },
            orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
            take: 30,
            select: {
              id: true,
              channel: true,
              status: true,
              messageCount: true,
              lastMessageAt: true,
              createdAt: true,
              agent: { select: { name: true } },
              contact: { select: { name: true, phone: true } },
            },
          }),
          prisma.conversation.groupBy({
            by: ['status'],
            where: { workspaceId },
            _count: { _all: true },
          }),
        ]).then(([rows, byStatus]) => {
          const map = new Map(byStatus.map((r) => [r.status, r._count._all]))
          return {
            rows,
            open: map.get('OPEN') ?? 0,
            resolved: map.get('RESOLVED') ?? 0,
            handedOff: map.get('HANDED_OFF') ?? 0,
          }
        })
      : null

  // ── channels tab ──
  const channelsTab =
    tab === 'channels'
      ? await prisma.agentChannel
          .findMany({
            where: { agent: { workspaceId } },
            orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
            select: {
              id: true,
              type: true,
              active: true,
              healthStatus: true,
              healthCheckedAt: true,
              healthError: true,
              lastInboundAt: true,
              createdAt: true,
              agent: { select: { name: true } },
            },
          })
          .then((rows) => ({
            rows,
            total: rows.length,
            activeCount: rows.filter((r) => r.active).length,
            healthy: rows.filter((r) => r.healthStatus === 'ok').length,
          }))
      : null

  // ── knowledge tab ──
  const knowledgeTab =
    tab === 'knowledge'
      ? await prisma.knowledgeBase
          .findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
              chunkCount: true,
              lastIngestedAt: true,
              createdAt: true,
              agent: { select: { name: true } },
            },
          })
          .then((rows) => ({
            rows,
            total: rows.length,
            ready: rows.filter((r) => r.status === 'READY').length,
            chunks: rows.reduce((s, r) => s + r.chunkCount, 0),
          }))
      : null

  // ── products tab ──
  const productsTab =
    tab === 'products'
      ? await Promise.all([
          prisma.product.findMany({
            where: { workspaceId },
            orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
            take: 30,
            select: {
              id: true,
              name: true,
              price: true,
              comparePrice: true,
              stock: true,
              active: true,
              queryCount: true,
              createdAt: true,
              category: { select: { name: true } },
            },
          }),
          prisma.product.aggregate({
            where: { workspaceId },
            _count: { _all: true },
          }),
          prisma.product.count({ where: { workspaceId, active: true } }),
          prisma.product.count({ where: { workspaceId, active: true, stock: 0 } }),
        ]).then(([rows, totalAgg, activeCount, outOfStock]) => ({
          rows,
          total: totalAgg._count._all,
          activeCount,
          outOfStock,
        }))
      : null

  // ── orders tab ──
  const ordersTab =
    tab === 'orders'
      ? await prisma.storeOrder
          .findMany({
            where: { workspaceId },
            orderBy: [{ orderDate: 'desc' }, { createdAt: 'desc' }],
            take: 30,
            select: {
              id: true,
              externalOrderId: true,
              status: true,
              total: true,
              currency: true,
              itemCount: true,
              itemsSummary: true,
              customerName: true,
              customerPhone: true,
              orderDate: true,
              createdAt: true,
            },
          })
          .then((rows) => ({ rows }))
      : null

  const plan = PLAN_LABEL[ws.plan] ?? { label: ws.plan, tone: 'muted' as BadgeTone }
  const planDef = (await getEffectivePlanDefs())[ws.plan]
  const businessProfile = readBusinessProfile(ws.businessProfile)
  const vertical = getVerticalPack(ws.businessType)
  const hasProfile = Boolean(businessProfile)
  const hasAgent = Boolean(journeySignals.agent)
  const hasKnowledge = Boolean(journeySignals.knowledge)
    || ws._count.products > 0
    || ws.onboardingKnowledgeSkipped
  const hasChannel = Boolean(journeySignals.channel)
    || ws.onboardingChannelSkipped
  const onboardingProgress = getOnboardingProgress({
    completed: ws.onboardingCompleted,
    hasProfile,
    hasAgent,
    hasKnowledge,
    hasChannel,
  })
  const serviceNames = Array.from(new Set([
    ...(businessProfile?.services ?? []),
    ...ws.services.map((service) => service.name),
  ]))
  const totalChargedIRR = usage._sum.chargedIRR ?? 0
  const totalCost = usage._sum.cost ?? 0

  // 7-day sparkline data for this user's workspace.
  const convSeries = user.workspaceId ? convSpark.get(user.workspaceId)?.series ?? [] : []
  const paySeries = user.workspaceId ? paySpark.get(user.workspaceId)?.series ?? [] : []

  // Build DailyPoint[] for TrendChart (7 days, oldest → newest).
  const dayFmt = new Intl.DateTimeFormat(PERSIAN_DATE_LOCALE, { month: 'short', day: 'numeric' })
  const convTrendData: DailyPoint[] = convSeries.map((value, i) => {
    const d = new Date(Date.now() - (convSeries.length - 1 - i) * 86_400_000)
    return { day: dayFmt.format(d), value }
  })
  const payTrendData: DailyPoint[] = paySeries.map((value, i) => {
    const d = new Date(Date.now() - (paySeries.length - 1 - i) * 86_400_000)
    return { day: dayFmt.format(d), value }
  })

  const userName = user.name ?? displayPhone(user.phone) ?? user.phone
  const memberSince = fmtDay(user.createdAt)
  const knowledgeDetail = journeySignals.knowledge
    ? `${journeySignals.knowledge.name} · ${journeySignals.knowledge.status}`
    : ws._count.products > 0
      ? `${fa(ws._count.products)} محصول ثبت شده`
      : ws.onboardingKnowledgeSkipped
        ? 'برای بعد گذاشته شده'
        : 'منبع دانشی یا محصولی ثبت نشده'
  const channelDetail = journeySignals.channel
    ? `${CHANNEL_LABEL[journeySignals.channel.type] ?? journeySignals.channel.type}${journeySignals.channel.active ? ' · فعال' : ' · غیرفعال'}`
    : ws.onboardingChannelSkipped
      ? 'اتصال کانال برای بعد گذاشته شده'
      : 'کانالی ثبت نشده'
  const journeySteps = [
    { label: 'ساخت حساب', detail: 'ثبت‌نام و ایجاد فضای کاری', done: true, at: user.createdAt, icon: UserRoundCheck },
    { label: 'اطلاعات کسب‌وکار', detail: businessProfile ? `${businessProfile.businessName} · ${vertical.titleFa}` : 'پروفایل کسب‌وکار ثبت نشده', done: hasProfile, at: null, icon: Settings },
    { label: 'ساخت ایجنت', detail: journeySignals.agent ? journeySignals.agent.name : 'هنوز ایجنتی ساخته نشده', done: Boolean(journeySignals.agent), at: journeySignals.agent?.createdAt ?? null, icon: Bot },
    { label: 'دانش و محصولات', detail: knowledgeDetail, done: hasKnowledge, at: journeySignals.knowledge?.createdAt ?? null, icon: Database },
    { label: 'اتصال کانال', detail: channelDetail, done: hasChannel, at: journeySignals.channel?.createdAt ?? null, icon: Cable },
    { label: 'تأیید راه‌اندازی', detail: ws.onboardingCompleted ? 'راه‌اندازی نهایی شده' : onboardingProgress.readyToFinish ? 'فقط تأیید نهایی کاربر باقی مانده' : 'پیش‌نیازهای راه‌اندازی هنوز کامل نیست', done: ws.onboardingCompleted, at: null, icon: Check },
    { label: 'اولین گفتگو', detail: journeySignals.conversation ? 'ورود به فاز استفاده واقعی' : 'هنوز گفتگویی دریافت نشده', done: Boolean(journeySignals.conversation), at: journeySignals.conversation?.createdAt ?? null, icon: MessageSquare },
    { label: 'مصرف موفق AI', detail: journeySignals.firstUsage ? `${fmtIRR(journeySignals.firstUsage.chargedIRR)} کسر اعتبار` : 'درخواست موفق ثبت نشده', done: Boolean(journeySignals.firstUsage), at: journeySignals.firstUsage?.date ?? null, icon: Sparkles },
    { label: 'تبدیل به مشتری', detail: journeySignals.payment ? (journeySignals.payment.currency === 'IRR' ? fmtIRR(journeySignals.payment.amount) : fmtUSD(journeySignals.payment.amount)) : 'پرداخت موفق ثبت نشده', done: Boolean(journeySignals.payment), at: journeySignals.payment?.paidAt ?? journeySignals.payment?.createdAt ?? null, icon: CreditCard },
  ]
  const currentStepIndex = ws.onboardingCompleted
    ? journeySteps.findIndex((step, index) => index > 5 && !step.done)
    : journeySteps.findIndex((step) => !step.done)
  const completedSteps = journeySteps.filter((step) => step.done).length
  const journeyProgress = Math.round((completedSteps / journeySteps.length) * 100)
  const currentStage = currentStepIndex === -1 ? 'کاربر فعال و پرداختی' : journeySteps[currentStepIndex].label
  const latestActivityAt = [
    user.createdAt,
    journeySignals.agent?.updatedAt,
    journeySignals.knowledge?.updatedAt,
    journeySignals.channel?.lastInboundAt,
    journeySignals.conversation?.lastMessageAt,
    journeySignals.payment?.paidAt,
    journeySignals.firstUsage?.date,
    journeySignals.lastLogin?.sentAt,
  ].filter((value): value is Date => Boolean(value)).sort((a, b) => b.getTime() - a.getTime())[0]

  const tabHref = (key: TabKey) => (key === 'overview' ? `/admin/users/${user.id}` : `/admin/users/${user.id}?tab=${key}`)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${userName} · ${businessProfile?.businessName ?? ws.name}`}
        subtitle={`نمای یکپارچه کاربر و کسب‌وکار · ${vertical.titleFa} · عضو از ${memberSince}`}
        breadcrumbs={[
          { label: 'داشبورد', href: '/admin' },
          { label: 'کاربران', href: '/admin/users' },
          { label: userName },
        ]}
        action={user.platformRole === 'USER'
          ? <StartImpersonationButton userId={user.id} />
          : undefined}
      />

      {/* ─── tab bar (works on mobile: horizontal scroll) ─── */}
      <nav
        aria-label="بخش‌های پرونده کاربر"
        className="sticky top-20 z-20 -mx-1 flex gap-1.5 overflow-x-auto rounded-[1.35rem] border border-black/[0.07] bg-white/90 p-1.5 shadow-[var(--shadow-soft)] backdrop-blur-xl [scrollbar-width:none] md:static md:bg-white/72 [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map(({ key, label }) => (
          <Link
            key={key}
            href={tabHref(key)}
            aria-current={tab === key ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold transition-colors',
              tab === key
                ? 'bg-black text-white shadow-[var(--shadow-control)]'
                : 'text-zinc-500 hover:bg-black/[0.045] hover:text-zinc-900',
            )}
          >
            {label}
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
              tab === key ? 'bg-white/15 text-white' : 'bg-zinc-100 text-zinc-500',
            )}>
              {key === 'conversations' && fa(ws._count.conversations)}
              {key === 'channels' && fa(activeChannelCount)}
              {key === 'knowledge' && (knowledgeTab ? fa(knowledgeTab.total) : '—')}
              {key === 'products' && fa(ws._count.products)}
              {key === 'orders' && fa(orderStats.total)}
            </span>
          </Link>
        ))}
      </nav>

      {/* ═══ TAB: OVERVIEW ═══ */}
      {tab === 'overview' && (
        <>
          <section className="admin-panel overflow-hidden rounded-[1.6rem]" aria-labelledby="user-journey-title">
            <div className="grid lg:grid-cols-[.34fr_.66fr]">
              <div className="border-b border-black/[0.06] bg-[#111214] p-5 text-white lg:border-b-0 lg:border-l sm:p-6">
                <p className="text-[10px] font-bold text-white/60">مسیر فعالیت کاربر</p>
                <h2 id="user-journey-title" className="mt-2 text-xl font-black">گزارش مسیر کاربر</h2>
                <p className="mt-2 text-xs leading-6 text-white/45">مرحله فعلی، نقاط توقف و رویدادهای مهم از داده واقعی همین کسب‌وکار استخراج شده‌اند.</p>
                <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.055] p-4">
                  <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] text-white/40">اقدام بعدی پیشنهادی</p><p className="mt-1 text-sm font-bold">{currentStage}</p></div><span className="text-2xl font-black tabular-nums">{fa(journeyProgress)}٪</span></div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${journeyProgress}%` }} /></div>
                  <div className="mt-4 flex items-center justify-between text-[10px] text-white/38"><span>{fa(completedSteps)} از {fa(journeySteps.length)} مرحله</span><span>{latestActivityAt ? `آخرین فعالیت ${fmtDate(latestActivityAt)}` : 'بدون فعالیت'}</span></div>
                </div>
                {currentStepIndex !== -1 && (
                  <div className="mt-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.07] p-3.5">
                    <p className="text-[10px] font-bold text-amber-200">نیازمند پیگیری</p>
                    <p className="mt-1 text-xs leading-5 text-white/60">اولین مرحله ناقص «{journeySteps[currentStepIndex].label}» است: {journeySteps[currentStepIndex].detail}</p>
                  </div>
                )}
              </div>
              <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4">
                {journeySteps.map((step, index) => {
                  const Icon = step.icon
                  return (
                    <div key={step.label} className={cn('flex min-h-[6.5rem] gap-3 rounded-[1.15rem] border p-3.5', step.done ? 'border-emerald-200/70 bg-emerald-50/35' : index === currentStepIndex ? 'border-amber-200 bg-amber-50/50' : 'border-black/[0.06] bg-black/[0.018]')}>
                      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', step.done ? 'bg-emerald-600 text-white' : index === currentStepIndex ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-400')}>{step.done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span>
                      <div className="min-w-0"><div className="flex items-center gap-2"><p className="text-xs font-black text-black">{fa(index + 1)}. {step.label}</p>{!step.done && index === currentStepIndex && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-bold text-zinc-700">اقدام بعدی</span>}</div><p className="mt-1 line-clamp-2 text-[10px] leading-5 text-black/45">{step.detail}</p><p className="mt-1 text-[10px] text-black/35">{step.at ? fmtDate(step.at) : '—'}</p></div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* ─── 7-day activity trend charts ─── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TrendChart
              title="مکالمات ۷ روز اخیر"
              subtitle={`کل: ${fa(ws._count.conversations)} گفتگو`}
              data={convTrendData}
              color="#3b82f6"
              variant="area"
              format="number"
              height={200}
            />
            <TrendChart
              title="پرداخت‌های ۷ روز اخیر"
              subtitle={`کل: ${fa(ws._count.payments)} پرداخت`}
              data={payTrendData}
              color="#22c55e"
              variant="area"
              format="compact-irr"
              height={200}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* ─── MAIN COLUMN ─── */}
            <div className="space-y-5 lg:col-span-2">
              <Panel title="کاربر و کسب‌وکار" subtitle="تمام اطلاعات هویتی و عملیاتی در یک نمای واحد">
                <div className="grid gap-6 xl:grid-cols-2 xl:gap-8">
                  <div>
                    <SectionLabel>اطلاعات کاربر</SectionLabel>
                    <div className="divide-y divide-zinc-100">
                      <KV label="نام">{user.name ?? '—'}</KV>
                      <KV label="تلفن" mono><span dir="ltr">{displayPhone(user.phone)}</span></KV>
                      <KV label="دسترسی">
                        <Badge tone={user.platformRole === 'ADMIN' ? 'danger' : 'muted'}>
                          {user.platformRole === 'ADMIN' ? 'مدیر اصلی ویجنتو' : 'کاربر'}
                        </Badge>
                      </KV>
                      <KV label="زبان">{user.language}</KV>
                      <KV label="تاریخ عضویت">{memberSince}</KV>
                      <KV label="شناسه" mono><span dir="ltr" className="block max-w-[220px] truncate">{user.id}</span></KV>
                    </div>
                  </div>

                  <div>
                    <SectionLabel>اطلاعات کسب‌وکار</SectionLabel>
                    <div className="divide-y divide-zinc-100">
                      <KV label="نام کسب‌وکار">{businessProfile?.businessName ?? ws.name}</KV>
                      <KV label="نوع کسب‌وکار"><Badge tone="info">{vertical.titleFa}</Badge></KV>
                      <KV label="اسلاگ" mono><span dir="ltr">{ws.slug}</span></KV>
                      <KV label="پلن"><Badge tone={plan.tone}>{plan.label}</Badge></KV>
                      <KV label="ایمیل گزارش">{ws.reportEmail ? <span dir="ltr">{ws.reportEmail}</span> : <span className="text-zinc-400">—</span>}</KV>
                      <KV label="وضعیت راه‌اندازی">
                        {ws.onboardingCompleted
                          ? <Badge tone="success">فعال‌شده</Badge>
                          : <Badge tone={onboardingProgress.readyToFinish ? 'info' : 'warning'}>{onboardingProgress.labelFa}</Badge>}
                      </KV>
                    </div>
                  </div>
                </div>

                <div className="mt-6 border-t border-zinc-100 pt-5">
                  <SectionLabel>خدمات کسب‌وکار</SectionLabel>
                  {serviceNames.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {serviceNames.map((serviceName) => {
                        const operationalService = ws.services.find((service) => service.name === serviceName)
                        return (
                          <span key={serviceName} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-black/[0.07] bg-zinc-50 px-3 text-xs font-semibold text-zinc-700">
                            {serviceName}
                            {operationalService && (
                              <span className="text-[10px] font-normal text-zinc-400">
                                {fa(operationalService.durationMinutes)} دقیقه{operationalService.location ? ` · ${operationalService.location}` : ''}{!operationalService.active ? ' · غیرفعال' : ''}
                              </span>
                            )}
                          </span>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-5 text-center text-xs text-zinc-400">هنوز خدمتی برای این کسب‌وکار ثبت نشده است</p>
                  )}
                </div>
              </Panel>

              {/* Business KPI grid — the "plugin" numbers the operator asked for */}
              <Panel title="آمار کسب‌وکار" subtitle="تصویر لحظه‌ای از دارایی‌های این کاربر روی پلتفرم">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <StatCard
                    label="مشتریان"
                    value={contactStats.total}
                    sub={`${fa(contactStats.active30)} فعال در ۳۰ روز`}
                    icon={<Users className="h-4 w-4" />}
                  />
                  <StatCard
                    label="گفتگوها"
                    value={ws._count.conversations}
                    icon={<MessageSquare className="h-4 w-4" />}
                    tone="info"
                  />
                  <StatCard
                    label="سفارش‌ها"
                    value={orderStats.total}
                    sub={`${fa(orderStats.completed)} تکمیل‌شده`}
                    icon={<ShoppingCart className="h-4 w-4" />}
                    tone="success"
                  />
                  <StatCard
                    label="محصولات"
                    value={ws._count.products}
                    icon={<Package className="h-4 w-4" />}
                    tone="warning"
                  />
                  <StatCard
                    label="ایجنت‌ها"
                    value={ws._count.agents}
                    icon={<Bot className="h-4 w-4" />}
                    tone="info"
                  />
                  <StatCard
                    label="اتصال کانال فعال"
                    value={`${fa(activeChannelCount)} / ${fa(planDef.maxChannels)}`}
                    icon={<Cable className="h-4 w-4" />}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-black/[0.06] bg-black/[0.018] p-3 text-[11px] sm:grid-cols-4">
                  <Link href={tabHref('conversations')} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-black/[0.06] bg-white px-2 font-bold text-zinc-700 transition-colors hover:text-black">جزئیات گفتگوها</Link>
                  <Link href={tabHref('channels')} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-black/[0.06] bg-white px-2 font-bold text-zinc-700 transition-colors hover:text-black">کانال‌های فعال</Link>
                  <Link href={tabHref('knowledge')} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-black/[0.06] bg-white px-2 font-bold text-zinc-700 transition-colors hover:text-black">دانش‌نامه‌ها</Link>
                  <Link href={tabHref('orders')} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-black/[0.06] bg-white px-2 font-bold text-zinc-700 transition-colors hover:text-black">سفارش‌های فروشگاه</Link>
                </div>
              </Panel>

              {/* 30-day usage stats */}
              <Panel title="مصرف ۳۰ روز اخیر">
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    label="درخواست‌های AI"
                    value={usage._count._all}
                    icon={<Activity className="h-4 w-4" />}
                    tone="warning"
                  />
                  <StatCard
                    label="توکن مصرفی"
                    value={(usage._sum.promptTokens ?? 0) + (usage._sum.completionTokens ?? 0)}
                    sub={`ورودی ${fa(usage._sum.promptTokens ?? 0)} · خروجی ${fa(usage._sum.completionTokens ?? 0)}`}
                    icon={<Sparkles className="h-4 w-4" />}
                    tone="info"
                  />
                </div>
              </Panel>

              {/* Recent conversations — compact + clickable */}
              <Panel
                title="آخرین گفتگوها"
                href={tabHref('conversations')}
                linkLabel="همه گفتگوهای این کاربر"
              >
                {overviewConversations.length === 0 ? (
                  <EmptyState icon={<MessageSquare className="h-7 w-7" />}>
                    گفتگویی ثبت نشده
                  </EmptyState>
                ) : (
                  <ul className="divide-y divide-zinc-100">
                    {overviewConversations.map((c) => {
                      const st = CONV_STATUS[c.status] ?? { label: c.status, tone: 'muted' as BadgeTone }
                      const contact = c.contact?.name || displayPhone(c.contact?.phone) || 'مخاطب ناشناس'
                      return (
                        <li key={c.id}>
                          <Link
                            href={`/admin/conversations/${c.id}`}
                            className="flex min-h-14 flex-wrap items-center gap-2 rounded-xl px-2 py-2.5 transition-colors hover:bg-zinc-50"
                          >
                            <span className="truncate text-sm font-medium text-zinc-800">{contact}</span>
                            <Badge tone="info">{CHANNEL_LABEL[c.channel] ?? c.channel}</Badge>
                            <Badge tone={st.tone}>{st.label}</Badge>
                            <span className="ms-auto text-xs text-zinc-500">
                              {fa(c.messageCount)} پیام · {fmtDate(c.lastMessageAt ?? c.createdAt)}
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Panel>

              {/* Recent payments */}
              <Panel
                title="پرداخت‌های اخیر"
                href="/admin/payments"
                linkLabel="همه پرداخت‌ها"
              >
                {(overviewPayments.length) === 0 ? (
                  <EmptyState icon={<CreditCard className="h-7 w-7" />}>
                    پرداختی ثبت نشده
                  </EmptyState>
                ) : (
                  <ul className="divide-y divide-zinc-100">
                    {overviewPayments.map((p) => {
                      const st = PAY_STATUS[p.status] ?? { label: p.status, tone: 'muted' as BadgeTone }
                      const pl = p.kind === 'AI_CREDIT' || !p.plan
                        ? { label: 'اعتبار هوش مصنوعی', tone: 'info' as BadgeTone }
                        : (PLAN_LABEL[p.plan] ?? { label: p.plan, tone: 'muted' as BadgeTone })
                      const amount = p.currency === 'IRR' ? fmtIRR(p.amount) : fmtUSD(p.amount)
                      return (
                        <li
                          key={p.id}
                          className="flex flex-wrap items-center gap-2 py-2.5"
                        >
                          <Badge tone="default">{GATEWAY_LABEL[p.gateway] ?? p.gateway}</Badge>
                          <Badge tone={pl.tone}>{pl.label}</Badge>
                          <span dir="ltr" className="font-mono text-xs text-zinc-800">
                            {amount}
                          </span>
                          <Badge tone={st.tone}>{st.label}</Badge>
                          <span className="ms-auto text-xs text-zinc-500">{fmtDate(p.createdAt)}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Panel>
            </div>

            {/* ─── SIDEBAR ─── */}
            <div className="space-y-5">
              {/* Activity summary */}
              <Panel title="خلاصه فعالیت">
                <div className="divide-y divide-zinc-100">
                  <KV label="کل مکالمات">{fa(ws._count.conversations)}</KV>
                  <KV label="کل مشتریان">{fa(contactStats.total)}</KV>
                  <KV label="کل سفارش‌ها">{fa(orderStats.total)}</KV>
                  <KV label="کل محصولات">{fa(ws._count.products)}</KV>
                  <KV label="کل پرداخت‌ها">{fa(ws._count.payments)}</KV>
                  <KV label="مبلغ مصرف‌شده (۳۰ روز)">{fa(Math.round(totalChargedIRR / 10))} تومان</KV>
                  <KV label="هزینه (۳۰ روز)">
                    <span dir="ltr">${fa(totalCost)}</span>
                  </KV>
                </div>
              </Panel>

              {/* Plan info */}
              <Panel title="ترکیب پلن">
                <div className="mb-4">
                  <Badge tone={plan.tone}>{plan.label}</Badge>
                </div>
                <div className="divide-y divide-zinc-100">
                  <KV label="قیمت ماهانه (تومان)">
                    {planDef.priceIRR > 0 ? fmtIRR(planDef.priceIRR) : 'رایگان'}
                  </KV>
                  <KV label="قیمت ماهانه (دلار)">
                    {planDef.priceUSD > 0 ? fmtUSD(planDef.priceUSD) : 'رایگان'}
                  </KV>
                  <KV label="اتصال کانال فعال">{fa(activeChannelCount)} از {fa(planDef.maxChannels)}</KV>
                  <KV label="محدودیت ایجنت">ندارد</KV>
                </div>
              </Panel>

              {/* Quick links */}
              <Panel title="دسترسی سریع">
                <nav className="flex flex-col gap-1">
                  <Link
                    href={tabHref('conversations')}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    <MessageSquare className="h-4 w-4" />
                    گفتگوهای این کاربر
                  </Link>
                  <Link
                    href={tabHref('channels')}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    <Cable className="h-4 w-4" />
                    کانال‌های این کاربر
                  </Link>
                  <Link
                    href={tabHref('orders')}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    سفارش‌های این کاربر
                  </Link>
                  <Link
                    href="/admin/payments"
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    <CreditCard className="h-4 w-4" />
                    مشاهده پرداخت‌ها
                  </Link>
                </nav>
              </Panel>
            </div>
          </div>
        </>
      )}

      {/* ═══ TAB: CONVERSATIONS ═══ */}
      {tab === 'conversations' && conversationsTab && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="کل گفتگوها" value={ws._count.conversations} icon={<MessageSquare className="h-4 w-4" />} />
            <StatCard label="باز" value={conversationsTab.open} tone="info" icon={<Activity className="h-4 w-4" />} />
            <StatCard label="بسته‌شده" value={conversationsTab.resolved} tone="success" icon={<Check className="h-4 w-4" />} />
            <StatCard label="تحویل اپراتور" value={conversationsTab.handedOff} tone="warning" icon={<Users className="h-4 w-4" />} />
          </div>

          {conversationsTab.rows.length === 0 ? (
            <EmptyState icon={<MessageSquare className="h-8 w-8" />}>گفتگویی برای این کاربر ثبت نشده است</EmptyState>
          ) : (
            <>
              {/* mobile cards */}
              <div className="grid gap-3 md:hidden">
                {conversationsTab.rows.map((c) => {
                  const st = CONV_STATUS[c.status] ?? { label: c.status, tone: 'muted' as BadgeTone }
                  const contact = c.contact?.name || displayPhone(c.contact?.phone) || 'مخاطب ناشناس'
                  return (
                    <article key={c.id} className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-[var(--shadow-soft)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-zinc-950">{contact}</p>
                          <p className="mt-1 truncate text-xs text-zinc-500">ایجنت: {c.agent.name}</p>
                        </div>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-3 text-xs">
                        <div><dt className="text-zinc-400">کانال</dt><dd className="mt-1"><Badge tone="muted">{CHANNEL_LABEL[c.channel] ?? c.channel}</Badge></dd></div>
                        <div><dt className="text-zinc-400">تعداد پیام</dt><dd className="mt-1 font-bold tabular-nums text-zinc-900">{fa(c.messageCount)}</dd></div>
                        <div className="col-span-2"><dt className="text-zinc-400">آخرین فعالیت</dt><dd className="mt-1 font-medium text-zinc-700">{fmtDate(c.lastMessageAt ?? c.createdAt)}</dd></div>
                      </dl>
                      <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
                        <span className="text-[11px] text-zinc-400">شروع: {fmtDate(c.createdAt)}</span>
                        <Link href={`/admin/conversations/${c.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-200 px-3 text-xs font-bold text-zinc-900"><Eye className="h-4 w-4" /> مشاهده گفتگو</Link>
                      </div>
                    </article>
                  )
                })}
              </div>
              {/* desktop table — rows are clickable */}
              <div className="hidden md:block">
                <TableShell>
                  <thead className="border-b border-zinc-200 bg-zinc-50/60">
                    <tr>
                      <Th>مخاطب</Th>
                      <Th>کانال</Th>
                      <Th>ایجنت</Th>
                      <Th>وضعیت</Th>
                      <Th>پیام‌ها</Th>
                      <Th>آخرین فعالیت</Th>
                      <Th>مشاهده</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {conversationsTab.rows.map((c) => {
                      const st = CONV_STATUS[c.status] ?? { label: c.status, tone: 'muted' as BadgeTone }
                      const contact = c.contact?.name || displayPhone(c.contact?.phone) || 'مخاطب ناشناس'
                      return (
                        <tr key={c.id} className="transition-colors hover:bg-zinc-50/60">
                          <Td>
                            <Link href={`/admin/conversations/${c.id}`} className="font-medium text-zinc-900 hover:underline">
                              {contact}
                            </Link>
                          </Td>
                          <Td><Badge tone="muted">{CHANNEL_LABEL[c.channel] ?? c.channel}</Badge></Td>
                          <Td className="text-zinc-600">{c.agent.name}</Td>
                          <Td><Badge tone={st.tone}>{st.label}</Badge></Td>
                          <Td className="tabular-nums text-zinc-600">{fa(c.messageCount)}</Td>
                          <Td className="text-zinc-500">{fmtDate(c.lastMessageAt ?? c.createdAt)}</Td>
                          <Td>
                            <Link href={`/admin/conversations/${c.id}`} aria-label="مشاهده گفتگو" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-black/[0.08] px-3 text-xs font-semibold text-black/65 transition-[background-color,transform] hover:bg-black/[0.04] active:scale-[.97]"><Eye className="h-4 w-4" /> گفتگو</Link>
                          </Td>
                        </tr>
                      )
                    })}
                  </tbody>
                </TableShell>
              </div>
              <p className="text-center text-[11px] text-zinc-400">
                ۳۰ گفتگوی آخر این کاربر — برای بقیه به <Link href="/admin/conversations" className="font-bold text-zinc-600 underline">لیست کامل گفتگوها</Link> بروید
              </p>
            </>
          )}
        </>
      )}

      {/* ═══ TAB: CHANNELS ═══ */}
      {tab === 'channels' && channelsTab && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="کل اتصال‌ها" value={channelsTab.total} icon={<Cable className="h-4 w-4" />} />
            <StatCard label="فعال" value={channelsTab.activeCount} tone="success" icon={<Check className="h-4 w-4" />} />
            <StatCard label="سلامت کانال" value={channelsTab.healthy} tone={channelsTab.healthy === channelsTab.total ? 'success' : 'warning'} icon={<HeartPulse className="h-4 w-4" />} sub={`${fa(activeChannelCount)} از ${fa(planDef.maxChannels)} مجاز پلن`} />
            <StatCard label="سقف پلن" value={`${fa(activeChannelCount)} / ${fa(planDef.maxChannels)}`} tone="info" icon={<Settings className="h-4 w-4" />} />
          </div>

          {channelsTab.rows.length === 0 ? (
            <EmptyState icon={<Cable className="h-8 w-8" />}>این کاربر هنوز کانالی وصل نکرده است</EmptyState>
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {channelsTab.rows.map((ch) => {
                  const health = HEALTH_STATUS[ch.healthStatus] ?? { label: ch.healthStatus, tone: 'muted' as BadgeTone }
                  return (
                    <article key={ch.id} className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-[var(--shadow-soft)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-zinc-950">{CHANNEL_LABEL[ch.type] ?? ch.type}</p>
                          <p className="mt-1 truncate text-xs text-zinc-500">ایجنت: {ch.agent.name}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <Badge tone={ch.active ? 'success' : 'muted'}>{ch.active ? 'فعال' : 'غیرفعال'}</Badge>
                          <Badge tone={health.tone}>{health.label}</Badge>
                        </div>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-3 text-xs">
                        <div><dt className="text-zinc-400">آخرین پیام دریافتی</dt><dd className="mt-1 font-medium text-zinc-700">{ch.lastInboundAt ? fmtDate(ch.lastInboundAt) : '—'}</dd></div>
                        <div><dt className="text-zinc-400">آخرین بررسی سلامت</dt><dd className="mt-1 font-medium text-zinc-700">{ch.healthCheckedAt ? fmtDate(ch.healthCheckedAt) : '—'}</dd></div>
                        <div className="col-span-2"><dt className="text-zinc-400">تاریخ اتصال</dt><dd className="mt-1 font-medium text-zinc-700">{fmtDate(ch.createdAt)}</dd></div>
                      </dl>
                    </article>
                  )
                })}
              </div>
              <div className="hidden md:block">
                <TableShell>
                  <thead className="border-b border-zinc-200 bg-zinc-50/60">
                    <tr>
                      <Th>کانال</Th>
                      <Th>ایجنت</Th>
                      <Th>وضعیت</Th>
                      <Th>سلامت</Th>
                      <Th>آخرین پیام دریافتی</Th>
                      <Th>آخرین بررسی</Th>
                      <Th>تاریخ اتصال</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {channelsTab.rows.map((ch) => {
                      const health = HEALTH_STATUS[ch.healthStatus] ?? { label: ch.healthStatus, tone: 'muted' as BadgeTone }
                      return (
                        <tr key={ch.id} className="transition-colors hover:bg-zinc-50/60">
                          <Td><Badge tone="muted">{CHANNEL_LABEL[ch.type] ?? ch.type}</Badge></Td>
                          <Td className="text-zinc-600">{ch.agent.name}</Td>
                          <Td><Badge tone={ch.active ? 'success' : 'muted'}>{ch.active ? 'فعال' : 'غیرفعال'}</Badge></Td>
                          <Td><Badge tone={health.tone}>{health.label}</Badge></Td>
                          <Td className="text-zinc-500">{ch.lastInboundAt ? fmtDate(ch.lastInboundAt) : '—'}</Td>
                          <Td className="text-zinc-500">{ch.healthCheckedAt ? fmtDate(ch.healthCheckedAt) : '—'}</Td>
                          <Td className="text-zinc-500">{fmtDate(ch.createdAt)}</Td>
                        </tr>
                      )
                    })}
                  </tbody>
                </TableShell>
              </div>
            </>
          )}
        </>
      )}

      {/* ═══ TAB: KNOWLEDGE ═══ */}
      {tab === 'knowledge' && knowledgeTab && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="منابع دانش" value={knowledgeTab.total} icon={<Database className="h-4 w-4" />} />
            <StatCard label="آماده استفاده" value={knowledgeTab.ready} tone="success" icon={<Check className="h-4 w-4" />} />
            <StatCard label="قطعه‌های دانش" value={knowledgeTab.chunks} tone="info" icon={<FileText className="h-4 w-4" />} sub="قطعه‌های قابل بازیابی توسط AI" />
            <StatCard label="محصولات ثبت‌شده" value={ws._count.products} tone="warning" icon={<Package className="h-4 w-4" />} sub="کاتالوگ محصول هم منبع دانش است" />
          </div>

          {knowledgeTab.rows.length === 0 ? (
            <EmptyState icon={<Database className="h-8 w-8" />}>
              {ws.onboardingKnowledgeSkipped ? 'این کاربر مرحله دانش را رد کرده است' : 'منبع دانشی برای این کاربر ثبت نشده است'}
            </EmptyState>
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {knowledgeTab.rows.map((kb) => {
                  const st = KB_STATUS[kb.status] ?? { label: kb.status, tone: 'muted' as BadgeTone }
                  return (
                    <article key={kb.id} className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-[var(--shadow-soft)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-zinc-950">{kb.name}</p>
                          <p className="mt-1 truncate text-xs text-zinc-500">ایجنت: {kb.agent.name}</p>
                        </div>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-3 text-xs">
                        <div><dt className="text-zinc-400">نوع</dt><dd className="mt-1 font-medium text-zinc-700">{KB_TYPE_LABEL[kb.type] ?? kb.type}</dd></div>
                        <div><dt className="text-zinc-400">قطعه‌ها</dt><dd className="mt-1 font-bold tabular-nums text-zinc-900">{fa(kb.chunkCount)}</dd></div>
                        <div className="col-span-2"><dt className="text-zinc-400">آخرین به‌روزرسانی</dt><dd className="mt-1 font-medium text-zinc-700">{fmtDate(kb.lastIngestedAt ?? kb.createdAt)}</dd></div>
                      </dl>
                    </article>
                  )
                })}
              </div>
              <div className="hidden md:block">
                <TableShell>
                  <thead className="border-b border-zinc-200 bg-zinc-50/60">
                    <tr>
                      <Th>منبع دانش</Th>
                      <Th>نوع</Th>
                      <Th>ایجنت</Th>
                      <Th>وضعیت</Th>
                      <Th>قطعه‌ها</Th>
                      <Th>آخرین به‌روزرسانی</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {knowledgeTab.rows.map((kb) => {
                      const st = KB_STATUS[kb.status] ?? { label: kb.status, tone: 'muted' as BadgeTone }
                      return (
                        <tr key={kb.id} className="transition-colors hover:bg-zinc-50/60">
                          <Td className="font-medium text-zinc-800">{kb.name}</Td>
                          <Td><Badge tone="muted">{KB_TYPE_LABEL[kb.type] ?? kb.type}</Badge></Td>
                          <Td className="text-zinc-600">{kb.agent.name}</Td>
                          <Td><Badge tone={st.tone}>{st.label}</Badge></Td>
                          <Td className="tabular-nums text-zinc-600">{fa(kb.chunkCount)}</Td>
                          <Td className="text-zinc-500">{fmtDate(kb.lastIngestedAt ?? kb.createdAt)}</Td>
                        </tr>
                      )
                    })}
                  </tbody>
                </TableShell>
              </div>
            </>
          )}
        </>
      )}

      {/* ═══ TAB: PRODUCTS ═══ */}
      {tab === 'products' && productsTab && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="کل محصولات" value={productsTab.total} icon={<Package className="h-4 w-4" />} />
            <StatCard label="فعال" value={productsTab.activeCount} tone="success" icon={<Check className="h-4 w-4" />} />
            <StatCard label="ناموجود" value={productsTab.outOfStock} tone={productsTab.outOfStock > 0 ? 'warning' : 'default'} icon={<Boxes className="h-4 w-4" />} sub="موجودی صفر" />
            <StatCard label="مجاز پلن" value={`${fa(productsTab.total)} / ${fa(planDef.maxProducts)}`} tone="info" icon={<Settings className="h-4 w-4" />} sub="سقف محصول پلن فعلی" />
          </div>

          {productsTab.rows.length === 0 ? (
            <EmptyState icon={<Package className="h-8 w-8" />}>محصولی برای این کاربر ثبت نشده است</EmptyState>
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {productsTab.rows.map((p) => (
                  <article key={p.id} className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-[var(--shadow-soft)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-zinc-950">{p.name}</p>
                        {p.category && <p className="mt-1 truncate text-xs text-zinc-500">{p.category.name}</p>}
                      </div>
                      <Badge tone={p.active ? 'success' : 'muted'}>{p.active ? 'فعال' : 'غیرفعال'}</Badge>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-3 text-xs">
                      <div><dt className="text-zinc-400">قیمت</dt><dd className="mt-1 font-bold tabular-nums text-zinc-900">{p.price != null ? fmtStoreMoney(p.price, 'IRT') : '—'}</dd></div>
                      <div><dt className="text-zinc-400">موجودی</dt><dd className="mt-1 font-medium text-zinc-700">{p.stock == null ? 'نامحدود' : fa(p.stock)}</dd></div>
                      <div className="col-span-2"><dt className="text-zinc-400">دفعات نمایش توسط AI</dt><dd className="mt-1 font-medium text-zinc-700">{fa(p.queryCount)}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
              <div className="hidden md:block">
                <TableShell>
                  <thead className="border-b border-zinc-200 bg-zinc-50/60">
                    <tr>
                      <Th>محصول</Th>
                      <Th>دسته</Th>
                      <Th>قیمت (تومان)</Th>
                      <Th>موجودی</Th>
                      <Th>نمایش AI</Th>
                      <Th>وضعیت</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {productsTab.rows.map((p) => (
                      <tr key={p.id} className="transition-colors hover:bg-zinc-50/60">
                        <Td className="max-w-[280px] truncate font-medium text-zinc-800">{p.name}</Td>
                        <Td className="text-zinc-500">{p.category?.name ?? '—'}</Td>
                        <Td className="tabular-nums text-zinc-700">{p.price != null ? fa(p.price) : '—'}</Td>
                        <Td className="text-zinc-600">
                          {p.stock == null ? <span className="text-zinc-400">نامحدود</span> : <span className={p.stock === 0 ? 'font-bold text-red-600' : ''}>{fa(p.stock)}</span>}
                        </Td>
                        <Td className="tabular-nums text-zinc-600">{fa(p.queryCount)}</Td>
                        <Td><Badge tone={p.active ? 'success' : 'muted'}>{p.active ? 'فعال' : 'غیرفعال'}</Badge></Td>
                      </tr>
                    ))}
                  </tbody>
                </TableShell>
              </div>
              {productsTab.total > productsTab.rows.length && (
                <p className="text-center text-[11px] text-zinc-400">{fa(productsTab.rows.length)} محصول از {fa(productsTab.total)} — ۳۰ مورد آخر</p>
              )}
            </>
          )}
        </>
      )}

      {/* ═══ TAB: ORDERS ═══ */}
      {tab === 'orders' && ordersTab && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="کل سفارش‌ها" value={orderStats.total} icon={<ShoppingCart className="h-4 w-4" />} />
            <StatCard label="تکمیل‌شده" value={orderStats.completed} tone="success" icon={<Check className="h-4 w-4" />} />
            <StatCard label="در جریان" value={orderStats.processing + orderStats.pending} tone="warning" icon={<Activity className="h-4 w-4" />} sub="در حال پردازش یا در انتظار پرداخت" />
            <StatCard label="مجاز پلن" value={`${fa(orderStats.total)} / ${fa(planDef.maxOrders)}`} tone="info" icon={<Settings className="h-4 w-4" />} sub="سقف سفارش پلن فعلی" />
          </div>

          {ordersTab.rows.length === 0 ? (
            <EmptyState icon={<ShoppingCart className="h-8 w-8" />}>سفارشی برای فروشگاه این کاربر ثبت نشده است</EmptyState>
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {ordersTab.rows.map((o) => {
                  const st = ORDER_STATUS[o.status] ?? { label: o.status, tone: 'muted' as BadgeTone }
                  return (
                    <article key={o.id} className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-[var(--shadow-soft)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-zinc-950">سفارش #{o.externalOrderId}</p>
                          <p className="mt-1 truncate text-xs text-zinc-500">{o.customerName || displayPhone(o.customerPhone) || 'مشتری ناشناس'}</p>
                        </div>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </div>
                      {o.itemsSummary && <p className="mt-2 line-clamp-2 rounded-xl bg-zinc-50 p-3 text-[11px] leading-5 text-zinc-600">{o.itemsSummary}</p>}
                      <dl className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-3 text-xs">
                        <div><dt className="text-zinc-400">مبلغ</dt><dd className="mt-1 font-bold tabular-nums text-zinc-900">{fmtStoreMoney(o.total, o.currency)}</dd></div>
                        <div><dt className="text-zinc-400">اقلام</dt><dd className="mt-1 font-medium text-zinc-700">{fa(o.itemCount)}</dd></div>
                        <div className="col-span-2"><dt className="text-zinc-400">تاریخ سفارش</dt><dd className="mt-1 font-medium text-zinc-700">{fmtDate(o.orderDate ?? o.createdAt)}</dd></div>
                      </dl>
                    </article>
                  )
                })}
              </div>
              <div className="hidden md:block">
                <TableShell>
                  <thead className="border-b border-zinc-200 bg-zinc-50/60">
                    <tr>
                      <Th>سفارش</Th>
                      <Th>مشتری</Th>
                      <Th>اقلام</Th>
                      <Th>مبلغ (تومان)</Th>
                      <Th>وضعیت</Th>
                      <Th>تاریخ</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {ordersTab.rows.map((o) => {
                      const st = ORDER_STATUS[o.status] ?? { label: o.status, tone: 'muted' as BadgeTone }
                      return (
                        <tr key={o.id} className="transition-colors hover:bg-zinc-50/60">
                          <Td className="font-mono text-zinc-800"><span dir="ltr">#{o.externalOrderId}</span></Td>
                          <Td className="max-w-[200px] truncate text-zinc-600">{o.customerName || displayPhone(o.customerPhone) || 'مشتری ناشناس'}</Td>
                          <Td className="max-w-[300px] truncate text-zinc-500">{o.itemsSummary ?? '—'}</Td>
                          <Td className="tabular-nums font-semibold text-zinc-800">{fmtStoreMoney(o.total, o.currency)}</Td>
                          <Td><Badge tone={st.tone}>{st.label}</Badge></Td>
                          <Td className="text-zinc-500">{fmtDate(o.orderDate ?? o.createdAt)}</Td>
                        </tr>
                      )
                    })}
                  </tbody>
                </TableShell>
              </div>
              {orderStats.total > ordersTab.rows.length && (
                <p className="text-center text-[11px] text-zinc-400">{fa(ordersTab.rows.length)} سفارش از {fa(orderStats.total)} — ۳۰ مورد آخر</p>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
