import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  MessageSquare,
  CreditCard,
  Activity,
  Settings,
  Mail,
} from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getPlanDefs } from '@/lib/billing/plans'
import { MiniTrend } from '@/components/admin/mini-trend'
import { conversationsDailyByWorkspace, paymentsDailyByWorkspace } from '@/lib/admin/charts'
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
  OWNER: { label: 'مدیر', tone: 'default' },
  ADMIN: { label: 'ادمین', tone: 'info' },
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

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
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
          createdAt: true,
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

  const [conversations, payments, usage, convSpark, paySpark] = await Promise.all([
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
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
        paidAt: true,
      },
    }),
    prisma.usageLog.aggregate({
      where: { workspaceId: user.workspaceId, date: { gte: since30 } },
      _sum: { promptTokens: true, completionTokens: true, cost: true },
      _count: { _all: true },
    }),
    conversationsDailyByWorkspace(7),
    paymentsDailyByWorkspace(7),
  ])

  const role = ROLE_LABEL[user.role] ?? { label: user.role, tone: 'muted' as BadgeTone }
  const plan = PLAN_LABEL[ws.plan] ?? { label: ws.plan, tone: 'muted' as BadgeTone }
  const planDef = getPlanDefs()[ws.plan]
  const totalTokens = (usage._sum.promptTokens ?? 0) + (usage._sum.completionTokens ?? 0)
  const totalCost = usage._sum.cost ?? 0

  // 7-day sparkline data for this user's workspace.
  const convSeries = user.workspaceId ? convSpark.get(user.workspaceId)?.series ?? [] : []
  const convWeekTotal = user.workspaceId ? convSpark.get(user.workspaceId)?.total ?? 0 : 0
  const paySeries = user.workspaceId ? paySpark.get(user.workspaceId)?.series ?? [] : []
  const payWeekTotal = user.workspaceId ? paySpark.get(user.workspaceId)?.total ?? 0 : 0

  const userName = user.name ?? user.phone
  const memberSince = fmtDay(user.createdAt)

  return (
    <div className="space-y-6">
      <PageHeader
        title={userName}
        subtitle={`${role.label} · عضو از ${memberSince}`}
        breadcrumbs={[
          { label: 'داشبورد', href: '/admin' },
          { label: 'کاربران', href: '/admin/users' },
          { label: userName },
        ]}
        action={
          <Link
            href={`/admin/workspaces/${ws.id}`}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            مشاهده کسب‌وکار
          </Link>
        }
      />

      {/* ─── 7-day activity sparklines ─── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MiniTrend
          label="مکالمات ۷ روز اخیر"
          value={convWeekTotal}
          series={convSeries}
          color="#3b82f6"
          hint={`کل: ${fa(ws._count.conversations)}`}
          variant="light"
        />
        <MiniTrend
          label="پرداخت‌های ۷ روز اخیر"
          value={payWeekTotal}
          series={paySeries}
          color="#22c55e"
          hint={`کل: ${fa(ws._count.payments)}`}
          variant="light"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ─── MAIN COLUMN ─── */}
        <div className="space-y-5 lg:col-span-2">
          {/* User info */}
          <Panel title="اطلاعات کاربر">
            <SectionLabel>پروفایل</SectionLabel>
            <div className="divide-y divide-zinc-100">
              <KV label="نام">{user.name ?? '—'}</KV>
              <KV label="تلفن" mono>
                <span dir="ltr">{user.phone}</span>
              </KV>
              <KV label="نقش">
                <Badge tone={role.tone}>{role.label}</Badge>
              </KV>
              <KV label="زبان">{user.language}</KV>
              <KV label="تاریخ عضویت">{memberSince}</KV>
              <KV label="شناسه" mono>
                <span dir="ltr" className="block max-w-[220px] truncate">{user.id}</span>
              </KV>
            </div>
          </Panel>

          {/* Workspace */}
          <Panel title="کسب‌وکار">
            <SectionLabel>{ws.name}</SectionLabel>
            <div className="divide-y divide-zinc-100">
              <KV label="نام کسب‌وکار">{ws.name}</KV>
              <KV label="اسلاگ" mono>
                <span dir="ltr">{ws.slug}</span>
              </KV>
              <KV label="پلن">
                <Badge tone={plan.tone}>{plan.label}</Badge>
              </KV>
              <KV label="ایمیل گزارش کسب‌وکار">
                {ws.reportEmail ? (
                  <span dir="ltr">{ws.reportEmail}</span>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </KV>
              <KV label="پایان آزمایشی">
                {ws.trialEndsAt ? fmtDay(ws.trialEndsAt) : <span className="text-zinc-400">—</span>}
              </KV>
              <KV label="وضعیت آنبوردینگ">
                {ws.onboardingCompleted ? (
                  <Badge tone="success">تکمیل شده</Badge>
                ) : (
                  <Badge tone="warning">در حال انجام (گام {fa(ws.onboardingStep)})</Badge>
                )}
              </KV>
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
                  const pl = PLAN_LABEL[p.plan] ?? { label: p.plan, tone: 'muted' as BadgeTone }
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
              <KV label="توکن مصرفی (۳۰ روز)">{fa(totalTokens)}</KV>
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
              <KV label="پیام‌های ماهانه">{fa(planDef.monthlyMessages)}</KV>
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
