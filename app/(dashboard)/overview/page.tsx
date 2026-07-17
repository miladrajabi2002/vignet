import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CalendarCheck2,
  Camera,
  ChartNoAxesCombined,
  CheckCircle2,
  GraduationCap,
  MessagesSquare,
  Package,
  Plug,
  QrCode,
  Send,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { computeOnboarding } from '@/lib/onboarding'
import { DashboardPanel } from '@/components/dashboard/panel'
import { IntelligenceCoreLazy } from '@/components/dashboard/intelligence-core-lazy'
import { ConversationChart } from '@/components/dashboard/charts/lazy'
import type { TrendPoint } from '@/components/dashboard/charts/conversation-chart'
import { getDashboardNavigationModules, getVerticalPack, type DashboardModuleKey } from '@/lib/verticals/registry'
import { readBusinessProfile } from '@/lib/verticals/profile'
import { getMonthlyMessageCount } from '@/lib/billing/entitlements'
import { getEffectivePlanDefs } from '@/lib/billing/plans'
import { formatDateTime } from '@/lib/format'
import { CHANNEL_LABELS } from '@/components/crm/channel-badge'
import { cn } from '@/lib/utils'
import { Sparkline } from '@/components/admin/sparkline'
import {
  chargesDailyByWorkspace,
  contactsDailyByWorkspace,
  conversationsDailyByWorkspace,
  resolvedDailyByWorkspace,
} from '@/lib/dashboard/charts'

const TREND_DAYS = 14

const MODULE_META: Record<DashboardModuleKey, { href: string; fa: string; en: string; icon: LucideIcon }> = {
  overview: { href: '/overview', fa: 'نمای کلی', en: 'Overview', icon: Sparkles },
  agents: { href: '/agents', fa: 'ایجنت‌ها', en: 'Agents', icon: Bot },
  products: { href: '/products', fa: 'محصولات و منو', en: 'Products & menu', icon: Package },
  services: { href: '/services', fa: 'خدمات', en: 'Services', icon: BriefcaseBusiness },
  menu: { href: '/menu', fa: 'منوی دیجیتال', en: 'Digital menu', icon: QrCode },
  appointments: { href: '/appointments', fa: 'رزروها و خدمات', en: 'Bookings & services', icon: CalendarCheck2 },
  conversations: { href: '/conversations', fa: 'گفتگوها', en: 'Conversations', icon: MessagesSquare },
  contacts: { href: '/contacts', fa: 'مشتری‌ها', en: 'Customers', icon: Users },
  analytics: { href: '/analytics', fa: 'گزارش‌ها', en: 'Reports', icon: ChartNoAxesCombined },
  instagram: { href: '/instagram', fa: 'اتوماسیون اینستاگرام', en: 'Instagram automation', icon: Camera },
  integrations: { href: '/integrations', fa: 'اتصال‌ها', en: 'Integrations', icon: Plug },
  billing: { href: '/billing', fa: 'مالی و اعتبار', en: 'Billing & credit', icon: Wallet },
  settings: { href: '/settings', fa: 'تنظیمات', en: 'Settings', icon: Sparkles },
}

const PLAN_NAMES_FA: Record<string, string> = {
  TRIAL: 'آزمایشی',
  STARTER: 'استارتر',
  PRO: 'حرفه‌ای',
  BUSINESS: 'سازمانی',
}

export default async function OverviewPage() {
  const user = await requireUser()
  const locale = await getLocale()
  const lang: 'fa' | 'en' = locale === 'en' ? 'en' : 'fa'
  const fa = lang === 'fa'
  const workspaceId = user.workspaceId
  const now = new Date()
  const sevenDaysAgo = daysAgo(7)
  const fourteenDaysAgo = daysAgo(14)

  // Redirect to onboarding if not complete
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { onboardingCompleted: true },
  })
  if (!ws?.onboardingCompleted) {
    redirect('/onboarding')
  }

  const [
    workspace,
    onboarding,
    conversations7d,
    previousConversations7d,
    contacts7d,
    handedOff,
    openConversations,
    totalConversations,
    resolvedConversations,
    pendingLearnings,
    activeAgents,
    activeProducts,
    activeChannels,
    upcomingAppointments,
    trendRows,
    recentConversations,
    subscription,
    messagesUsed,
    operatorChannel,
    conversationsMiniTrend,
    contactsMiniTrend,
    resolvedMiniTrend,
    chargesMonthlyTrend,
  ] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: {
        name: true,
        plan: true,
        trialEndsAt: true,
        aiCreditBalanceIRR: true,
        businessType: true,
        businessProfile: true,
      },
    }),
    computeOnboarding(workspaceId),
    prisma.conversation.count({ where: { workspaceId, createdAt: { gte: sevenDaysAgo } } }),
    prisma.conversation.count({ where: { workspaceId, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
    prisma.contact.count({ where: { workspaceId, createdAt: { gte: sevenDaysAgo } } }),
    prisma.conversation.count({ where: { workspaceId, status: 'HANDED_OFF' } }),
    prisma.conversation.count({ where: { workspaceId, status: 'OPEN' } }),
    prisma.conversation.count({ where: { workspaceId } }),
    prisma.conversation.count({ where: { workspaceId, status: 'RESOLVED' } }),
    prisma.message.count({
      where: { role: 'ASSISTANT', unanswered: true, conversation: { workspaceId } },
    }),
    prisma.agent.count({ where: { workspaceId, active: true } }),
    prisma.product.count({ where: { workspaceId, active: true } }),
    prisma.agentChannel.count({ where: { active: true, agent: { workspaceId } } }),
    prisma.appointment.count({
      where: { workspaceId, startsAt: { gte: now }, status: { in: ['PENDING', 'CONFIRMED'] } },
    }),
    prisma.conversation.findMany({
      where: { workspaceId, createdAt: { gte: daysAgo(TREND_DAYS) } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.conversation.findMany({
      where: { workspaceId },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      take: 6,
      select: {
        id: true,
        channel: true,
        status: true,
        summary: true,
        lastMessageAt: true,
        createdAt: true,
        contact: { select: { name: true, phone: true } },
        agent: { select: { name: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.subscription.findUnique({
      where: { workspaceId },
      select: { currentPeriodEnd: true },
    }),
    getMonthlyMessageCount(workspaceId),
    prisma.operatorChannel.findUnique({
      where: { workspaceId },
      select: { active: true, operatorChatId: true },
    }),
    conversationsDailyByWorkspace(workspaceId, 7),
    contactsDailyByWorkspace(workspaceId, 7),
    resolvedDailyByWorkspace(workspaceId, 7),
    chargesDailyByWorkspace(workspaceId, 30),
  ])

  const pack = getVerticalPack(workspace.businessType)
  const businessProfile = readBusinessProfile(workspace.businessProfile)
  const modules = getDashboardNavigationModules(workspace.businessType, businessProfile?.services).filter(
    (module) => !['overview', 'billing', 'settings'].includes(module),
  )
  const businessLabel = fa ? pack.titleFa : pack.titleEn
  const businessDescription = fa ? pack.descriptionFa : pack.descriptionEn
  const profile = isRecord(workspace.businessProfile) ? workspace.businessProfile : {}
  const profileName = typeof profile.businessName === 'string' ? profile.businessName.trim() : ''
  const displayName = profileName || workspace.name

  const trend = buildTrend(trendRows.map((row) => row.createdAt), lang)
  const resolveRate = totalConversations
    ? Math.round((resolvedConversations / totalConversations) * 100)
    : 0
  const attentionCount = handedOff + pendingLearnings
  const conversationDelta = percentDelta(conversations7d, previousConversations7d)
  const hasBookingModule = modules.includes('appointments')

  const verticalOutcome = hasBookingModule
    ? {
        label: fa ? 'نوبت‌های پیش رو' : 'Upcoming appointments',
        value: upcomingAppointments,
        hint: fa ? 'تأییدشده و در انتظار' : 'confirmed and pending',
        icon: CalendarCheck2,
        href: '/appointments',
      }
    : workspace.businessType === 'COMMERCE' || workspace.businessType === 'FOOD'
      ? {
          label: fa ? 'محصول یا آیتم فعال' : 'Active catalog items',
          value: activeProducts,
          hint: fa ? 'آماده پاسخ‌گویی ایجنت' : 'ready for agent answers',
          icon: Package,
          href: '/products',
        }
      : {
          label: fa ? 'ایجنت فعال' : 'Active agents',
          value: activeAgents,
          hint: fa ? 'در فضای کاری شما' : 'in your workspace',
          icon: Bot,
          href: '/agents',
        }

  const planDef = (await getEffectivePlanDefs())[workspace.plan]
  const planEnd = workspace.plan === 'TRIAL' ? workspace.trialEndsAt : subscription?.currentPeriodEnd
  const daysLeft = planEnd
    ? Math.max(0, Math.ceil((planEnd.getTime() - now.getTime()) / 86_400_000))
    : null
  const usagePercent = Math.min(100, Math.round((messagesUsed / planDef.monthlyMessages) * 100))
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
  const Arrow = fa ? ArrowLeft : ArrowRight

  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
      <section className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="dashboard-arrival dashboard-intro relative overflow-hidden rounded-[1.75rem] border border-[var(--border-default)] p-5 sm:p-7">
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex min-h-7 items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 text-[11px] font-medium text-[var(--text-secondary)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-primary)]" />
                {businessLabel}
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {fa ? `${nf.format(activeChannels)} کانال متصل` : `${nf.format(activeChannels)} channels connected`}
              </span>
            </div>

            <p className="mt-5 text-xs font-medium text-[var(--text-muted)]">
              {fa ? `سلام ${user.name || ''}`.trim() : `Hello ${user.name || ''}`.trim()}
            </p>
            <h1 className="mt-1.5 max-w-xl text-[clamp(1.5rem,3.5vw,2.2rem)] font-semibold leading-[1.25] tracking-[-0.02em] text-[var(--text-primary)] rtl:tracking-normal">
              {fa ? `مرکز عملیات ${displayName}` : `${displayName} operations center`}
            </h1>
            <p className="mt-2.5 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
              {businessDescription}
            </p>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link href="/conversations" className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-[13px] font-medium text-white shadow-[var(--shadow-control)] hover:bg-black">
                <MessagesSquare className="h-4 w-4" />
                {fa ? 'رسیدگی به گفتگوها' : 'Open conversations'}
              </Link>
              <Link href={hasBookingModule ? '/appointments' : '/agents/new'} className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-4 text-[13px] font-medium text-[var(--text-primary)] shadow-[var(--shadow-sm)] hover:bg-[var(--bg-surface)]">
                {hasBookingModule ? <CalendarCheck2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {hasBookingModule
                  ? fa ? 'مدیریت نوبت‌ها' : 'Manage appointments'
                  : fa ? 'ساخت ایجنت' : 'Build agent'}
              </Link>
            </div>
          </div>
        </div>

        {/* IntelligenceCore only shows after onboarding is complete */}
        {onboarding.completed ? (
          <IntelligenceCoreLazy locale={lang} businessName={displayName} businessLabel={businessLabel} businessType={workspace.businessType} modules={modules} className="dashboard-arrival dashboard-arrival--core" />
        ) : (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center">
            <div>
              <Sparkles className="mx-auto h-6 w-6 text-[var(--text-hint)]" />
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                {fa ? 'پس از تکمیل راه‌اندازی، هسته هوشمند فعال می‌شود' : 'Complete setup to activate the intelligence core'}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ── Vigento AI — workspace copilot card ── */}
      <Link
        href="/vigento"
        className="spatial-surface spatial-press group block overflow-hidden rounded-[1.5rem] p-5 transition-[transform,border-color] hover:-translate-y-0.5 hover:border-[var(--border-strong)] sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
                  Vigento AI
                  <span className="ms-2 text-xs font-normal text-[var(--text-muted)]">
                    {fa ? 'هوش مصنوعی ویجنتو' : 'Vigento AI copilot'}
                  </span>
                </h2>
                <span className="inline-flex min-h-6 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-semibold text-emerald-700">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75 motion-reduce:animate-none" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  {fa ? 'آنلاین' : 'Online'}
                </span>
              </div>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                {fa
                  ? 'دستیار مدیریت فضای کاری — آمار گفتگوها، مشتری‌ها، رزروها و هزینه پاسخ‌های AI را از داده زنده بررسی می‌کند و به زبان طبیعی پاسخ می‌دهد.'
                  : 'Workspace management copilot — inspects live conversations, customers, bookings and AI reply costs, then answers in natural language.'}
              </p>
            </div>
          </div>
          <span className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-opacity group-hover:opacity-90">
            {fa ? 'گفتگو با ویجنتو' : 'Chat with Vigento'}
            <Arrow className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
          </span>
        </div>
        {/* Quick prompts — preview of what you can ask */}
        <div className="mt-4 flex flex-wrap gap-2">
          {(fa
            ? ['امروز چه چیزی نیاز به توجه دارد؟', 'پرتعامل‌ترین مشتری‌های امروز کدام‌اند؟', 'هزینه پاسخ‌های AI امروز چقدر بود؟']
            : ['What needs attention today?', 'Who were today\u2019s most active customers?', 'What did AI replies cost today?']
          ).map((prompt) => (
            <span key={prompt} className="inline-flex min-h-8 items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-[11px] font-medium text-[var(--text-secondary)] transition-colors group-hover:border-[var(--border-hover)] group-hover:text-[var(--text-primary)]">
              {prompt}
            </span>
          ))}
        </div>
      </Link>

      {(!operatorChannel?.active || !operatorChannel.operatorChatId) && (
        <Link
          href="/settings#telegram-operator"
          className="spatial-surface spatial-press group flex flex-col gap-4 rounded-[1.5rem] p-4 sm:flex-row sm:items-center sm:p-5"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
            <Send className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-[var(--text-primary)]">
              {fa ? 'ربات مدیر تلگرام را وصل کنید' : 'Connect the Telegram manager bot'}
            </span>
            <span className="mt-1 block text-xs leading-6 text-[var(--text-secondary)]">
              {fa
                ? 'انتقال به اپراتور، رزرو جدید و هشدارهای مهم را با لینک مستقیم همان پرونده در تلگرام بگیرید.'
                : 'Receive handoffs, new bookings, and critical alerts in Telegram with a direct link to the right case.'}
            </span>
          </span>
          <span className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-3 text-xs font-semibold text-[var(--text-primary)] shadow-[var(--shadow-sm)]">
            {fa ? 'اتصال در چند دقیقه' : 'Connect in minutes'}
            <Arrow className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
          </span>
        </Link>
      )}

      <section aria-labelledby="today-heading" className="dashboard-card rounded-[1.4rem] border border-[var(--border-default)] bg-white/[0.94] p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 id="today-heading" className="text-sm font-bold text-[var(--text-primary)]">
              {fa ? 'امروز چه چیزی نیاز به توجه دارد؟' : 'What needs attention today?'}
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {attentionCount === 0
                ? fa ? 'همه‌چیز در مسیر عادی است.' : 'Everything is running normally.'
                : fa ? `${nf.format(attentionCount)} مورد آماده رسیدگی است.` : `${nf.format(attentionCount)} items are ready for review.`}
            </p>
          </div>
          {attentionCount === 0 && (
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          )}
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <AttentionItem
            href="/conversations?status=HANDED_OFF"
            icon={AlertCircle}
            value={handedOff}
            label={fa ? 'تحویل به اپراتور' : 'Operator handoffs'}
            hint={fa ? 'با خلاصه آماده ادامه' : 'with a ready handoff summary'}
            urgent={handedOff > 0}
            locale={lang}
          />
          <AttentionItem
            href="/agents"
            icon={GraduationCap}
            value={pendingLearnings}
            label={fa ? 'سؤال بی‌پاسخ' : 'Unanswered questions'}
            hint={fa ? 'برای تأیید در مرکز یادگیری' : 'ready for learning review'}
            urgent={pendingLearnings > 0}
            locale={lang}
          />
          <AttentionItem
            href={hasBookingModule ? '/appointments' : '/conversations?status=OPEN'}
            icon={hasBookingModule ? CalendarCheck2 : MessagesSquare}
            value={hasBookingModule ? upcomingAppointments : openConversations}
            label={hasBookingModule ? (fa ? 'نوبت پیش رو' : 'Upcoming bookings') : (fa ? 'گفتگوی باز' : 'Open conversations')}
            hint={hasBookingModule ? (fa ? 'نیازمند هماهنگی و اجرا' : 'to coordinate and deliver') : (fa ? 'در حال پیگیری' : 'currently in progress')}
            urgent={false}
            locale={lang}
          />
        </div>
      </section>

      <section aria-label={fa ? 'شاخص‌های اصلی' : 'Key outcomes'} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <OutcomeCard
          href="/conversations"
          icon={MessagesSquare}
          label={fa ? 'گفتگو در ۷ روز' : 'Conversations, 7d'}
          value={nf.format(conversations7d)}
          hint={conversationDelta === null
            ? fa ? 'شروع دوره اندازه‌گیری' : 'measurement started'
            : `${conversationDelta > 0 ? '+' : ''}${nf.format(conversationDelta)}${fa ? '٪' : '%'} ${fa ? 'نسبت به هفته قبل' : 'vs previous week'}`}
          series={conversationsMiniTrend.series}
        />
        <OutcomeCard
          href="/analytics"
          icon={CheckCircle2}
          label={fa ? 'نرخ حل گفتگو' : 'Resolution rate'}
          value={`${nf.format(resolveRate)}${fa ? '٪' : '%'}`}
          hint={fa ? 'نتیجه ثبت‌شده در CRM' : 'recorded outcomes in CRM'}
          series={resolvedMiniTrend.series}
        />
        <OutcomeCard
          href="/contacts"
          icon={Users}
          label={fa ? 'مشتری جدید در ۷ روز' : 'New customers, 7d'}
          value={nf.format(contacts7d)}
          hint={fa ? 'از همه کانال‌های متصل' : 'from every connected channel'}
          series={contactsMiniTrend.series}
        />
        <OutcomeCard
          href={verticalOutcome.href}
          icon={verticalOutcome.icon}
          label={verticalOutcome.label}
          value={nf.format(verticalOutcome.value)}
          hint={verticalOutcome.hint}
        />
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <DashboardPanel
          title={fa ? 'روند گفتگوهای ۱۴ روز اخیر' : 'Conversation trend, last 14 days'}
          subtitle={fa ? 'یک روند اصلی؛ جزئیات کامل در بخش گزارش‌ها' : 'One primary trend; deeper analysis stays in Analytics'}
          action={<Link href="/analytics" className="text-xs font-medium text-[var(--accent-strong)] hover:underline">{fa ? 'گزارش کامل' : 'Full report'}</Link>}
        >
          <ConversationChart data={trend} />
        </DashboardPanel>

        <DashboardPanel
          title={fa ? 'آخرین پرونده‌ها' : 'Recent customer cases'}
          subtitle={fa ? 'آخرین گفتگوها، بدون بازکردن چند صفحه' : 'The latest conversations at a glance'}
          action={<Link href="/conversations" className="text-xs font-medium text-[var(--accent-strong)] hover:underline">{fa ? 'همه گفتگوها' : 'All conversations'}</Link>}
          bodyClassName="divide-y divide-[var(--border-subtle)]"
        >
          {recentConversations.length ? recentConversations.map((conversation) => {
            const timestamp = conversation.lastMessageAt ?? conversation.createdAt
            const customer = conversation.contact?.name || conversation.contact?.phone || (fa ? 'مشتری بدون نام' : 'Unnamed customer')
            return (
              <Link key={conversation.id} href={`/conversations/${conversation.id}`} className="group flex min-h-[4.4rem] min-w-0 items-center gap-3 overflow-hidden py-2.5">
                <span className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-xs font-semibold',
                  conversation.status === 'HANDED_OFF'
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]',
                )}>
                  {customer.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span dir="auto" className="min-w-0 truncate text-xs font-semibold text-[var(--text-primary)]">{customer}</span>
                    <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{formatDateTime(timestamp, lang)}</span>
                  </span>
                  <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                    <span>{CHANNEL_LABELS[conversation.channel] ?? conversation.channel}</span>
                    <span>·</span>
                    <span>{nf.format(conversation._count.messages)} {fa ? 'پیام' : 'messages'}</span>
                    <span>·</span>
                    <span dir="auto" className="min-w-0 truncate">{conversation.summary || conversation.agent.name}</span>
                  </span>
                </span>
                <Arrow className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
              </Link>
            )
          }) : (
            <EmptyState text={fa ? 'هنوز گفتگویی ثبت نشده است.' : 'No conversations yet.'} />
          )}
        </DashboardPanel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.72fr]">
        <DashboardPanel
          title={fa ? `ابزارهای ${businessLabel}` : `${businessLabel} tools`}
          subtitle={fa ? 'هسته مشترک و ابزارهای تخصصی فضای کاری شما' : 'Shared core and specialist tools for this workspace'}
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {modules.slice(0, 6).map((module) => {
              const meta = MODULE_META[module]
              const Icon = meta.icon
              return (
                <Link key={module} href={meta.href} className="group flex min-h-14 items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--accent-border)]">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{fa ? meta.fa : meta.en}</span>
                  <Arrow className="ms-auto h-3.5 w-3.5 text-[var(--text-muted)] transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
                </Link>
              )
            })}
          </div>
        </DashboardPanel>

        <DashboardPanel
          title={fa ? 'پلن و اعتبار' : 'Plan & credit'}
          subtitle={fa ? 'خلاصه کوتاه؛ جزئیات در بخش مالی' : 'A compact summary; details stay in Billing'}
          action={<Link href="/billing" className="text-xs font-medium text-[var(--accent-strong)] hover:underline">{fa ? 'مدیریت' : 'Manage'}</Link>}
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] text-[var(--text-muted)]">{fa ? 'اعتبار پاسخ' : 'Reply credit'}</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-[var(--text-primary)]">
                {nf.format(Math.round(workspace.aiCreditBalanceIRR / 10))} <span className="text-xs font-normal text-[var(--text-muted)]">{fa ? 'تومان' : 'toman'}</span>
              </p>
            </div>
            <div className="text-end">
              <p className="text-[11px] text-[var(--text-muted)]">{fa ? 'پلن فعلی' : 'Current plan'}</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                {fa ? PLAN_NAMES_FA[workspace.plan] : workspace.plan.toLowerCase()}
              </p>
              {daysLeft !== null && <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{fa ? `${nf.format(daysLeft)} روز باقی` : `${nf.format(daysLeft)} days left`}</p>}
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>{fa ? 'مصرف این دوره' : 'Period usage'}</span>
              <span>{nf.format(messagesUsed)} / {nf.format(planDef.monthlyMessages)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
              <div className={cn('h-full rounded-full', usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-[var(--accent)]')} style={{ width: `${usagePercent}%` }} />
            </div>
          </div>
          <div className="spatial-inset mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-[var(--text-muted)]">{fa ? 'هزینه پاسخ‌های AI در ۳۰ روز' : 'AI reply cost, 30 days'}</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--text-primary)]">
                {nf.format(Math.round(chargesMonthlyTrend.total / 10))} <span className="text-[11px] font-normal text-[var(--text-muted)]">{fa ? 'تومان' : 'toman'}</span>
              </p>
            </div>
            <div className="w-24 shrink-0"><Sparkline data={chargesMonthlyTrend.series} color="#111111" width={96} height={28} fluid /></div>
          </div>
        </DashboardPanel>
      </section>
    </div>
  )
}

function AttentionItem({
  href,
  icon: Icon,
  value,
  label,
  hint,
  urgent,
  locale,
}: {
  href: string
  icon: LucideIcon
  value: number
  label: string
  hint: string
  urgent: boolean
  locale: 'fa' | 'en'
}) {
  const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight
  return (
    <Link href={href} className={cn(
      'group flex min-h-[4.5rem] items-center gap-3 rounded-xl border px-3.5 transition-[border-color,background-color,transform] hover:-translate-y-0.5',
      urgent ? 'border-amber-200 bg-amber-50/75' : 'border-[var(--border-default)] bg-[var(--bg-surface)]',
    )}>
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', urgent ? 'bg-amber-100 text-amber-700' : 'bg-white text-[var(--text-secondary)]')}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
          <span className="tabular-nums">{value.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}</span>
          {label}
        </span>
        <span className="mt-1 block truncate text-[11px] text-[var(--text-muted)]">{hint}</span>
      </span>
      <Arrow className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
    </Link>
  )
}

function OutcomeCard({
  href,
  icon: Icon,
  label,
  value,
  hint,
  series,
}: {
  href: string
  icon: LucideIcon
  label: string
  value: string
  hint: string
  series?: number[]
}) {
  return (
    <Link href={href} className="dashboard-card group relative overflow-hidden rounded-[1.3rem] border border-[var(--border-default)] bg-white/[0.94] p-4 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--accent-border)] sm:p-5">
      <div aria-hidden className="absolute -end-9 -top-12 h-24 w-24 rounded-full bg-[var(--accent-soft)] opacity-0 blur-2xl transition-opacity group-hover:opacity-100" />
      <div className="relative flex items-center justify-between gap-2">
        <span className="text-xs font-medium leading-5 text-[var(--text-secondary)]">{label}</span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Icon className="h-3.5 w-3.5" /></span>
      </div>
      <p className="relative mt-3 text-2xl font-bold tabular-nums tracking-tight text-[var(--text-primary)] sm:text-3xl">{value}</p>
      <p className="relative mt-1 min-h-4 text-[11px] leading-5 text-[var(--text-muted)]">{hint}</p>
      {series?.length ? <div className="relative mt-2 h-7"><Sparkline data={series} color="#111111" height={28} fluid /></div> : null}
    </Link>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="py-10 text-center text-xs text-[var(--text-muted)]">{text}</div>
}

function buildTrend(rows: Date[], locale: 'fa' | 'en'): TrendPoint[] {
  const formatter = new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
    month: 'short',
    day: 'numeric',
  })
  const buckets = new Map<string, { date: Date; value: number }>()
  for (let index = TREND_DAYS - 1; index >= 0; index--) {
    const date = daysAgo(index)
    date.setHours(0, 0, 0, 0)
    buckets.set(date.toISOString().slice(0, 10), { date, value: 0 })
  }
  for (const row of rows) {
    const key = new Date(row).toISOString().slice(0, 10)
    const bucket = buckets.get(key)
    if (bucket) bucket.value += 1
  }
  return [...buckets.values()].map(({ date, value }) => ({
    label: formatter.format(date),
    value,
  }))
}

function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 100)
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
