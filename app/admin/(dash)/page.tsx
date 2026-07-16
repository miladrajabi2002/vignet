import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  Wallet,
  MessagesSquare,
  TrendingUp,
  AlertTriangle,
  Activity,
  BrainCircuit,
  CircleDollarSign,
  Bot,
  ChevronLeft,
  Gauge,
  ShieldCheck,
  UserPlus,
} from 'lucide-react'
import {
  PageHeader,
  StatCard,
  Panel,
  Badge,
  fmtIRR,
  fa,
} from './ui'
import {
  TrendChart,
  DonutChart,
  ActivationFunnel,
  MonthlyBarChart,
} from '@/components/admin/trend-chart'
import { DashboardPanel } from '@/components/dashboard/panel'
import { ConversationChart } from '@/components/dashboard/charts/lazy'
import type { TrendPoint } from '@/components/dashboard/charts/conversation-chart'
import { RangeSwitch, type RangeKind } from '@/components/admin/range-switch'
import {
  conversationsDaily,
  errorsDaily,
  newUsersDaily,
  revenueIRRDaily,
  paymentsDaily,
  usageChargesDaily,
  revenueIRRMonthly,
  planDistribution,
} from '@/lib/admin/charts'
import { getRevenueKPIs } from '@/lib/admin/revenue'
import { getAiOverview } from '@/lib/admin/ai-usage'

export const dynamic = 'force-dynamic'

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function parseRange(value: string | undefined): RangeKind {
  if (value === '30d') return '30d'
  if (value === 'monthly') return 'monthly'
  return '7d'
}

export default async function AdminOverviewPage(
  props: {
    searchParams: Promise<{ range?: string }>
  },
) {
  const searchParams = await props.searchParams
  const range = parseRange(searchParams.range)
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 7

  const startToday = startOfToday()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const staleOnboarding = new Date(Date.now() - 48 * 60 * 60 * 1000)

  // Range-dependent series — only fetch what the selected range needs.
  const rangeSeriesPromise =
    range === 'monthly'
      ? Promise.resolve(revenueIRRMonthly(12)).then((m) => ({ monthly: m, daily: null as null }))
      : Promise.all([
          revenueIRRDaily(days),
          newUsersDaily(days),
        ]).then(([rev, users]) => ({
          monthly: null as null,
          daily: { rev, users },
        }))

  const [
    revenueKPIs,
    workspaceCount,
    userCount,
    conversationsToday,
    errors24h,
    plans,
    rangeSeries,
    kpiTrends,
    aiOverview,
    activation,
    activeUsers,
    newUsersToday,
    revenueToday,
    agentHealth,
    channelHealth,
    activeHandoffs,
    lowCreditWorkspaces,
    stalledWorkspaces,
    failedPayments24h,
    responseHealth,
  ] = await Promise.all([
    getRevenueKPIs(),
    prisma.workspace.count(),
    prisma.user.count(),
    prisma.conversation.count({ where: { createdAt: { gte: startToday } } }),
    prisma.errorLog.count({ where: { createdAt: { gte: since24h } } }),
    planDistribution(),
    rangeSeriesPromise,
    // ─ 7-day series for KPI card sparklines (always 7d, regardless of the
    //   range switch, so the cards always show recent site-wide momentum).
    Promise.all([
      revenueIRRDaily(7),
      conversationsDaily(7),
      newUsersDaily(7),
      errorsDaily(7),
      paymentsDaily(7),
      usageChargesDaily(7),
    ]).then(([rev, conv, users, err, pays, ai]) => ({
      rev, conv, users, err, pays, ai,
    })),
    getAiOverview(30),
    Promise.all([
      prisma.workspace.count({ where: { onboardingCompleted: true } }),
      prisma.workspace.count({ where: { agents: { some: {} } } }),
      prisma.workspace.count({ where: { agents: { some: { knowledgeBases: { some: { status: 'READY' } } } } } }),
      prisma.workspace.count({ where: { agents: { some: { channels: { some: { active: true } } } } } }),
      prisma.workspace.count({ where: { conversations: { some: {} } } }),
    ]).then(([onboarded, agentBuilt, knowledgeReady, channelConnected, firstConversation]) => ({
      onboarded,
      agentBuilt,
      knowledgeReady,
      channelConnected,
      firstConversation,
    })),
    prisma.user.count({ where: { workspace: { conversations: { some: { createdAt: { gte: since30d } } } } } }),
    prisma.user.count({ where: { createdAt: { gte: startToday } } }),
    prisma.payment.aggregate({ where: { status: 'PAID', currency: 'IRR', paidAt: { gte: startToday } }, _sum: { amount: true } }),
    Promise.all([
      prisma.agent.count(),
      prisma.agent.count({ where: { active: true } }),
    ]).then(([total, active]) => ({ total, active })),
    Promise.all([
      prisma.agentChannel.count(),
      prisma.agentChannel.count({ where: { active: true } }),
      prisma.agentChannel.count({ where: { active: true, OR: [{ lastInboundAt: { lt: new Date(Date.now() - 72 * 60 * 60 * 1000) } }, { lastInboundAt: null, createdAt: { lt: new Date(Date.now() - 72 * 60 * 60 * 1000) } }] } }),
    ]).then(([total, active, silent]) => ({ total, active, silent })),
    prisma.conversation.count({ where: { OR: [{ status: 'HANDED_OFF' }, { handedOff: true }] } }),
    prisma.workspace.count({ where: { aiCreditBalanceIRR: { lte: 20_000 } } }),
    prisma.workspace.count({ where: { onboardingCompleted: false, createdAt: { lt: staleOnboarding } } }),
    prisma.payment.count({ where: { status: 'FAILED', createdAt: { gte: since24h } } }),
    Promise.all([
      prisma.conversation.count({ where: { createdAt: { gte: since30d } } }),
      prisma.conversation.count({ where: { createdAt: { gte: since30d }, messages: { some: { role: 'ASSISTANT' } } } }),
    ]).then(([total, answered]) => ({ total, answered, rate: total > 0 ? Math.round((answered / total) * 100) : 100 })),
  ])

  const attentionItems = [
    errors24h > 0 ? { label: `${fa(errors24h)} خطای جدید در ۲۴ ساعت`, detail: 'منبع‌های پرتکرار را بررسی و اولویت‌بندی کنید.', href: '/admin/system#errors', tone: 'danger' as const } : null,
    activeHandoffs > 0 ? { label: `${fa(activeHandoffs)} گفتگوی تحویل‌شده به اپراتور`, detail: 'پرونده‌های باز منتظر تصمیم انسانی هستند.', href: '/admin/conversations?status=HANDED_OFF', tone: 'warning' as const } : null,
    stalledWorkspaces > 0 ? { label: `${fa(stalledWorkspaces)} کسب‌وکار در راه‌اندازی متوقف شده`, detail: 'بیش از ۴۸ ساعت از ثبت‌نام گذشته و فعال‌سازی کامل نشده است.', href: '/admin/users', tone: 'warning' as const } : null,
    lowCreditWorkspaces > 0 ? { label: `${fa(lowCreditWorkspaces)} کسب‌وکار با اعتبار AI پایین`, detail: 'موجودی کمتر از ۲ هزار تومان است؛ ریسک توقف پاسخ وجود دارد.', href: '/admin/workspaces', tone: 'warning' as const } : null,
    channelHealth.silent > 0 ? { label: `${fa(channelHealth.silent)} اتصال فعال بدون ورودی اخیر`, detail: 'کانال‌های ساکت بیش از ۷۲ ساعت را از نظر webhook بررسی کنید.', href: '/admin/agents', tone: 'info' as const } : null,
    failedPayments24h > 0 ? { label: `${fa(failedPayments24h)} پرداخت ناموفق امروز`, detail: 'الگوی خطای درگاه و امکان بازیابی فروش را بررسی کنید.', href: '/admin/payments?status=FAILED', tone: 'danger' as const } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item))

  return (
    <div className="space-y-6">
      <PageHeader
        title="داشبورد"
        subtitle="تصمیم‌های مهم، سلامت عملیات و رشد پلتفرم — در یک نمای واحد"
        icon={Activity}
        action={<RangeSwitch current={range} />}
      />

      {/* ─── Executive pulse — every KPI carries its own mini trend ─── */}
      <section aria-labelledby="executive-pulse-title">
        <h2 id="executive-pulse-title" className="sr-only">شاخص‌های کلیدی</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="درآمد امروز"
          value={fmtIRR(revenueToday._sum.amount ?? 0)}
          icon={<Wallet className="h-5 w-5" />}
          tone="success"
          series={kpiTrends.rev.map((point) => point.value)}
        />
        <StatCard
          label="درآمد ماه"
          value={fmtIRR(revenueKPIs.thisMonthIRR)}
          sub={`${fa(revenueKPIs.momChange)}٪ نسبت به ماه قبل`}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="success"
          series={kpiTrends.rev.map((point) => point.value)}
        />
        <StatCard
          label="درآمد کل"
          value={fmtIRR(revenueKPIs.totalIRR)}
          sub={`${fa(revenueKPIs.paidCount)} پرداخت موفق`}
          icon={<CircleDollarSign className="h-5 w-5" />}
          tone="success"
          series={kpiTrends.pays.map((point) => point.value)}
        />
        <StatCard
          label="کاربران فعال ۳۰ روزه"
          value={activeUsers}
          sub={`از ${fa(userCount)} کاربر کل`}
          icon={<Activity className="h-5 w-5" />}
          tone="info"
          series={kpiTrends.users.map((point) => point.value)}
        />
        <StatCard
          label="کاربر جدید امروز"
          value={newUsersToday}
          sub={`${fa(workspaceCount)} کسب‌وکار کل`}
          icon={<UserPlus className="h-5 w-5" />}
          series={kpiTrends.users.map((point) => point.value)}
        />
        <StatCard
          label="مکالمات امروز"
          value={conversationsToday}
          sub={`${fa(responseHealth.rate)}٪ دارای پاسخ ایجنت`}
          icon={<MessagesSquare className="h-5 w-5" />}
          tone="info"
          series={kpiTrends.conv.map((point) => point.value)}
        />
        <StatCard
          label="ایجنت‌های فعال"
          value={`${fa(agentHealth.active)} / ${fa(agentHealth.total)}`}
          sub={`${fa(channelHealth.active)} اتصال فعال`}
          icon={<Bot className="h-5 w-5" />}
          tone={agentHealth.total === 0 || agentHealth.active / agentHealth.total >= 0.8 ? 'success' : 'warning'}
          series={kpiTrends.conv.map((point) => point.value)}
        />
        <StatCard
          label="خطاهای ۲۴ ساعت"
          value={errors24h}
          sub={errors24h > 0 ? 'نیازمند بررسی' : 'وضعیت پایدار'}
          tone={errors24h > 0 ? 'danger' : 'success'}
          icon={<AlertTriangle className="h-5 w-5" />}
          series={kpiTrends.err.map((point) => point.value)}
        />
        </div>
      </section>

      {/* ─── Executive attention briefing ─────────────────────── */}
      <section className="spatial-surface overflow-hidden rounded-[1.65rem]" aria-labelledby="attention-title">
        <div className="flex flex-col gap-4 border-b border-black/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black text-white"><Gauge className="h-4 w-4" /></span>
            <div><h2 id="attention-title" className="text-sm font-black text-black">گزارش مدیریتی امروز</h2><p className="mt-1 text-[11px] leading-5 text-black/45">اولویت‌بندی خودکار بر اساس خطا، گفتگو، پرداخت، اعتبار، راه‌اندازی و سلامت کانال‌ها</p></div>
          </div>
          <div className="flex items-center gap-2"><Badge tone={attentionItems.length ? 'warning' : 'success'}>{attentionItems.length ? `${fa(attentionItems.length)} مورد نیازمند پیگیری` : 'وضعیت پایدار'}</Badge><Link href="/admin/system" className="admin-toolbar-button">سلامت زیرساخت <ChevronLeft className="h-3.5 w-3.5" /></Link></div>
        </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
            {attentionItems.length === 0 ? (
              <div className="col-span-full flex min-h-32 flex-col items-center justify-center rounded-[1.25rem] border border-emerald-200/70 bg-emerald-50/60 text-center"><span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-emerald-700"><ShieldCheck className="h-5 w-5" /></span><p className="mt-3 text-sm font-bold text-zinc-900">مورد بحرانی دیده نشد</p><p className="mt-1 text-[11px] text-zinc-500">سیگنال‌های کلیدی در محدوده پایدار هستند.</p></div>
            ) : attentionItems.map((item) => (
              <Link key={item.label} href={item.href} className="group flex min-h-[7rem] flex-col rounded-[1.2rem] border border-black/[0.065] bg-white/70 p-4 transition-[border-color,background-color,transform] hover:border-black/15 hover:bg-white active:scale-[.99]">
                <div className="flex items-start gap-2"><span className={item.tone === 'danger' ? 'mt-1 h-2 w-2 rounded-full bg-red-500' : item.tone === 'warning' ? 'mt-1 h-2 w-2 rounded-full bg-amber-500' : 'mt-1 h-2 w-2 rounded-full bg-blue-500'} /><p className="text-xs font-bold leading-5 text-zinc-900">{item.label}</p><ChevronLeft className="ms-auto mt-0.5 h-3.5 w-3.5 text-black/25 transition-transform group-hover:-translate-x-0.5" /></div>
                <p className="mt-2 text-[10px] leading-5 text-zinc-500">{item.detail}</p>
              </Link>
            ))}
          </div>
      </section>

      {/* ─── Platform AI spend ─────────────────────────────────── */}
      <section aria-labelledby="ai-overview-title">
        <div className="mb-3 flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-zinc-600" aria-hidden="true" />
          <h2 id="ai-overview-title" className="text-sm font-semibold text-zinc-900">
            مصرف هوش مصنوعی — ۳۰ روز اخیر
          </h2>
          <Link
            href="/admin/ai"
            className="ms-auto inline-flex min-h-10 items-center rounded-lg px-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          >
            مدیریت و جزئیات
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="هزینه واقعی OpenRouter"
            value={`$${aiOverview.providerCostUSD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}`}
            sub={`${fa(aiOverview.pricedRequests)} لاگ دارای هزینه`}
            icon={<CircleDollarSign className="h-5 w-5" />}
            series={kpiTrends.ai.map((point) => point.value)}
          />
          <StatCard
            label="کسر از اعتبار کاربران"
            value={fmtIRR(aiOverview.chargedIRR)}
            sub={`${fa(aiOverview.requests)} پاسخ موفق`}
            icon={<Wallet className="h-5 w-5" />}
            tone="success"
            series={kpiTrends.ai.map((point) => point.value)}
          />
          <StatCard
            label="میانگین کسر هر پاسخ"
            value={fmtIRR(aiOverview.requests > 0 ? Math.round(aiOverview.chargedIRR / aiOverview.requests) : 0)}
            sub="بر اساس پاسخ‌های موفق ثبت‌شده"
            icon={<Activity className="h-5 w-5" />}
            tone="warning"
            series={kpiTrends.ai.map((point) => point.value)}
          />
          <StatCard
            label="پوشش ثبت هزینه"
            value={`${fa(aiOverview.requests > 0 ? Math.round((aiOverview.pricedRequests / aiOverview.requests) * 100) : 0)}٪`}
            sub="سهم پاسخ‌های دارای cost واقعی"
            icon={<BrainCircuit className="h-5 w-5" />}
            tone={aiOverview.requests === 0 || aiOverview.pricedRequests / aiOverview.requests >= 0.95 ? 'success' : 'warning'}
            series={kpiTrends.ai.map((point) => point.value)}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ActivationFunnel title="قیف فعال‌سازی کسب‌وکارها" subtitle="از تکمیل راه‌اندازی تا اولین گفتگو" total={workspaceCount} data={[
          { label: 'راه‌اندازی', value: activation.onboarded },
          { label: 'ساخت ایجنت', value: activation.agentBuilt },
          { label: 'دانش آماده', value: activation.knowledgeReady },
          { label: 'اتصال کانال', value: activation.channelConnected },
          { label: 'اولین گفتگو', value: activation.firstConversation },
        ]} />
        <DonutChart
          title="توزیع پلن‌ها"
          subtitle="ترکیب فعلی کسب‌وکارها"
          data={plans}
          centerValue={workspaceCount}
          centerLabel="کسب‌وکار"
        />
      </div>

      <TrendChart title="گفتگوهای ۷ روز اخیر" subtitle="روند روزانه گفتگوهای جدید پلتفرم" data={kpiTrends.conv} color="#18181b" variant="bar" height={180} />

      <Panel
        title="تصویر عملیاتی پلتفرم"
        subtitle="شاخص‌های تصمیم‌ساز؛ جزئیات هر حوزه در صفحه تخصصی همان بخش"
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'نرخ پاسخ ایجنت', value: `${fa(responseHealth.rate)}٪`, note: `${fa(responseHealth.answered)} از ${fa(responseHealth.total)} گفتگو`, href: '/admin/conversations' },
            { label: 'ایجنت فعال', value: `${fa(agentHealth.active)} / ${fa(agentHealth.total)}`, note: 'آماده پاسخ‌گویی', href: '/admin/agents' },
            { label: 'اتصال فعال', value: `${fa(channelHealth.active)} / ${fa(channelHealth.total)}`, note: `${fa(channelHealth.silent)} اتصال ساکت`, href: '/admin/agents' },
            { label: 'تحویل به اپراتور', value: fa(activeHandoffs), note: 'نیازمند پاسخ انسانی', href: '/admin/conversations?status=HANDED_OFF' },
            { label: 'اعتبار پایین', value: fa(lowCreditWorkspaces), note: 'ریسک توقف پاسخ AI', href: '/admin/workspaces' },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="group rounded-2xl border border-black/[0.065] bg-[var(--bg-surface)] p-4 transition-[border-color,background-color,transform] duration-200 hover:border-black/15 hover:bg-white active:scale-[.99]">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-medium text-black/45">{item.label}</p>
                <ChevronLeft className="h-3.5 w-3.5 text-black/20 transition-transform group-hover:-translate-x-0.5" />
              </div>
              <p className="mt-3 text-xl font-bold tabular-nums text-black">{item.value}</p>
              <p className="mt-1 text-[10px] text-black/40">{item.note}</p>
            </Link>
          ))}
        </div>
      </Panel>

      {/* ─── Charts row 1 ───────────────────────────────────────── */}
      {range === 'monthly' && rangeSeries.monthly ? (
        <MonthlyBarChart
          title="درآمد ماهانه (تومان)"
          subtitle="۱۲ ماه اخیر"
          data={rangeSeries.monthly}
          color="#18181b"
          format="irr"
          height={240}
        />
      ) : rangeSeries.daily ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Revenue chart — uses the EXACT same DashboardPanel + ConversationChart
              pattern as the user dashboard /overview page, so it looks identical.
              Data is converted from admin DailyPoint[] ({day, value}) to
              TrendPoint[] ({label, value}). */}
          <DashboardPanel
            title={`درآمد ${fa(days)} روز اخیر (تومان)`}
            subtitle={fmtIRR(rangeSeries.daily.rev.reduce((s, p) => s + p.value, 0))}
          >
            <ConversationChart
              data={rangeSeries.daily.rev.map((p) => ({ label: p.day, value: p.value }) as TrendPoint)}
            />
          </DashboardPanel>
          <TrendChart
            title={`ثبت‌نام کاربران ${fa(days)} روز اخیر`}
            data={rangeSeries.daily.users}
            color="#18181b"
            variant="bar"
            format="number"
          />
        </div>
      ) : null}

    </div>
  )
}
