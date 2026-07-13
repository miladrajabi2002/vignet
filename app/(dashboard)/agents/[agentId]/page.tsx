import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Database,
  CalendarDays,
  Package,
  Share2,
  Store,
  SlidersHorizontal,
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { TestPlayground } from '@/components/agent-builder/test-playground'
import { cn } from '@/lib/utils'
import { getDashboardModules } from '@/lib/verticals/registry'
import { readBusinessProfile } from '@/lib/verticals/profile'

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
    select: { id: true, welcomeMessage: true },
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
        where: { agentId: agent.id, type: { not: 'PRODUCT_CATALOG' } },
      }),
      prisma.agentChannel.count({ where: { agentId: agent.id } }),
    ])

  const profile = readBusinessProfile(workspace?.businessProfile)
  const modules = getDashboardModules(workspace?.businessType, profile?.services)
  const hasProducts = modules.includes('products')
  const hasAppointments = modules.includes('appointments')
  const hasServices = modules.includes('services')

  const steps = [
    {
      key: 'settings',
      done: true,
      optional: false,
      icon: SlidersHorizontal,
      title: fa ? 'هویت و رفتار ایجنت' : 'Agent identity and behavior',
      desc: fa ? 'تنظیمات پایه هنگام ساخت ایجنت ذخیره شده است.' : 'Core settings were saved when the agent was created.',
      href: `/agents/${agent.id}/settings`,
      cta: fa ? 'بازبینی' : 'Review',
    },
    ...(hasProducts ? [{
      key: 'store',
      done: storeCount > 0,
      optional: true,
      icon: Store,
      title: t('setup.storeTitle'),
      desc: t('setup.storeDesc'),
      href: '/integrations',
      cta: t('setup.storeCta'),
    }] : []),
    ...(hasServices && !hasAppointments ? [{
      key: 'services', done: serviceCount > 0, optional: true, icon: CalendarDays,
      title: fa ? 'کاتالوگ خدمات' : 'Service catalog',
      desc: fa ? 'خدمات واقعی را ثبت کنید تا ایجنت فقط از اطلاعات تأییدشده استفاده کند.' : 'Register real services so the agent uses verified information.',
      href: '/services', cta: fa ? 'افزودن خدمت' : 'Add service',
    }] : []),
    ...(hasProducts ? [{
      key: 'products',
      done: productCount > 0,
      optional: true,
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
      icon: Share2,
      title: t('setup.channelTitle'),
      desc: t('setup.channelDesc'),
      href: `/agents/${agent.id}/channels`,
      cta: t('setup.channelCta'),
    },
  ]

  const doneCount = steps.filter((s) => s.done).length
  const progress = Math.round((doneCount / Math.max(1, steps.length)) * 100)

  return (
    <div className="space-y-6">
      <section className="spatial-surface overflow-hidden rounded-[1.75rem] p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold text-black/40">{fa ? 'آزمایش فوری پاسخ' : 'Instant response test'}</p><h2 className="mt-1 text-base font-bold">{t('test')}</h2><p className="mt-1 text-[11px] text-black/45">{fa ? 'بدون خروج از این صفحه، تجربه واقعی مشتری را بررسی کنید.' : 'Check the real customer experience without leaving this page.'}</p></div><span className="rounded-full bg-black px-3 py-1 text-[9px] font-bold text-white">{fa ? 'در دسترس' : 'Available'}</span></div>
        <TestPlayground agentId={agent.id} welcomeMessage={agent.welcomeMessage} />
      </section>

      <div className="spatial-surface overflow-hidden rounded-[1.75rem]">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-black p-5 text-white sm:p-6">
            <div>
              <p className="text-[10px] font-bold text-white/45">{fa ? 'چک‌لیست پیشنهادی' : 'Recommended checklist'}</p>
              <h2 className="mt-1 text-base font-bold">{fa ? 'آماده‌سازی و رشد ایجنت' : 'Agent readiness and growth'}</h2>
              <p className="mt-1 text-xs text-white/55">{fa ? 'هیچ‌کدام از پیشنهادها مانع شروع کار نیست؛ هر زمان آماده بودید کاملشان کنید.' : 'These are recommendations, not blockers. Complete them whenever you are ready.'}</p>
            </div>
            <div className="min-w-36 rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
              <div className="flex items-center justify-between text-[10px] text-white/60"><span>{doneCount}/{steps.length}</span><span>{progress}%</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-white transition-[width]" style={{ width: `${progress}%` }} /></div>
            </div>
          </div>
          <ol className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5">
            {steps.map((step) => {
              const Icon = step.icon
              return (
                <li
                  key={step.key}
                  className={cn(
                    'flex min-h-24 items-center gap-3 rounded-2xl border px-3 py-3',
                    step.done ? 'border-emerald-500/15 bg-emerald-500/[0.04]' : 'border-[var(--border-default)] bg-[var(--bg-surface)]',
                  )}
                >
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />
                  )}
                  <Icon className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm',
                        step.done
                          ? 'text-[var(--text-secondary)]'
                          : 'text-[var(--text-primary)]',
                      )}
                    >
                      {step.title}
                      {step.optional && !step.done && (
                        <span className="ms-2 text-[11px] text-[var(--text-muted)]">
                          {t('setup.optional')}
                        </span>
                      )}
                    </p>
                    {!step.done && (
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        {step.desc}
                      </p>
                    )}
                  </div>
                  {!step.done && step.href && (
                    <Link
                      href={step.href}
                        className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-xl bg-black px-3 text-xs font-bold text-white"
                    >
                      {step.cta}
                      <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                    </Link>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
    </div>
  )
}
