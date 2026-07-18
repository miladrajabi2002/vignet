import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import {
  ArrowRight,
  CheckCircle2,
  Database,
  CalendarDays,
  Package,
  Share2,
  Store,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { TestPlayground } from '@/components/agent-builder/test-playground'
import { cn } from '@/lib/utils'
import { getDashboardModules } from '@/lib/verticals/registry'
import { readBusinessProfile } from '@/lib/verticals/profile'

interface SetupStep {
  key: string
  done: boolean
  optional: boolean
  priority: number
  icon: LucideIcon
  title: string
  desc: string
  href: string
  cta: string
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

  const [workspace, storeCount, productCount, serviceCount, kbCount, channelCount] =
    await Promise.all([
      prisma.workspace.findUnique({
        where: { id: user.workspaceId },
        select: { businessType: true, businessProfile: true },
      }),
      prisma.storeIntegration.count({
        where: { workspaceId: user.workspaceId, active: true },
      }),
      prisma.product.count({ where: { workspaceId: user.workspaceId } }),
      prisma.service.count({ where: { workspaceId: user.workspaceId, active: true } }),
      prisma.knowledgeBase.count({
        where: {
          agentId: agent.id,
          type: { not: 'PRODUCT_CATALOG' },
          status: 'READY',
        },
      }),
      prisma.agentChannel.count({ where: { agentId: agent.id, active: true } }),
    ])

  const profile = readBusinessProfile(workspace?.businessProfile)
  const modules = getDashboardModules(workspace?.businessType, profile?.services)
  const hasProducts = modules.includes('products')
  const hasAppointments = modules.includes('appointments')
  const hasServices = modules.includes('services')

  const hasConfiguredBehavior =
    agent.systemPrompt.trim().length > 0 || agent.promptConfig !== null

  const steps: SetupStep[] = [
    {
      key: 'settings',
      done: agent.name.trim().length > 0 && hasConfiguredBehavior,
      optional: false,
      priority: 0,
      icon: SlidersHorizontal,
      title: fa ? 'هویت و رفتار ایجنت' : 'Agent identity and behavior',
      desc: fa ? 'هویت، مدل و قواعد پاسخ‌گویی را بازبینی کنید تا رفتار ایجنت هماهنگ بماند.' : 'Review identity, model and response rules to keep the agent consistent.',
      href: `/agents/${agent.id}/settings`,
      cta: fa ? 'بازبینی' : 'Review',
    },
    ...(hasProducts ? [{
      key: 'store',
      done: storeCount > 0,
      optional: true,
      priority: productCount > 0 ? 60 : 10,
      icon: Store,
      title: t('setup.storeTitle'),
      desc: t('setup.storeDesc'),
      href: '/integrations',
      cta: t('setup.storeCta'),
    }] : []),
    ...(hasServices && !hasAppointments ? [{
      key: 'services', done: serviceCount > 0, optional: true, priority: 15, icon: CalendarDays,
      title: fa ? 'کاتالوگ خدمات' : 'Service catalog',
      desc: fa ? 'خدمات واقعی را ثبت کنید تا ایجنت فقط از اطلاعات تأییدشده استفاده کند.' : 'Register real services so the agent uses verified information.',
      href: '/services', cta: fa ? 'افزودن خدمت' : 'Add service',
    }] : []),
    ...(hasProducts ? [{
      key: 'products',
      done: productCount > 0,
      optional: true,
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
      optional: true,
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
      optional: true,
      priority: 30,
      icon: Database,
      title: t('setup.knowledgeTitle'),
      desc: t('setup.knowledgeDesc'),
      href: `/agents/${agent.id}/knowledge`,
      cta: t('setup.knowledgeCta'),
    },
    {
      key: 'channel',
      done: channelCount > 0,
      optional: true,
      priority: 40,
      icon: Share2,
      title: t('setup.channelTitle'),
      desc: t('setup.channelDesc'),
      href: `/agents/${agent.id}/channels`,
      cta: t('setup.channelCta'),
    },
  ]

  const doneCount = steps.filter((s) => s.done).length
  const nextStep = steps
    .filter((step) => !step.done)
    .sort((a, b) => a.priority - b.priority)[0]
  const remainingCount = steps.length - doneCount
  const progress = Math.round((doneCount / Math.max(1, steps.length)) * 100)

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

      {/* ── RIGHT: Onboarding & growth checklist ─────────────────────── */}
      <div className="spatial-surface overflow-hidden rounded-[1.5rem]">
        {/* Black header strip with progress */}
        <div className="relative isolate overflow-hidden bg-black p-5 text-white sm:p-6">
          <div aria-hidden className="pointer-events-none absolute -end-16 -top-24 h-52 w-52 rounded-full bg-white/[0.08] blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 start-1/4 h-40 w-40 rounded-full bg-white/[0.05] blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-md">
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/45">
              {fa ? 'چک‌لیست پیشنهادی' : 'Recommended checklist'}
            </p>
            <h2 className="mt-0.5 text-base font-bold">
              {fa ? 'آماده‌سازی و رشد ایجنت' : 'Agent readiness and growth'}
            </h2>
            <p className="mt-1 text-xs leading-5 text-white/60">
              {nextStep
                ? (fa
                    ? `براساس وضعیت واقعی ایجنت، «${nextStep.title}» بهترین قدم بعدی شماست.`
                    : `Based on the agent's live status, “${nextStep.title}” is your best next step.`)
                : (fa
                    ? 'همه پیشنهادهای متناسب با کسب‌وکار شما تکمیل شده‌اند.'
                    : 'Every recommendation tailored to your business is complete.')}
            </p>
            </div>
            <div
              className="min-w-40 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/10 backdrop-blur-sm"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label={fa ? 'میزان تکمیل چک‌لیست' : 'Checklist completion'}
            >
              <div className="flex items-center justify-between text-[11px] text-white/60">
                <span>{remainingCount > 0 ? (fa ? `${remainingCount} گام باقی مانده` : `${remainingCount} steps left`) : (fa ? 'کامل شد' : 'Complete')}</span>
                <span className="font-bold tabular-nums text-white">{progress}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-white transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-[10px] text-white/45">{doneCount}/{steps.length} {fa ? 'پیشنهاد انجام شده' : 'recommendations done'}</p>
            </div>
          </div>
        </div>

        {/* Step list — single column inside the right card for readability */}
        <ol className="space-y-2.5 p-4 sm:p-5">
          {steps.map((step) => {
            const Icon = step.icon
            const isNext = nextStep?.key === step.key
            return (
              <li
                key={step.key}
                className={cn(
                  'grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-2xl border px-4 py-3.5 transition-[border-color,background-color,box-shadow] duration-200 motion-reduce:transition-none',
                  step.done
                    ? 'border-success/15 bg-success/[0.035]'
                    : isNext
                      ? 'border-black/15 bg-black/[0.035] shadow-[0_14px_35px_-30px_rgba(0,0,0,0.75)]'
                      : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]',
                )}
              >
                <div
                  className={cn(
                    'relative grid h-10 w-10 place-items-center rounded-xl border',
                    step.done
                      ? 'border-success/15 bg-success/[0.08] text-success'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-base)] text-[var(--text-muted)]',
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {step.done && (
                    <CheckCircle2 className="absolute -end-1 -top-1 h-4 w-4 rounded-full bg-[var(--bg-base)] text-success" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn('text-sm font-semibold', step.done ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]')}>
                      {step.title}
                    </p>
                    {isNext && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-black px-2 py-0.5 text-[10px] font-bold text-white">
                        <Sparkles className="h-3 w-3" />
                        {fa ? 'بهترین قدم بعدی' : 'Best next step'}
                      </span>
                    )}
                    {step.done && (
                      <span className="text-[10px] font-semibold text-success">
                        {fa ? 'انجام شده' : 'Complete'}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {step.desc}
                  </p>
                </div>
                <div className="col-start-2 flex items-center justify-between gap-3">
                  {!step.done && step.optional && !isNext ? (
                    <span className="text-[10px] text-[var(--text-muted)]">{t('setup.optional')}</span>
                  ) : <span />}
                  <Link
                    href={step.href}
                    className={cn(
                      'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-2',
                      step.done
                        ? 'border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]'
                        : 'bg-[var(--text-primary)] text-[var(--bg-base)] hover:opacity-90',
                    )}
                  >
                    {step.done ? (fa ? 'بازبینی' : 'Review') : step.cta}
                    <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                  </Link>
                </div>
              </li>
            )
          })}
        </ol>
        <p className="px-5 pb-5 text-[11px] leading-5 text-[var(--text-muted)]">
          {fa
            ? 'این موارد پیشنهادهای رشد هستند و مانع فعال بودن یا تست ایجنت نمی‌شوند.'
            : 'These are growth recommendations; they never block activating or testing the agent.'}
        </p>
      </div>
    </div>
  )
}
