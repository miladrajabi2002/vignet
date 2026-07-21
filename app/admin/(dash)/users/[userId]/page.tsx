import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  MessageSquare,
  CreditCard,
  Activity,
  Settings,
  Mail,
  Bot,
  Cable,
  Check,
  Database,
  Sparkles,
  UserRoundCheck,
} from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { ADMIN_VISIBLE_USER_WHERE } from '@/lib/admin/reporting-scope'
import { cn } from '@/lib/utils'
import { getEffectivePlanDefs } from '@/lib/billing/plans'
import { readBusinessProfile } from '@/lib/verticals/profile'
import { getVerticalPack } from '@/lib/verticals/registry'
import { TrendChart, type DailyPoint } from '@/components/admin/trend-chart'
import { conversationsDailyByWorkspace, paymentsDailyByWorkspace } from '@/lib/admin/charts'
import { PERSIAN_DATE_LOCALE } from '@/lib/localized-date'
import {
  PageHeader,
  Panel,
  SectionLabel,
  KV,
  StatCard,
  Badge,
  EmptyState,
  fa,
  fmtDay,
  fmtDate,
  fmtIRR,
  fmtUSD,
} from '../../ui'

export const dynamic = 'force-dynamic'

type BadgeTone = 'default' | 'info' | 'muted' | 'success' | 'warning' | 'danger'

const ROLE_LABEL: Record<string, { label: string; tone: BadgeTone }> = {
  OWNER: { label: 'مالک کسب‌وکار', tone: 'default' },
  ADMIN: { label: 'مدیر کسب‌وکار', tone: 'info' },
  MEMBER: { label: 'عضو', tone: 'muted' },
}

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

export default async function AdminUserDetailPage(
  props: {
    params: Promise<{ userId: string }>
  },
) {
  const params = await props.params

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
          onboardingStep: true,
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
              users: true,
              products: true,
            },
          },
        },
      },
    },
  })

  if (!user) notFound()

  const ws = user.workspace
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [conversations, payments, usage, convSpark, paySpark, journeySignals] = await Promise.all([
    prisma.conversation.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        channel: true,
        status: true,
        messageCount: true,
        lastMessageAt: true,
        createdAt: true,
        agent: { select: { name: true } },
      },
    }),
    prisma.payment.findMany({
      where: { workspaceId: user.workspaceId },
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
    prisma.usageLog.aggregate({
      where: { workspaceId: user.workspaceId, date: { gte: since30 } },
      _sum: { promptTokens: true, completionTokens: true, chargedIRR: true, cost: true },
      _count: { _all: true },
    }),
    conversationsDailyByWorkspace(7),
    paymentsDailyByWorkspace(7),
    Promise.all([
      prisma.agent.findFirst({ where: { workspaceId: user.workspaceId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, createdAt: true, updatedAt: true, active: true } }),
      prisma.knowledgeBase.findFirst({ where: { workspaceId: user.workspaceId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, status: true, createdAt: true, updatedAt: true } }),
      prisma.agentChannel.findFirst({ where: { agent: { workspaceId: user.workspaceId } }, orderBy: { createdAt: 'asc' }, select: { id: true, type: true, active: true, createdAt: true, lastInboundAt: true } }),
      prisma.conversation.findFirst({ where: { workspaceId: user.workspaceId }, orderBy: { createdAt: 'asc' }, select: { id: true, createdAt: true, lastMessageAt: true } }),
      prisma.payment.findFirst({ where: { workspaceId: user.workspaceId, status: 'PAID' }, orderBy: { paidAt: 'asc' }, select: { id: true, paidAt: true, createdAt: true, amount: true, currency: true } }),
      prisma.usageLog.findFirst({ where: { workspaceId: user.workspaceId, status: 'CAPTURED' }, orderBy: { date: 'asc' }, select: { id: true, date: true, type: true, chargedIRR: true } }),
      prisma.oTPLog.findFirst({ where: { phone: user.phone, verified: true }, orderBy: { sentAt: 'desc' }, select: { sentAt: true } }),
    ]).then(([agent, knowledge, channel, conversation, payment, firstUsage, lastLogin]) => ({ agent, knowledge, channel, conversation, payment, firstUsage, lastLogin })),
  ])

  const role = ROLE_LABEL[user.role] ?? { label: user.role, tone: 'muted' as BadgeTone }
  const plan = PLAN_LABEL[ws.plan] ?? { label: ws.plan, tone: 'muted' as BadgeTone }
  const planDef = (await getEffectivePlanDefs())[ws.plan]
  const businessProfile = readBusinessProfile(ws.businessProfile)
  const vertical = getVerticalPack(ws.businessType)
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

  const userName = user.name ?? user.phone
  const memberSince = fmtDay(user.createdAt)
  const journeySteps = [
    { label: 'ساخت حساب', detail: 'ثبت‌نام و ایجاد فضای کاری', done: true, at: user.createdAt, icon: UserRoundCheck },
    { label: 'تکمیل راه‌اندازی', detail: ws.onboardingCompleted ? 'پروفایل کسب‌وکار تکمیل شده' : `متوقف در گام ${fa(ws.onboardingStep)} از ۴`, done: ws.onboardingCompleted, at: ws.onboardingCompleted ? ws.createdAt : null, icon: Check },
    { label: 'ساخت ایجنت', detail: journeySignals.agent ? journeySignals.agent.name : 'هنوز ایجنتی ساخته نشده', done: Boolean(journeySignals.agent), at: journeySignals.agent?.createdAt ?? null, icon: Bot },
    { label: 'آماده‌سازی دانش', detail: journeySignals.knowledge ? `${journeySignals.knowledge.name} · ${journeySignals.knowledge.status}` : 'منبع دانشی ثبت نشده', done: journeySignals.knowledge?.status === 'READY', at: journeySignals.knowledge?.createdAt ?? null, icon: Database },
    { label: 'اتصال کانال', detail: journeySignals.channel ? `${CHANNEL_LABEL[journeySignals.channel.type] ?? journeySignals.channel.type}${journeySignals.channel.active ? ' · فعال' : ' · غیرفعال'}` : 'کانالی متصل نشده', done: Boolean(journeySignals.channel?.active), at: journeySignals.channel?.createdAt ?? null, icon: Cable },
    { label: 'اولین گفتگو', detail: journeySignals.conversation ? 'ورود به فاز استفاده واقعی' : 'هنوز گفتگویی دریافت نشده', done: Boolean(journeySignals.conversation), at: journeySignals.conversation?.createdAt ?? null, icon: MessageSquare },
    { label: 'مصرف موفق AI', detail: journeySignals.firstUsage ? `${fmtIRR(journeySignals.firstUsage.chargedIRR)} کسر اعتبار` : 'درخواست موفق ثبت نشده', done: Boolean(journeySignals.firstUsage), at: journeySignals.firstUsage?.date ?? null, icon: Sparkles },
    { label: 'تبدیل به مشتری', detail: journeySignals.payment ? (journeySignals.payment.currency === 'IRR' ? fmtIRR(journeySignals.payment.amount) : fmtUSD(journeySignals.payment.amount)) : 'پرداخت موفق ثبت نشده', done: Boolean(journeySignals.payment), at: journeySignals.payment?.paidAt ?? journeySignals.payment?.createdAt ?? null, icon: CreditCard },
  ]
  const firstIncomplete = journeySteps.findIndex((step) => !step.done)
  const completedSteps = journeySteps.filter((step) => step.done).length
  const journeyProgress = Math.round((completedSteps / journeySteps.length) * 100)
  const currentStage = firstIncomplete === -1 ? 'کاربر فعال و پرداختی' : journeySteps[firstIncomplete].label
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
      />

      <section className="admin-panel overflow-hidden rounded-[1.6rem]" aria-labelledby="user-journey-title">
        <div className="grid lg:grid-cols-[.34fr_.66fr]">
          <div className="border-b border-black/[0.06] bg-[#111214] p-5 text-white lg:border-b-0 lg:border-l sm:p-6">
            <p className="text-[10px] font-bold text-white/60">مسیر فعالیت کاربر</p>
            <h2 id="user-journey-title" className="mt-2 text-xl font-black">گزارش مسیر کاربر</h2>
            <p className="mt-2 text-xs leading-6 text-white/45">مرحله فعلی، نقاط توقف و رویدادهای مهم از داده واقعی همین کسب‌وکار استخراج شده‌اند.</p>
            <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.055] p-4">
              <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] text-white/40">مرحله فعلی</p><p className="mt-1 text-sm font-bold">{currentStage}</p></div><span className="text-2xl font-black tabular-nums">{fa(journeyProgress)}٪</span></div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${journeyProgress}%` }} /></div>
              <div className="mt-4 flex items-center justify-between text-[10px] text-white/38"><span>{fa(completedSteps)} از {fa(journeySteps.length)} مرحله</span><span>{latestActivityAt ? `آخرین فعالیت ${fmtDate(latestActivityAt)}` : 'بدون فعالیت'}</span></div>
            </div>
            {firstIncomplete !== -1 && (
              <div className="mt-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.07] p-3.5">
                <p className="text-[10px] font-bold text-amber-200">احتمال گیرکردن کاربر</p>
                <p className="mt-1 text-xs leading-5 text-white/60">مرحله «{journeySteps[firstIncomplete].label}» هنوز کامل نشده: {journeySteps[firstIncomplete].detail}</p>
              </div>
            )}
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4">
            {journeySteps.map((step, index) => {
              const Icon = step.icon
              return (
                <div key={step.label} className={cn('flex min-h-[6.5rem] gap-3 rounded-[1.15rem] border p-3.5', step.done ? 'border-emerald-200/70 bg-emerald-50/35' : index === firstIncomplete ? 'border-amber-200 bg-amber-50/50' : 'border-black/[0.06] bg-black/[0.018]')}>
                  <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', step.done ? 'bg-emerald-600 text-white' : index === firstIncomplete ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-400')}>{step.done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span>
                  <div className="min-w-0"><div className="flex items-center gap-2"><p className="text-xs font-black text-black">{fa(index + 1)}. {step.label}</p>{!step.done && index === firstIncomplete && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-bold text-zinc-700">مرحله فعلی</span>}</div><p className="mt-1 line-clamp-2 text-[10px] leading-5 text-black/45">{step.detail}</p><p className="mt-1 text-[10px] text-black/35">{step.at ? fmtDate(step.at) : '—'}</p></div>
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
                  <KV label="تلفن" mono><span dir="ltr">{user.phone}</span></KV>
                  <KV label="دسترسی">
                    <span className="flex flex-wrap gap-1.5">
                      <Badge tone={role.tone}>{role.label}</Badge>
                      {user.platformRole === 'ADMIN' && <Badge tone="danger">مدیر اصلی ویجنتو</Badge>}
                    </span>
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
                    {ws.onboardingCompleted ? <Badge tone="success">فعال‌شده</Badge> : <Badge tone="warning">در حال راه‌اندازی · گام {fa(ws.onboardingStep)}</Badge>}
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

          {/* 30-day stats */}
          <Panel title="آمار ۳۰ روز اخیر">
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="مکالمات"
                value={ws._count.conversations}
                icon={<MessageSquare className="h-4 w-4" />}
              />
              <StatCard
                label="ایجنت‌ها"
                value={ws._count.agents}
                tone="info"
                icon={<Settings className="h-4 w-4" />}
              />
              <StatCard
                label="پرداخت‌ها"
                value={ws._count.payments}
                tone="success"
                icon={<CreditCard className="h-4 w-4" />}
              />
              <StatCard
                label="درخواست‌های AI"
                value={usage._count._all}
                tone="warning"
                icon={<Activity className="h-4 w-4" />}
              />
            </div>
          </Panel>

          {/* Recent conversations */}
          <Panel
            title="مکالمات اخیر"
            href="/admin/conversations"
            linkLabel="همه مکالمات"
          >
            {conversations.length === 0 ? (
              <EmptyState icon={<MessageSquare className="h-7 w-7" />}>
                مکالمه‌ای ثبت نشده
              </EmptyState>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {conversations.map((c) => {
                  const st = CONV_STATUS[c.status] ?? { label: c.status, tone: 'muted' as BadgeTone }
                  return (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center gap-2 py-2.5"
                    >
                      <Badge tone="info">{CHANNEL_LABEL[c.channel] ?? c.channel}</Badge>
                      <span className="truncate text-sm font-medium text-zinc-800">
                        {c.agent.name}
                      </span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      <span className="ms-auto text-xs text-zinc-500">
                        {fa(c.messageCount)} پیام · {fmtDate(c.lastMessageAt ?? c.createdAt)}
                      </span>
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
            {payments.length === 0 ? (
              <EmptyState icon={<CreditCard className="h-7 w-7" />}>
                پرداختی ثبت نشده
              </EmptyState>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {payments.map((p) => {
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
              <KV label="حداکثر ایجنت">{fa(planDef.maxAgents)}</KV>
            </div>
          </Panel>

          {/* Quick links */}
          <Panel title="تماس سریع">
            <nav className="flex flex-col gap-1">
              <span className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-400">
                <Mail className="h-4 w-4" />
                ارسال پیام
              </span>
              <Link
                href="/admin/conversations"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
              >
                <MessageSquare className="h-4 w-4" />
                مشاهده مکالمات
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
    </div>
  )
}
