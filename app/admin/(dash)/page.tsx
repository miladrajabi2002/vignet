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
  PlugZap,
  UserPlus,
} from 'lucide-react'
import {
  PageHeader,
  StatCard,
  fmtIRR,
  fmtUSD,
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
  errorsDailyByLevel,
  newUsersDaily,
  revenueIRRDaily,
  paymentsDaily,
  usageChargesDaily,
  connectionsDaily,
  revenueIRRMonthly,
  planDistribution,
} from '@/lib/admin/charts'
import { getRevenueKPIs, getFinanceSummary } from '@/lib/admin/revenue'
import { getAiOverview } from '@/lib/admin/ai-usage'
import { ADMIN_VISIBLE_RELATED_WHERE, ADMIN_VISIBLE_USER_WHERE, ADMIN_VISIBLE_WORKSPACE_WHERE, getAdminHiddenWorkspaceIds } from '@/lib/admin/reporting-scope'

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
  const hiddenWorkspaceIds = await getAdminHiddenWorkspaceIds()
  const visibleErrorWhere = hiddenWorkspaceIds.length
    ? { OR: [{ workspaceId: null }, { workspaceId: { notIn: hiddenWorkspaceIds } }] }
    : {}

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
    finance,
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
    channelHealth,
    responseHealth,
  ] = await Promise.all([
    getRevenueKPIs(),
    getFinanceSummary(),
    prisma.workspace.count({ where: ADMIN_VISIBLE_WORKSPACE_WHERE }),
    prisma.user.count({ where: ADMIN_VISIBLE_USER_WHERE }),
    prisma.conversation.count({ where: { ...ADMIN_VISIBLE_RELATED_WHERE, createdAt: { gte: startToday } } }),
    prisma.errorLog.count({ where: { AND: [visibleErrorWhere, { createdAt: { gte: since24h }, level: 'error' }] } }),
    planDistribution(),
    rangeSeriesPromise,
    // ─ 7-day series for KPI card sparklines (always 7d, regardless of the
    //   range switch, so the cards always show recent site-wide momentum).
    Promise.all([
      revenueIRRDaily(7),
      conversationsDaily(7),
      newUsersDaily(7),
      errorsDailyByLevel('error', 7),
      paymentsDaily(7),
      usageChargesDaily(7),
      connectionsDaily(7),
    ]).then(([rev, conv, users, err, pays, ai, conns]) => ({
      rev, conv, users, err, pays, ai, conns,
    })),
    getAiOverview(30),
    Promise.all([
      prisma.workspace.count({ where: { ...ADMIN_VISIBLE_WORKSPACE_WHERE, onboardingCompleted: true } }),
      prisma.workspace.count({ where: { ...ADMIN_VISIBLE_WORKSPACE_WHERE, agents: { some: {} } } }),
      prisma.workspace.count({ where: { ...ADMIN_VISIBLE_WORKSPACE_WHERE, agents: { some: { knowledgeBases: { some: { status: 'READY' } } } } } }),
      prisma.workspace.count({ where: { ...ADMIN_VISIBLE_WORKSPACE_WHERE, agents: { some: { channels: { some: { active: true } } } } } }),
      prisma.workspace.count({ where: { ...ADMIN_VISIBLE_WORKSPACE_WHERE, conversations: { some: {} } } }),
    ]).then(([onboarded, agentBuilt, knowledgeReady, channelConnected, firstConversation]) => ({
      onboarded,
      agentBuilt,
      knowledgeReady,
      channelConnected,
      firstConversation,
    })),
    prisma.user.count({ where: { AND: [ADMIN_VISIBLE_USER_WHERE, { workspace: { conversations: { some: { createdAt: { gte: since30d } } } } }] } }),
    prisma.user.count({ where: { ...ADMIN_VISIBLE_USER_WHERE, createdAt: { gte: startToday } } }),
    prisma.payment.aggregate({ where: { ...ADMIN_VISIBLE_RELATED_WHERE, status: 'PAID', currency: 'IRR', paidAt: { gte: startToday } }, _sum: { amount: true } }),
    Promise.all([
      prisma.agentChannel.count({ where: { agent: ADMIN_VISIBLE_RELATED_WHERE } }),
      prisma.agentChannel.count({ where: { agent: ADMIN_VISIBLE_RELATED_WHERE, active: true } }),
      prisma.agentChannel.count({ where: { agent: ADMIN_VISIBLE_RELATED_WHERE, active: true, OR: [{ lastInboundAt: { lt: new Date(Date.now() - 72 * 60 * 60 * 1000) } }, { lastInboundAt: null, createdAt: { lt: new Date(Date.now() - 72 * 60 * 60 * 1000) } }] } }),
    ]).then(([total, active, silent]) => ({ total, active, silent })),
    Promise.all([
      prisma.conversation.count({ where: { ...ADMIN_VISIBLE_RELATED_WHERE, createdAt: { gte: since30d } } }),
      prisma.conversation.count({ where: { ...ADMIN_VISIBLE_RELATED_WHERE, createdAt: { gte: since30d }, messages: { some: { role: 'ASSISTANT' } } } }),
    ]).then(([total, answered]) => ({ total, answered, rate: total > 0 ? Math.round((answered / total) * 100) : 100 })),
  ])

  // ── Net revenue = all collected cash − real AI provider cost ──
  // getFinanceSummary() converts USD payments and the OpenRouter bill with the
  // platform USD→IRR rate. When no rate is configured we still subtract nothing
  // and clearly say so, rather than showing a misleading number.
  const aiCostIRR = finance.openRouterCostIRR ?? 0
  const netRevenueIRR =
    finance.operatingProfitIRR ?? Math.max(0, (finance.cashRevenueIRR ?? revenueKPIs.totalIRR) - aiCostIRR)

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
          seriesLabels={kpiTrends.rev.map((point) => point.day)}
          seriesValueFormat="irr"
        />
        <StatCard
          label="درآمد ماه"
          value={fmtIRR(revenueKPIs.thisMonthIRR)}
          sub={`${fa(revenueKPIs.momChange)}٪ نسبت به ماه قبل`}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="success"
          series={kpiTrends.rev.map((point) => point.value)}
          seriesLabels={kpiTrends.rev.map((point) => point.day)}
          seriesValueFormat="irr"
        />
        <StatCard
          label="درآمد کل (پس از کسر هزینه AI)"
          value={fmtIRR(netRevenueIRR)}
          sub={`کسر هزینه AI: ${fmtUSD(finance.openRouterCostUSD)} · ${fa(revenueKPIs.paidCount)} پرداخت موفق`}
          icon={<CircleDollarSign className="h-5 w-5" />}
          tone={netRevenueIRR >= 0 ? 'success' : 'danger'}
          series={kpiTrends.pays.map((point) => point.value)}
          seriesLabels={kpiTrends.pays.map((point) => point.day)}
        />
        <StatCard
          label="کاربران فعال ۳۰ روزه"
          value={activeUsers}
          sub={`از ${fa(userCount)} کاربر کل`}
          icon={<Activity className="h-5 w-5" />}
          tone="info"
          series={kpiTrends.users.map((point) => point.value)}
          seriesLabels={kpiTrends.users.map((point) => point.day)}
        />
        <StatCard
          label="کاربر جدید امروز"
          value={newUsersToday}
          sub={`${fa(workspaceCount)} کسب‌وکار کل`}
          icon={<UserPlus className="h-5 w-5" />}
          series={kpiTrends.users.map((point) => point.value)}
          seriesLabels={kpiTrends.users.map((point) => point.day)}
        />
        <StatCard
          label="مکالمات امروز"
          value={conversationsToday}
          sub={`${fa(responseHealth.rate)}٪ دارای پاسخ ایجنت`}
          icon={<MessagesSquare className="h-5 w-5" />}
          tone="info"
          series={kpiTrends.conv.map((point) => point.value)}
          seriesLabels={kpiTrends.conv.map((point) => point.day)}
        />
        <StatCard
          label="اتصال فعال"
          value={`${fa(channelHealth.active)} / ${fa(channelHealth.total)}`}
          sub={`${fa(channelHealth.silent)} اتصال ساکت (۷۲ ساعت بدون ورودی)`}
          icon={<PlugZap className="h-5 w-5" />}
          tone={channelHealth.total === 0 || channelHealth.silent / channelHealth.total <= 0.25 ? 'success' : 'warning'}
          series={kpiTrends.conns.map((point) => point.value)}
          seriesLabels={kpiTrends.conns.map((point) => point.day)}
        />
        <StatCard
          label="خطاهای ۲۴ ساعت"
          value={errors24h}
          sub={errors24h > 0 ? 'نیازمند بررسی' : 'وضعیت پایدار'}
          tone={errors24h > 0 ? 'danger' : 'success'}
          icon={<AlertTriangle className="h-5 w-5" />}
          series={kpiTrends.err.map((point) => point.value)}
          seriesLabels={kpiTrends.err.map((point) => point.day)}
        />
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
            seriesLabels={kpiTrends.ai.map((point) => point.day)}
            seriesValueFormat="irr"
          />
          <StatCard
            label="کسر از اعتبار کاربران"
            value={fmtIRR(aiOverview.chargedIRR)}
            sub={`${fa(aiOverview.requests)} پاسخ موفق`}
            icon={<Wallet className="h-5 w-5" />}
            tone="success"
            series={kpiTrends.ai.map((point) => point.value)}
            seriesLabels={kpiTrends.ai.map((point) => point.day)}
            seriesValueFormat="irr"
          />
          <StatCard
            label="میانگین کسر هر پاسخ"
            value={fmtIRR(aiOverview.requests > 0 ? Math.round(aiOverview.chargedIRR / aiOverview.requests) : 0)}
            sub="بر اساس پاسخ‌های موفق ثبت‌شده"
            icon={<Activity className="h-5 w-5" />}
            tone="warning"
            series={kpiTrends.ai.map((point) => point.value)}
            seriesLabels={kpiTrends.ai.map((point) => point.day)}
            seriesValueFormat="irr"
          />
          <StatCard
            label="پوشش ثبت هزینه"
            value={`${fa(aiOverview.requests > 0 ? Math.round((aiOverview.pricedRequests / aiOverview.requests) * 100) : 0)}٪`}
            sub="سهم پاسخ‌های دارای cost واقعی"
            icon={<BrainCircuit className="h-5 w-5" />}
            tone={aiOverview.requests === 0 || aiOverview.pricedRequests / aiOverview.requests >= 0.95 ? 'success' : 'warning'}
            series={kpiTrends.ai.map((point) => point.value)}
            seriesLabels={kpiTrends.ai.map((point) => point.day)}
            seriesValueFormat="irr"
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
