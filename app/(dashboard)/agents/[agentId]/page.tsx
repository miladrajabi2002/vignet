import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Cable,
  CheckCircle2,
  Circle,
  Code2,
  Database,
  CalendarDays,
  Globe2,
  Link2,
  MessageCircle,
  Package,
  Radio,
  Send,
  Share2,
  Store,
  SlidersHorizontal,
  TrendingUp,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { TestPlayground } from '@/components/agent-builder/test-playground'
import { cn } from '@/lib/utils'
import { getDashboardModules } from '@/lib/verticals/registry'
import { readBusinessProfile } from '@/lib/verticals/profile'
import { relativeTime } from '@/lib/format'
import { summarizeAgentReadiness } from '@/lib/agents/readiness'

interface SetupStep {
  key: string
  done: boolean
  priority: number
  icon: LucideIcon
  title: string
  desc: string
  href: string
  cta: string
}

interface ConnectionSummary {
  key: string
  icon: LucideIcon
  label: string
  detail: string
  active: boolean
  href: string
}

interface GrowthAction {
  key: string
  icon: LucideIcon
  title: string
  desc: string
  href: string
  cta: string
  badge?: string
  attention?: boolean
}

const CHANNEL_META: Record<string, { fa: string; en: string; icon: LucideIcon }> = {
  TELEGRAM: { fa: 'تلگرام', en: 'Telegram', icon: Send },
  WHATSAPP: { fa: 'واتساپ', en: 'WhatsApp', icon: MessageCircle },
  INSTAGRAM: { fa: 'اینستاگرام', en: 'Instagram', icon: MessageCircle },
  RUBIKA: { fa: 'روبیکا', en: 'Rubika', icon: Radio },
  BALE: { fa: 'بله', en: 'Bale', icon: Send },
  WEB_WIDGET: { fa: 'ویجت وب', en: 'Web widget', icon: Globe2 },
  CHAT_LINK: { fa: 'لینک گفتگو', en: 'Chat link', icon: Link2 },
  API: { fa: 'اتصال API', en: 'API connection', icon: Code2 },
}

const STORE_LABELS: Record<string, { fa: string; en: string }> = {
  WOOCOMMERCE: { fa: 'فروشگاه ووکامرس', en: 'WooCommerce store' },
  CUSTOM_URL: { fa: 'فروشگاه اختصاصی', en: 'Custom store' },
  SHOPIFY: { fa: 'فروشگاه شاپیفای', en: 'Shopify store' },
}

export default async function AgentDetailPage(
  props: {
    params: Promise<{ agentId: string }>
  }
) {
  const params = await props.params;
  const user = await requireUser()
  const t = await getTranslations('agents')
  const fa = (await getLocale()) !== 'en'

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: {
      id: true,
      name: true,
      systemPrompt: true,
      promptConfig: true,
      welcomeMessage: true,
    },
  })
  if (!agent) notFound()

  const [
    workspace,
    storeIntegrations,
    productCount,
    serviceCount,
    kbCount,
    channels,
    conversationCount,
    unansweredCount,
  ] =
    await Promise.all([
      prisma.workspace.findUnique({
        where: { id: user.workspaceId },
        select: { businessType: true, businessProfile: true },
      }),
      prisma.storeIntegration.findMany({
        where: { workspaceId: user.workspaceId },
        select: {
          id: true,
          type: true,
          storeUrl: true,
          active: true,
          lastSyncAt: true,
          lastSyncStatus: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({
        where: { workspaceId: user.workspaceId, active: true },
      }),
      prisma.service.count({ where: { workspaceId: user.workspaceId, active: true } }),
      prisma.knowledgeBase.count({
        where: {
          agentId: agent.id,
          type: { not: 'PRODUCT_CATALOG' },
          status: 'READY',
        },
      }),
      prisma.agentChannel.findMany({
        where: { agentId: agent.id },
        select: {
          id: true,
          type: true,
          active: true,
          lastInboundAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.conversation.count({
        where: { agentId: agent.id, workspaceId: user.workspaceId },
      }),
      prisma.message.count({
        where: {
          role: 'ASSISTANT',
          unanswered: true,
          conversation: { agentId: agent.id, workspaceId: user.workspaceId },
        },
      }),
    ])

  const profile = readBusinessProfile(workspace?.businessProfile)
  const modules = getDashboardModules(workspace?.businessType, profile?.services)
  const hasProducts = modules.includes('products')
  const hasAppointments = modules.includes('appointments')
  const hasServices = modules.includes('services')
  const activeChannels = channels.filter((channel) => channel.active)
  const activeStores = storeIntegrations.filter((integration) => integration.active)
  const businessItemCount =
    (hasProducts ? productCount : 0) +
    (hasServices || hasAppointments ? serviceCount : 0)

  const hasConfiguredBehavior =
    agent.systemPrompt.trim().length > 0 || agent.promptConfig !== null

  const steps: SetupStep[] = [
    {
      key: 'settings',
      done: agent.name.trim().length > 0 && hasConfiguredBehavior,
      priority: 0,
      icon: SlidersHorizontal,
      title: fa ? 'هویت و رفتار ایجنت' : 'Agent identity and behavior',
      desc: fa ? 'هویت، مدل و قواعد پاسخ‌گویی را بازبینی کنید تا رفتار ایجنت هماهنگ بماند.' : 'Review identity, model and response rules to keep the agent consistent.',
      href: `/agents/${agent.id}/settings`,
      cta: fa ? 'بازبینی' : 'Review',
    },
    ...(hasServices && !hasAppointments ? [{
      key: 'services', done: serviceCount > 0, priority: 15, icon: CalendarDays,
      title: fa ? 'کاتالوگ خدمات' : 'Service catalog',
      desc: fa ? 'خدمات واقعی را ثبت کنید تا ایجنت فقط از اطلاعات تأییدشده استفاده کند.' : 'Register real services so the agent uses verified information.',
      href: '/services', cta: fa ? 'افزودن خدمت' : 'Add service',
    }] : []),
    ...(hasProducts ? [{
      key: 'products',
      done: productCount > 0,
      priority: 20,
      icon: Package,
      title: t('setup.productsTitle'),
      desc: t('setup.productsDesc'),
      href: '/products',
      cta: t('setup.productsCta'),
    }] : []),
    ...(hasAppointments ? [{
      key: 'appointments',
      done: serviceCount > 0,
      priority: 15,
      icon: CalendarDays,
      title: fa ? 'خدمات قابل رزرو' : 'Bookable services',
      desc: fa ? 'خدمت، ظرفیت و ساعات کاری را تعریف کنید تا ایجنت رزرو ثبت کند.' : 'Define services, capacity and hours so the agent can book appointments.',
      href: '/appointments',
      cta: fa ? 'تعریف خدمات' : 'Add services',
    }] : []),
    {
      key: 'knowledge',
      done: kbCount > 0,
      priority: 30,
      icon: Database,
      title: t('setup.knowledgeTitle'),
      desc: t('setup.knowledgeDesc'),
      href: `/agents/${agent.id}/knowledge`,
      cta: t('setup.knowledgeCta'),
    },
    {
      key: 'channel',
      done: activeChannels.length > 0,
      priority: 40,
      icon: Share2,
      title: t('setup.channelTitle'),
      desc: t('setup.channelDesc'),
      href: `/agents/${agent.id}/channels`,
      cta: t('setup.channelCta'),
    },
  ]

  const readiness = summarizeAgentReadiness([
    ...steps.map((step) => ({ key: step.key, done: step.done, required: true })),
    ...(hasProducts
      ? [{ key: 'wordpress', done: activeStores.length > 0, required: false }]
      : []),
  ])
  const nextStep = steps
    .filter((step) => !step.done)
    .sort((a, b) => a.priority - b.priority)[0]

  const connectionSummaries: ConnectionSummary[] = [
    ...channels.map((channel) => {
      const meta = CHANNEL_META[channel.type] ?? {
        fa: channel.type,
        en: channel.type,
        icon: Cable,
      }
      const activity = channel.lastInboundAt
        ? (fa
            ? `آخرین پیام ${relativeTime(channel.lastInboundAt, 'fa')}`
            : `Last message ${relativeTime(channel.lastInboundAt, 'en')}`)
        : (fa ? 'در انتظار اولین پیام ورودی' : 'Waiting for the first inbound message')

      return {
        key: `channel-${channel.id}`,
        icon: meta.icon,
        label: fa ? meta.fa : meta.en,
        detail: channel.active
          ? activity
          : (fa ? 'اتصال غیرفعال است' : 'Connection is inactive'),
        active: channel.active,
        href: `/agents/${agent.id}/channels`,
      }
    }),
    ...storeIntegrations.map((integration) => {
      const label = STORE_LABELS[integration.type] ?? {
        fa: integration.type,
        en: integration.type,
      }
      const syncHealthy = integration.lastSyncStatus !== 'error'
      const syncDetail = integration.lastSyncStatus === 'error'
        ? (fa ? 'آخرین همگام‌سازی ناموفق بود' : 'The last sync failed')
        : integration.lastSyncAt
          ? (fa
              ? `همگام‌سازی ${relativeTime(integration.lastSyncAt, 'fa')}`
              : `Synced ${relativeTime(integration.lastSyncAt, 'en')}`)
          : (fa ? 'هنوز همگام‌سازی نشده' : 'Not synced yet')

      return {
        key: `store-${integration.id}`,
        icon: Store,
        label: `${fa ? label.fa : label.en} · ${safeHostname(integration.storeUrl)}`,
        detail: integration.active
          ? syncDetail
          : (fa ? 'اتصال فروشگاه غیرفعال است' : 'Store connection is inactive'),
        active: integration.active && syncHealthy,
        href: '/integrations',
      }
    }),
  ]

  const growthActions: GrowthAction[] = []
  const storeSyncFailed = activeStores.some(
    (integration) => integration.lastSyncStatus === 'error',
  )

  if (unansweredCount > 0) {
    growthActions.push({
      key: 'learning',
      icon: BookOpenCheck,
      title: fa ? 'تکمیل پاسخ‌های یادگرفته‌نشده' : 'Review unanswered questions',
      desc: fa
        ? `${unansweredCount.toLocaleString('fa-IR')} سؤال منتظر بررسی شماست؛ تأییدشان مستقیماً دقت ایجنت را بهتر می‌کند.`
        : `${unansweredCount.toLocaleString('en-US')} questions await review; approving them directly improves accuracy.`,
      href: `/agents/${agent.id}/learning`,
      cta: fa ? 'بررسی یادگیری' : 'Review learning',
      badge: fa ? 'اثر بالا' : 'High impact',
      attention: true,
    })
  }

  if (storeSyncFailed) {
    growthActions.push({
      key: 'store-sync',
      icon: TriangleAlert,
      title: fa ? 'رفع خطای همگام‌سازی فروشگاه' : 'Fix store synchronization',
      desc: fa
        ? 'آخرین همگام‌سازی موفق نبوده است؛ اتصال را بررسی کنید تا قیمت و موجودی قدیمی نماند.'
        : 'The latest sync failed. Review the connection so prices and stock stay current.',
      href: '/integrations',
      cta: fa ? 'بررسی اتصال' : 'Review connection',
      badge: fa ? 'نیازمند توجه' : 'Needs attention',
      attention: true,
    })
  } else if (hasProducts && activeStores.length === 0) {
    growthActions.push({
      key: 'store-opportunity',
      icon: Store,
      title: fa ? 'همگام‌سازی خودکار فروشگاه' : 'Automate store synchronization',
      desc: fa
        ? 'اگر سایت وردپرسی دارید، اتصال آن قیمت، موجودی و سفارش‌ها را خودکار به‌روز نگه می‌دارد.'
        : 'If you use WordPress, connecting it keeps prices, stock and orders updated automatically.',
      href: '/integrations',
      cta: fa ? 'دیدن جزئیات' : 'View details',
      badge: fa ? 'فرصت اختیاری' : 'Optional opportunity',
    })
  }

  if (activeChannels.length < 2) {
    growthActions.push({
      key: 'channel-growth',
      icon: Share2,
      title: fa ? 'گسترش دسترسی به یک کانال دیگر' : 'Add another customer channel',
      desc: fa
        ? 'یک کانال مکمل اضافه کنید تا مشتریان از مسیرهای بیشتری به ایجنت برسند.'
        : 'Add a complementary channel so more customers can reach the agent.',
      href: `/agents/${agent.id}/channels`,
      cta: fa ? 'مدیریت کانال‌ها' : 'Manage channels',
      badge: fa ? 'پیشنهاد رشد' : 'Growth idea',
    })
  }

  if (kbCount < 3) {
    growthActions.push({
      key: 'knowledge-growth',
      icon: Database,
      title: fa ? 'گسترش پوشش دانش ایجنت' : 'Expand knowledge coverage',
      desc: fa
        ? 'FAQ، قوانین ارسال یا راهنمای خدمات را اضافه کنید تا پاسخ‌های خاص‌تر و دقیق‌تری بگیرید.'
        : 'Add FAQs, delivery policies or service guides for more precise answers.',
      href: `/agents/${agent.id}/knowledge`,
      cta: fa ? 'افزودن دانش' : 'Add knowledge',
      badge: fa ? 'بهبود دقت' : 'Improve accuracy',
    })
  }

  growthActions.push({
    key: 'analytics',
    icon: BarChart3,
    title: fa ? 'بررسی عملکرد واقعی ایجنت' : 'Review real agent performance',
    desc: conversationCount > 0
      ? (fa
          ? `عملکرد ${conversationCount.toLocaleString('fa-IR')} گفتگو را بررسی کنید و نقاط قابل بهبود را پیدا کنید.`
          : `Review ${conversationCount.toLocaleString('en-US')} conversations and find improvement opportunities.`)
      : (fa
          ? 'بعد از شروع گفتگوها، روند استفاده و کیفیت عملکرد را از این بخش دنبال کنید.'
          : 'Once conversations begin, track usage and quality from analytics.'),
    href: `/agents/${agent.id}/analytics`,
    cta: fa ? 'مشاهده تحلیل' : 'View analytics',
    badge: fa ? 'پایش مستمر' : 'Ongoing review',
  })

  const suggestedPrompts = [
    hasProducts
      ? (fa ? 'چه محصولاتی دارید و قیمتشان چقدر است؟' : 'What products do you offer and how much are they?')
      : hasAppointments
        ? (fa ? 'برای رزرو وقت چه زمان‌هایی آزاد دارید؟' : 'What times are available for an appointment?')
        : hasServices
          ? (fa ? 'چه خدماتی ارائه می‌دهید؟' : 'What services do you offer?')
          : (fa ? 'درباره کسب‌وکارتان بیشتر توضیح بدهید.' : 'Tell me more about your business.'),
    fa ? 'اگر جواب را ندانستی چه کار می‌کنی؟' : 'What do you do when you do not know the answer?',
    fa ? 'می‌خواهم با یک اپراتور صحبت کنم.' : 'I would like to speak with a human agent.',
  ]

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      {/* ── LEFT: Test playground ─────────────────────────────────────── */}
      <section className="spatial-surface flex flex-col overflow-hidden rounded-[1.5rem]">
        {/* Header strip */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
              {fa ? 'آزمایش فوری پاسخ' : 'Instant response test'}
            </p>
            <h2 className="mt-0.5 text-base font-bold text-[var(--text-primary)]">
              {t('test')}
            </h2>
            <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
              {fa ? 'تجربه واقعی مشتری را بدون خروج از صفحه بررسی کنید.' : 'Check the real customer experience without leaving.'}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-bold text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {fa ? 'در دسترس' : 'Live'}
          </span>
        </div>
        {/* Playground */}
        <div className="flex-1 p-4 sm:p-5">
          <TestPlayground
            agentId={agent.id}
            welcomeMessage={agent.welcomeMessage}
            suggestedPrompts={suggestedPrompts}
          />
        </div>
      </section>

      {readiness.complete ? (
        <AgentGrowthPanel
          fa={fa}
          activeChannelCount={activeChannels.length}
          totalChannelCount={channels.length}
          knowledgeCount={kbCount}
          businessItemCount={
            hasProducts || hasServices || hasAppointments
              ? businessItemCount
              : growthActions.length
          }
          businessItemLabel={
            hasProducts && (hasServices || hasAppointments)
              ? (fa ? 'محصول و خدمت' : 'Products & services')
              : hasProducts
                ? (fa ? 'محصول فعال' : 'Active products')
                : hasServices || hasAppointments
                  ? (fa ? 'خدمت فعال' : 'Active services')
                  : (fa ? 'فرصت رشد' : 'Growth opportunities')
          }
          businessItemIcon={
            hasProducts
              ? Package
              : hasServices || hasAppointments
                ? CalendarDays
                : TrendingUp
          }
          conversationCount={conversationCount}
          connections={connectionSummaries}
          actions={growthActions}
          channelsHref={`/agents/${agent.id}/channels`}
        />
      ) : (
        <AgentSetupPanel
          fa={fa}
          steps={steps}
          nextStep={nextStep}
          readiness={readiness}
        />
      )}
    </div>
  )
}

function AgentSetupPanel({
  fa,
  steps,
  nextStep,
  readiness,
}: {
  fa: boolean
  steps: SetupStep[]
  nextStep?: SetupStep
  readiness: ReturnType<typeof summarizeAgentReadiness>
}) {
  const remainingCount = readiness.totalCount - readiness.doneCount

  return (
    <section className="spatial-surface overflow-hidden rounded-[1.5rem]">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-black p-5 text-white sm:p-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/45">
            {fa ? 'چک‌لیست پیشنهادی' : 'Recommended checklist'}
          </p>
          <h2 className="mt-0.5 text-base font-bold">
            {fa ? 'آماده‌سازی و رشد ایجنت' : 'Agent readiness and growth'}
          </h2>
          <p className="mt-0.5 text-xs text-white/55">
            {nextStep
              ? (fa
                  ? `قدم پیشنهادی بعدی: ${nextStep.title}`
                  : `Suggested next step: ${nextStep.title}`)
              : (fa ? 'راه‌اندازی ضروری تکمیل شده است.' : 'Required setup is complete.')}
          </p>
        </div>
        <div
          className="min-w-36 rounded-2xl bg-white/10 p-3 ring-1 ring-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={readiness.progress}
          aria-label={fa ? 'میزان آمادگی ایجنت' : 'Agent readiness'}
        >
          <div className="flex items-center justify-between text-[11px] text-white/60">
            <span>{fa ? `${remainingCount} گام باقی مانده` : `${remainingCount} steps left`}</span>
            <span className="font-bold tabular-nums text-white">{readiness.progress}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${readiness.progress}%` }}
            />
          </div>
        </div>
      </div>

      <ol className="space-y-2 p-4 sm:p-5">
        {steps.map((step) => {
          const Icon = step.icon
          return (
            <li
              key={step.key}
              className={cn(
                'flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors',
                step.done
                  ? 'border-success/15 bg-success/[0.04]'
                  : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]',
              )}
            >
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />
              )}
              <Icon className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-semibold', step.done ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]')}>
                  {step.title}
                </p>
                {!step.done && (
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    {step.desc}
                  </p>
                )}
              </div>
              {!step.done && (
                <Link
                  href={step.href}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl bg-[var(--text-primary)] px-3 text-xs font-bold text-[var(--bg-base)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-2"
                >
                  {step.cta}
                  <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function AgentGrowthPanel({
  fa,
  activeChannelCount,
  totalChannelCount,
  knowledgeCount,
  businessItemCount,
  businessItemLabel,
  businessItemIcon,
  conversationCount,
  connections,
  actions,
  channelsHref,
}: {
  fa: boolean
  activeChannelCount: number
  totalChannelCount: number
  knowledgeCount: number
  businessItemCount: number
  businessItemLabel: string
  businessItemIcon: LucideIcon
  conversationCount: number
  connections: ConnectionSummary[]
  actions: GrowthAction[]
  channelsHref: string
}) {
  const locale = fa ? 'fa-IR' : 'en-US'
  const metrics = [
    {
      key: 'channels',
      icon: Cable,
      value: activeChannelCount,
      label: fa ? 'کانال فعال' : 'Active channels',
      hint: fa
        ? `از ${totalChannelCount.toLocaleString(locale)} اتصال ثبت‌شده`
        : `of ${totalChannelCount.toLocaleString(locale)} configured`,
    },
    {
      key: 'knowledge',
      icon: Database,
      value: knowledgeCount,
      label: fa ? 'منبع دانش آماده' : 'Ready knowledge sources',
      hint: fa ? 'قابل استفاده در پاسخ‌ها' : 'Available to responses',
    },
    {
      key: 'catalog',
      icon: businessItemIcon,
      value: businessItemCount,
      label: businessItemLabel,
      hint: fa ? 'اطلاعات فعال کسب‌وکار' : 'Active business information',
    },
    {
      key: 'conversations',
      icon: Activity,
      value: conversationCount,
      label: fa ? 'گفتگوی ثبت‌شده' : 'Recorded conversations',
      hint: fa ? 'برای تحلیل عملکرد' : 'Available for analysis',
    },
  ]

  return (
    <section className="spatial-surface overflow-hidden rounded-[1.5rem]">
      <div className="relative isolate overflow-hidden bg-black p-5 text-white sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -end-16 -top-24 h-52 w-52 rounded-full bg-white/[0.09] blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 start-1/4 h-40 w-40 rounded-full bg-success/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-md">
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/45">
              {fa ? 'مرکز رشد ایجنت' : 'Agent growth center'}
            </p>
            <h2 className="mt-0.5 text-base font-bold">
              {fa ? 'وضعیت، اتصال‌ها و فرصت‌های رشد' : 'Status, connections and growth'}
            </h2>
            <p className="mt-1 text-xs leading-5 text-white/60">
              {fa
                ? 'راه‌اندازی ضروری کامل شده؛ از اینجا سلامت اتصال‌ها و بهترین فرصت‌های بهبود را دنبال کنید.'
                : 'Required setup is complete. Track connection health and the best improvement opportunities here.'}
            </p>
          </div>
          <span className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white/10 px-3.5 text-xs font-bold text-white ring-1 ring-white/10">
            <CheckCircle2 className="h-4 w-4 text-success" />
            {fa ? 'ایجنت آماده است' : 'Agent is ready'}
          </span>
        </div>
      </div>

      <div className="space-y-6 p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-2.5">
          {metrics.map((metric) => {
            const Icon = metric.icon
            return (
              <div key={metric.key} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-muted)] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-bold tabular-nums text-[var(--text-primary)]">
                      {metric.value.toLocaleString(locale)}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                      {metric.label}
                    </p>
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] text-[var(--text-muted)]">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-2 text-[10px] text-[var(--text-muted)]">{metric.hint}</p>
              </div>
            )
          })}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                {fa ? 'اتصال‌های فعلی' : 'Current connections'}
              </h3>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                {fa ? 'وضعیت و آخرین فعالیت هر اتصال' : 'Status and latest activity for every connection'}
              </p>
            </div>
            <Link
              href={channelsHref}
              className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              {fa ? 'مدیریت' : 'Manage'}
              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
            </Link>
          </div>
          <div className="space-y-2">
            {connections.map((connection) => {
              const Icon = connection.icon
              return (
                <Link
                  key={connection.key}
                  href={connection.href}
                  className="group flex min-h-16 items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-3.5 py-2.5 transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] text-[var(--text-muted)]">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-[var(--text-primary)]">
                      {connection.label}
                    </span>
                    <span className="mt-1 block truncate text-[10px] text-[var(--text-muted)]">
                      {connection.detail}
                    </span>
                  </span>
                  <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-[10px] font-semibold', connection.active ? 'text-success' : 'text-danger')}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', connection.active ? 'bg-success' : 'bg-danger')} />
                    {connection.active ? (fa ? 'فعال' : 'Active') : (fa ? 'نیاز به بررسی' : 'Review')}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-black text-white">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                {fa ? 'فرصت‌های رشد بعدی' : 'Next growth opportunities'}
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                {fa ? 'پیشنهادهای پویا براساس وضعیت فعلی' : 'Dynamic suggestions based on current status'}
              </p>
            </div>
          </div>
          <div className="space-y-2.5">
            {actions.slice(0, 4).map((action) => {
              const Icon = action.icon
              return (
                <div
                  key={action.key}
                  className={cn(
                    'rounded-2xl border p-3.5',
                    action.attention
                      ? 'border-black/15 bg-black/[0.035]'
                      : 'border-[var(--border-default)] bg-[var(--bg-surface)]',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl border bg-[var(--bg-base)]', action.attention ? 'border-black/10 text-[var(--text-primary)]' : 'border-[var(--border-subtle)] text-[var(--text-muted)]')}>
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-bold text-[var(--text-primary)]">{action.title}</p>
                        {action.badge && (
                          <span className="rounded-full bg-black/[0.055] px-2 py-0.5 text-[9px] font-bold text-[var(--text-secondary)]">
                            {action.badge}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
                        {action.desc}
                      </p>
                      <Link
                        href={action.href}
                        className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-xl text-[11px] font-bold text-[var(--text-primary)] transition-opacity hover:opacity-65"
                      >
                        {action.cta}
                        <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

function safeHostname(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return value
  }
}
