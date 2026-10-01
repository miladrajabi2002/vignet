import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bot,
  CalendarCheck2,
  CheckCircle2,
  FlaskConical,
  MessagesSquare,
  Minus,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Package,
  Sparkles,
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { computeOnboarding } from '@/lib/onboarding'
import { DashboardPanel } from '@/components/dashboard/panel'
import {
  DashboardCompletionChecklist,
  type DashboardChecklistFacts,
} from '@/components/dashboard/completion-checklist'
import { LiveFlow, OperatorBotCard, OpsCenter, VigentoCard, type FlowInput, type FlowOutput } from '@/components/dashboard/overview-ops'
import type { ChannelKey } from '@/components/ui/channel-mark'
import { ConversationChart } from '@/components/dashboard/charts/lazy'
import type { TrendPoint } from '@/components/dashboard/charts/conversation-chart'
import { getDashboardNavigationModules, getVerticalPack } from '@/lib/verticals/registry'
import { workspaceCapabilities } from '@/lib/verticals/profile'
import { getCapabilityReadiness } from '@/lib/verticals/readiness'
import { CapabilityStatusPanel } from '@/components/dashboard/capability-status-panel'
import { getMonthlyMessageCount } from '@/lib/billing/entitlements'
import { formatDateTime } from '@/lib/format'
import { dateLocaleTag } from '@/lib/localized-date'
import { ChannelBadge } from '@/components/crm/channel-badge'
import { ContactAvatar } from '@/components/crm/contact-avatar'
import { contactDisplayName, channelHandleFor, channelAvatarFor } from '@/lib/crm/display'
import { contactAvatarSrc } from '@/lib/crm/avatar'
import { cn } from '@/lib/utils'
import { Sparkline } from '@/components/admin/sparkline'
import {
  chargesDailyByWorkspace,
  contactsDailyByWorkspace,
  conversationsDailyByWorkspace,
  resolvedDailyByWorkspace,
} from '@/lib/dashboard/charts'

const TREND_DAYS = 14


const PLAN_NAMES_FA: Record<string, string> = {
  TRIAL: 'آزمایشی',
  STARTER: 'استارتر',
  PRO: 'حرفه‌ای',
  BUSINESS: 'بیزینس',
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
    pendingImprovements,
    activeAgents,
    activeProducts,
    activeChannels,
    upcomingAppointments,
    trendRows,
    recentConversations,
    subscription,
    messagesUsed,
    operatorChannel,
    primaryAgent,
    readyKnowledgeSources,
    activeServices,
    conversationsMiniTrend,
    contactsMiniTrend,
    resolvedMiniTrend,
    chargesMonthlyTrend,
    channelTraffic7d,
    connectedChannelTypes,
    resolved7d,
    handedOff7d,
    orders7d,
    conversationsToday,
    previousContacts7d,
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
        dashboardChecklistDismissedAt: true,
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
    prisma.improvementSuggestion.count({ where: { workspaceId, status: 'PENDING' } }),
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
      take: 4,
      select: {
        id: true,
        channel: true,
        status: true,
        summary: true,
        lastMessageAt: true,
        createdAt: true,
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            telegramUsername: true,
            baleUsername: true,
            rubikaUsername: true,
            whatsappName: true,
            instagramUsername: true,
            telegramAvatarUrl: true,
            baleAvatarUrl: true,
            rubikaAvatarUrl: true,
            whatsappAvatarUrl: true,
            instagramAvatarUrl: true,
          },
        },
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
      select: { active: true, operatorChatId: true, botUsername: true },
    }),
    prisma.agent.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        systemPrompt: true,
        promptConfig: true,
      },
    }),
    prisma.knowledgeBase.count({
      where: {
        workspaceId,
        status: 'READY',
        type: { not: 'PRODUCT_CATALOG' },
      },
    }),
    prisma.service.count({ where: { workspaceId, active: true } }),
    conversationsDailyByWorkspace(workspaceId, 7),
    contactsDailyByWorkspace(workspaceId, 7),
    resolvedDailyByWorkspace(workspaceId, 7),
    chargesDailyByWorkspace(workspaceId, 30),
    prisma.conversation.groupBy({ by: ['channel'], where: { workspaceId, createdAt: { gte: sevenDaysAgo } }, _count: { _all: true } }),
    prisma.agentChannel.groupBy({ by: ['type'], where: { active: true, agent: { workspaceId } } }),
    prisma.conversation.count({ where: { workspaceId, status: 'RESOLVED', createdAt: { gte: sevenDaysAgo } } }),
    prisma.conversation.count({ where: { workspaceId, status: 'HANDED_OFF', createdAt: { gte: sevenDaysAgo } } }),
    prisma.storeOrder.count({ where: { workspaceId, deletedAt: null, createdAt: { gte: sevenDaysAgo } } }),
    prisma.conversation.count({ where: { workspaceId, createdAt: { gte: startOfToday() } } }),
    prisma.contact.count({ where: { workspaceId, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
  ])

  const pack = getVerticalPack(workspace.businessType)
  const capabilities = workspaceCapabilities(workspace)
  const modules = getDashboardNavigationModules(capabilities)
  const readiness = await getCapabilityReadiness(workspaceId, capabilities)
  const businessLabel = fa ? pack.titleFa : pack.titleEn
  const profile = isRecord(workspace.businessProfile) ? workspace.businessProfile : {}
  const profileName = typeof profile.businessName === 'string' ? profile.businessName.trim() : ''
  const displayName = profileName || workspace.name

  const trend = buildTrend(trendRows.map((row) => row.createdAt), lang)
  const resolveRate = totalConversations
    ? Math.round((resolvedConversations / totalConversations) * 100)
    : 0
  const conversationDelta = percentDelta(conversations7d, previousConversations7d)
  const contactDelta = percentDelta(contacts7d, previousContacts7d)
  const deltaHint = fa ? 'نسبت به ۷ روز قبل' : 'vs the previous 7 days'
  const deltaText = (delta: number) => `${nf.format(Math.abs(delta))}${fa ? '٪' : '%'}`
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

  const planEnd = workspace.plan === 'TRIAL' ? workspace.trialEndsAt : subscription?.currentPeriodEnd
  const daysLeft = planEnd
    ? Math.max(0, Math.ceil((planEnd.getTime() - now.getTime()) / 86_400_000))
    : null
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
  const Arrow = fa ? ArrowLeft : ArrowRight
  const hasConfiguredAgent = !!primaryAgent
    && primaryAgent.name.trim().length > 0
    && (primaryAgent.systemPrompt.trim().length > 0 || primaryAgent.promptConfig !== null)
  const checklistFacts: DashboardChecklistFacts = {
    agentId: primaryAgent?.id ?? null,
    hasConfiguredAgent,
    hasKnowledge: readyKnowledgeSources > 0 || activeProducts > 0 || activeServices > 0,
    hasActiveChannel: activeChannels > 0,
    hasConversation: totalConversations > 0,
    hasOperator: !!operatorChannel?.active && !!operatorChannel.operatorChatId,
    knowledgePostponed: onboarding.checks.knowledgeSkipped,
    channelPostponed: onboarding.checks.channelSkipped,
  }
  const checklistCompleted = checklistFacts.hasConfiguredAgent
    && checklistFacts.hasKnowledge
    && checklistFacts.hasActiveChannel
    && checklistFacts.hasConversation

  // Completion is evaluated before rendering, so the checklist disappears
  // without client-side flicker. Persisting the same dismissal timestamp makes
  // that decision permanent for the workspace on every device and session.
  if (checklistCompleted && !workspace.dashboardChecklistDismissedAt) {
    await prisma.workspace.updateMany({
      where: { id: workspaceId, dashboardChecklistDismissedAt: null },
      data: { dashboardChecklistDismissedAt: new Date() },
    })
  }

  // Real 7-day traffic per app, connected apps first, busiest first.
  const trafficByChannel = new Map(channelTraffic7d.map((row) => [row.channel as string, row._count._all]))
  const connectedSet = new Set(connectedChannelTypes.map((row) => row.type as string))
  const FLOW_CHANNELS: ChannelKey[] = ['INSTAGRAM', 'TELEGRAM', 'WEB_WIDGET', 'BALE', 'RUBIKA', 'CHAT_LINK', 'WHATSAPP']
  const flowInputs: FlowInput[] = FLOW_CHANNELS
    .map((channel) => ({ channel, count: trafficByChannel.get(channel) ?? 0, connected: connectedSet.has(channel) || (trafficByChannel.get(channel) ?? 0) > 0 }))
    .filter((input) => input.connected)
    .sort((a, b) => b.count - a.count)
  const isCommerce = workspace.businessType === 'COMMERCE' || workspace.businessType === 'FOOD'
  const flowOutputs: FlowOutput[] = [
    { key: 'resolved', label: fa ? 'حل خودکار' : 'Auto-resolved', value: resolved7d, href: '/conversations?status=RESOLVED', icon: CheckCircle2, tone: 'ok' },
    { key: 'handoff', label: fa ? 'سپرده به اپراتور' : 'Handed to a person', value: handedOff7d, href: '/conversations?status=HANDED_OFF', icon: AlertCircle, tone: 'warn' },
    { key: 'contacts', label: fa ? 'مشتری تازه در CRM' : 'New CRM customers', value: contacts7d, href: '/contacts', icon: UserPlus, tone: 'signal' },
    hasBookingModule
      ? { key: 'bookings', label: fa ? 'نوبت پیش رو' : 'Upcoming bookings', value: upcomingAppointments, href: '/appointments', icon: CalendarCheck2, tone: 'ink' }
      : isCommerce
        ? { key: 'orders', label: fa ? 'سفارش فروشگاه' : 'Store orders', value: orders7d, href: '/products/orders', icon: Package, tone: 'ink' }
        : { key: 'open', label: fa ? 'گفتگوی باز' : 'Open chats', value: openConversations, href: '/conversations?status=OPEN', icon: MessagesSquare, tone: 'ink' },
  ]
  const vigentoAnswer = fa
    ? `امروز ${nf.format(conversationsToday)} گفتگوی تازه داشتید؛ ${handedOff > 0 ? `${nf.format(handedOff)} گفتگو منتظر شماست` : 'هیچ گفتگویی منتظر شما نیست'}${pendingImprovements > 0 ? ` و ${nf.format(pendingImprovements)} پیشنهاد بهبود آمادهٔ تأیید است` : ''}.`
    : `${nf.format(conversationsToday)} new conversations today; ${handedOff > 0 ? `${nf.format(handedOff)} are waiting for you` : 'nothing is waiting for you'}${pendingImprovements > 0 ? `, and ${nf.format(pendingImprovements)} improvements are ready to approve` : ''}.`

  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
      {!workspace.dashboardChecklistDismissedAt && !checklistCompleted && (
        <DashboardCompletionChecklist
          locale={lang}
          facts={checklistFacts}
        />
      )}

      <OpsCenter
        locale={lang}
        ownerName={user.name}
        businessName={displayName}
        businessLabel={businessLabel}
        connectedApps={activeChannels}
        attention={[
          {
            key: 'handoff',
            href: '/conversations?status=HANDED_OFF',
            icon: AlertCircle,
            value: handedOff,
            label: fa ? 'منتظر اپراتور' : 'Awaiting you',
            hint: fa ? 'با خلاصهٔ آماده' : 'summary ready',
            urgent: handedOff > 0,
          },
          {
            key: 'improve',
            href: primaryAgent ? `/agents/${primaryAgent.id}/improve` : '/agents',
            icon: Sparkles,
            value: pendingImprovements,
            label: fa ? 'پیشنهاد بهبود' : 'Improvements',
            hint: fa ? 'آمادهٔ تأیید شما' : 'ready to approve',
            urgent: pendingImprovements > 0,
          },
          hasBookingModule
            ? { key: 'bookings', href: '/appointments', icon: CalendarCheck2, value: upcomingAppointments, label: fa ? 'نوبت پیش رو' : 'Upcoming', hint: fa ? 'تأییدشده و در انتظار' : 'confirmed and pending', urgent: false }
            : { key: 'open', href: '/conversations?status=OPEN', icon: MessagesSquare, value: openConversations, label: fa ? 'گفتگوی باز' : 'Open chats', hint: fa ? 'ایجنت در حال پیگیری' : 'the agent is on it', urgent: false },
        ]}
        primaryAction={{ href: '/conversations', label: fa ? 'رسیدگی به گفتگوها' : 'Open conversations', icon: MessagesSquare }}
        secondaryAction={hasBookingModule
          ? { href: '/appointments', label: fa ? 'مدیریت نوبت‌ها' : 'Manage appointments', icon: CalendarCheck2 }
          : primaryAgent
            ? { href: `/agents/${primaryAgent.id}`, label: fa ? 'تست ایجنت' : 'Test the agent', icon: FlaskConical }
            : { href: '/agents/new', label: fa ? 'ساخت اولین ایجنت' : 'Create your first agent', icon: Sparkles }}
        flow={
          <LiveFlow
            locale={lang}
            agentName={primaryAgent?.name?.trim() || (fa ? 'ایجنت' : 'Agent')}
            automationRate={conversations7d > 0 ? Math.round((resolved7d / conversations7d) * 100) : null}
            inputs={flowInputs}
            outputs={flowOutputs}
          />
        }
      />

      <VigentoCard locale={lang} liveAnswer={vigentoAnswer} />

      <OperatorBotCard
        locale={lang}
        connected={Boolean(operatorChannel?.operatorChatId)}
        paused={operatorChannel ? !operatorChannel.active : false}
        botUsername={operatorChannel?.botUsername}
      />

      <section aria-label={fa ? 'شاخص‌های اصلی' : 'Key outcomes'} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <OutcomeCard
          href="/conversations"
          label={fa ? 'گفتگو در ۷ روز' : 'Conversations, 7d'}
          value={nf.format(conversations7d)}
          delta={conversationDelta === null ? undefined : { value: conversationDelta, text: deltaText(conversationDelta) }}
          hint={conversationDelta === null ? (fa ? 'شروع دوره اندازه‌گیری' : 'measurement started') : deltaHint}
          series={conversationsMiniTrend.series}
        />
        <OutcomeCard
          href="/analytics"
          label={fa ? 'نرخ حل گفتگو' : 'Resolution rate'}
          value={`${nf.format(resolveRate)}${fa ? '٪' : '%'}`}
          hint={fa ? 'نتیجه ثبت‌شده در CRM' : 'recorded outcomes in CRM'}
          series={resolvedMiniTrend.series}
        />
        <OutcomeCard
          href="/contacts"
          label={fa ? 'مشتری جدید در ۷ روز' : 'New customers, 7d'}
          value={nf.format(contacts7d)}
          delta={contactDelta === null ? undefined : { value: contactDelta, text: deltaText(contactDelta) }}
          hint={contactDelta === null ? (fa ? 'از همه برنامه‌های متصل' : 'from every connected channel') : deltaHint}
          series={contactsMiniTrend.series}
        />
        <OutcomeCard
          href={verticalOutcome.href}
          label={verticalOutcome.label}
          value={nf.format(verticalOutcome.value)}
          hint={verticalOutcome.hint}
        />
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <DashboardPanel
          title={fa ? 'روند گفتگوهای ۱۴ روز اخیر' : 'Conversation trend, last 14 days'}
          subtitle={fa ? 'یک روند اصلی؛ جزئیات کامل در بخش گزارش‌ها' : 'One primary trend; deeper analysis stays in Analytics'}
          action={<Link href="/analytics" className="ui-link">{fa ? 'گزارش کامل' : 'Full report'}<Arrow aria-hidden /></Link>}
        >
          <ConversationChart data={trend} />
        </DashboardPanel>

        <DashboardPanel
          title={fa ? 'آخرین پرونده‌ها' : 'Recent customer cases'}
          subtitle={fa ? 'آخرین گفتگوها، بدون بازکردن چند صفحه' : 'The latest conversations at a glance'}
          action={<Link href="/conversations" className="ui-link">{fa ? 'همه گفتگوها' : 'All conversations'}<Arrow aria-hidden /></Link>}
          bodyClassName="divide-y divide-[var(--border-subtle)]"
        >
          {recentConversations.length ? recentConversations.map((conversation) => {
            const timestamp = conversation.lastMessageAt ?? conversation.createdAt
            const channelHandle = channelHandleFor({
              channel: conversation.channel,
              telegramUsername: conversation.contact?.telegramUsername,
              baleUsername: conversation.contact?.baleUsername,
              rubikaUsername: conversation.contact?.rubikaUsername,
              whatsappName: conversation.contact?.whatsappName,
              instagramUsername: conversation.contact?.instagramUsername,
            })
            const channelAvatar = channelAvatarFor({
              channel: conversation.channel,
              telegramAvatarUrl: conversation.contact?.telegramAvatarUrl,
              baleAvatarUrl: conversation.contact?.baleAvatarUrl,
              rubikaAvatarUrl: conversation.contact?.rubikaAvatarUrl,
              whatsappAvatarUrl: conversation.contact?.whatsappAvatarUrl,
              instagramAvatarUrl: conversation.contact?.instagramAvatarUrl,
            })
            const channelAvatarSrc = contactAvatarSrc({
              contactId: conversation.contact?.id,
              channel: conversation.channel,
              rawUrl: channelAvatar,
            })
            const channelId = conversation.contact ? (conversation.channel as string) : null
            const who = contactDisplayName({
              name: conversation.contact?.name,
              phone: conversation.contact?.phone,
              handle: channelHandle,
              channel: conversation.channel,
              channelId,
              anonymousLabel: fa ? 'مشتری بدون نام' : 'Unnamed customer',
            })
            return (
              <Link
                key={conversation.id}
                href={`/conversations/${conversation.id}`}
                className={cn(
                  'group grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden px-3 py-2.5 transition-colors hover:bg-[var(--bg-hover)]',
                  conversation.status === 'HANDED_OFF' && 'bg-amber-500/5',
                )}
              >
                <ContactAvatar src={channelAvatarSrc} alt={who} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span dir={fa ? 'rtl' : 'ltr'} className="min-w-0 truncate text-xs font-semibold text-[var(--text-primary)]">{who}</span>
                    <span className="shrink-0 text-[12px] text-[var(--text-muted)]">{formatDateTime(timestamp, lang)}</span>
                  </span>
                  <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
                    <ChannelBadge type={conversation.channel} />
                    <span>·</span>
                    <span className="tabular-nums">{nf.format(conversation._count.messages)} {fa ? 'پیام' : 'messages'}</span>
                    {(conversation.summary || conversation.agent.name) && (
                      <>
                        <span>·</span>
                        <span dir={fa ? 'rtl' : 'ltr'} className="min-w-0 truncate">{conversation.summary || conversation.agent.name}</span>
                      </>
                    )}
                  </span>
                </span>
                <Arrow className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            )
          }) : (
            <EmptyState text={fa ? 'هنوز گفتگویی ثبت نشده است.' : 'No conversations yet.'} />
          )}
        </DashboardPanel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.72fr]">
        <CapabilityStatusPanel capabilities={capabilities} readiness={readiness} fa={fa} />

        <DashboardPanel
          title={fa ? 'پلن و اعتبار' : 'Plan & credit'}
          subtitle={fa ? 'خلاصه کوتاه؛ جزئیات در بخش مالی' : 'A compact summary; details stay in Billing'}
          action={<Link href="/billing" className="ui-link">{fa ? 'مدیریت' : 'Manage'}<Arrow aria-hidden /></Link>}
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[12px] text-[var(--text-muted)]">{fa ? 'اعتبار پاسخ' : 'Reply credit'}</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-[var(--text-primary)]">
                {nf.format(Math.round(workspace.aiCreditBalanceIRR / 10))} <span className="text-xs font-normal text-[var(--text-muted)]">{fa ? 'تومان' : 'toman'}</span>
              </p>
            </div>
            <div className="text-end">
              <p className="text-[12px] text-[var(--text-muted)]">{fa ? 'پلن فعلی' : 'Current plan'}</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                {fa ? PLAN_NAMES_FA[workspace.plan] : workspace.plan.toLowerCase()}
              </p>
              {daysLeft !== null && <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{fa ? `${nf.format(daysLeft)} روز باقی` : `${nf.format(daysLeft)} days left`}</p>}
            </div>
          </div>
          <div className="spatial-inset mt-4 flex items-center justify-between gap-3 rounded-xl px-3 py-2.5">
            <div>
              <p className="text-[12px] text-[var(--text-muted)]">{fa ? 'پاسخ موفق این ماه' : 'Successful replies this month'}</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--text-primary)]">{nf.format(messagesUsed)}</p>
            </div>
            <p className="max-w-40 text-end text-[12px] leading-5 text-[var(--text-muted)]">{fa ? 'بدون سقف پیام؛ مصرف از اعتبار پاسخ کم می‌شود.' : 'No message cap; usage is deducted from reply credit.'}</p>
          </div>
          <div className="spatial-inset mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-[var(--text-muted)]">{fa ? 'هزینه پاسخ‌های AI در ۳۰ روز' : 'AI reply cost, 30 days'}</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--text-primary)]">
                {nf.format(Math.round(chargesMonthlyTrend.total / 10))} <span className="text-[12px] font-normal text-[var(--text-muted)]">{fa ? 'تومان' : 'toman'}</span>
              </p>
            </div>
            <div className="w-24 shrink-0"><Sparkline data={chargesMonthlyTrend.series} color="#111111" width={96} height={28} fluid /></div>
          </div>
        </DashboardPanel>
      </section>
    </div>
  )
}

function OutcomeCard({
  href,
  label,
  value,
  delta,
  hint,
  series,
}: {
  href: string
  label: string
  value: string
  /** Change against the previous period; the sign picks the arrow and tone. */
  delta?: { value: number; text: string }
  hint: string
  series?: number[]
}) {
  const DeltaIcon = !delta || delta.value === 0 ? Minus : delta.value > 0 ? TrendingUp : TrendingDown
  return (
    <Link href={href} className="dashboard-card group rounded-card border border-[var(--border-subtle)] bg-white p-4 transition-[border-color] hover:border-[var(--border-strong)] sm:p-5">
      <span className="block text-[12.5px] font-medium leading-5 text-[var(--text-secondary)]">{label}</span>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-2xl font-bold tabular-nums tracking-tight text-[var(--text-primary)] sm:text-3xl">{value}</span>
        {delta && (
          <span dir="ltr" className={cn('ui-chip tabular-nums', delta.value > 0 ? 'ui-chip-ok' : delta.value < 0 ? 'ui-chip-danger' : 'ui-chip-neutral')}>
            <DeltaIcon aria-hidden className="h-3 w-3" strokeWidth={2.2} />
            {delta.text}
          </span>
        )}
      </p>
      <p className="mt-1 min-h-4 text-[12px] leading-5 text-[var(--text-muted)]">{hint}</p>
      {series?.length ? <div className="mt-2 h-7"><Sparkline data={series} color="#111111" height={28} fluid /></div> : null}
    </Link>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="py-10 text-center text-xs text-[var(--text-muted)]">{text}</div>
}

function buildTrend(rows: Date[], locale: 'fa' | 'en'): TrendPoint[] {
  const formatter = new Intl.DateTimeFormat(dateLocaleTag(locale), {
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

function startOfToday(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
