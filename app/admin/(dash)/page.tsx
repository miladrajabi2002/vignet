import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  Wallet,
  MessagesSquare,
  TrendingUp,
  AlertTriangle,
  Activity,
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
  MonthlyBarChart,
  NetRevenueChart,
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
  revenueNetDaily,
  topActiveUsers,
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

/** Relative "last seen" label, e.g. "۳ ساعت پیش", "۲ روز پیش". */
function relativeFromNow(date: Date | null): string {
  if (!date) return '—'
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'همین الان'
  if (minutes < 60) return `${fa(minutes)} دقیقه پیش`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${fa(hours)} ساعت پیش`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${fa(days)} روز پیش`
  const months = Math.floor(days / 30)
  return `${fa(months)} ماه پیش`
}

const PLAN_LABEL: Record<string, string> = {
  TRIAL: 'آزمایشی',
  STARTER: 'استارتر',
  PRO: 'حرفه‌ای',
  BUSINESS: 'سازمانی',
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
  // The revenue chart now uses the credit-based net revenue series.
  const rangeSeriesPromise =
    range === 'monthly'
      ? Promise.resolve(revenueIRRMonthly(12)).then((m) => ({ monthly: m, daily: null as null, netRev: [] as Awaited<ReturnType<typeof revenueNetDaily>> }))
      : Promise.all([
          revenueNetDaily(days),
        ]).then(([netRev]) => ({
          monthly: null as null,
          daily: { rev: netRev, users: [] as Awaited<ReturnType<typeof newUsersDaily>> },
          netRev,
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
    activeUsersList,
    newUsersToday,
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
    // Top 5 active users by conversation count in the last 30 days.
    topActiveUsers(5, 30),
    prisma.user.count({ where: { ...ADMIN_VISIBLE_USER_WHERE, createdAt: { gte: startToday } } }),
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
        <div className="grid grid-cols-2 gap-3 min-[1380px]:grid-cols-4">
        <StatCard
          label="میانگین کسر هر پاسخ"
          value={fmtIRR(aiOverview.requests > 0 ? Math.round(aiOverview.chargedIRR / aiOverview.requests) : 0)}
          sub={`${fa(aiOverview.requests)} پاسخ موفق — ۳۰ روز`}
          icon={<Wallet className="h-5 w-5" />}
          tone="success"
          series={kpiTrends.ai.map((point) => point.value)}
          seriesLabels={kpiTrends.ai.map((point) => point.day)}
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
          label="هزینه OpenRouter"
          value={`$${aiOverview.providerCostUSD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}`}
          sub={`${fa(aiOverview.pricedRequests)} لاگ دارای هزینه — ۳۰ روز`}
          icon={<CircleDollarSign className="h-5 w-5" />}
          tone="warning"
          series={kpiTrends.ai.map((point) => point.value)}
          seriesLabels={kpiTrends.ai.map((point) => point.day)}
          seriesValueFormat="irr"
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

      {/* ─── Active users list (replaces business activation funnel) ─── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section
          aria-labelledby="active-users-title"
          className="spatial-surface rounded-[1.5rem] p-5 sm:p-6"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 id="active-users-title" className="text-sm font-semibold text-zinc-900">
                کاربران فعال
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                ۵ کاربر برتر بر اساس تعداد مکالمه — ۳۰ روز اخیر
              </p>
            </div>
            <Link
              href="/admin/users"
              className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
            >
              همه کاربران
            </Link>
          </div>

          {activeUsersList.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-400">
              در ۳۰ روز اخیر مکالمه‌ای ثبت نشده است.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {activeUsersList.map((user, index) => (
                <li key={user.userId}>
                  <Link
                    href={`/admin/users/${user.userId}`}
                    className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-zinc-50 first:pt-0 last:pb-0"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold text-zinc-700">
                      {fa(index + 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-zinc-900">
                          {user.name || user.phone}
                        </span>
                        <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                          {PLAN_LABEL[user.plan] ?? user.plan}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
                        <span className="truncate">{user.workspaceName}</span>
                        <span className="text-zinc-300">·</span>
                        <span className="shrink-0" dir="ltr">{user.phone}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="text-sm font-bold text-zinc-900">
                        {fa(user.conversationCount)}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {relativeFromNow(user.lastActivityAt)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <DonutChart
          title="توزیع پلن‌ها"
          subtitle="ترکیب فعلی کسب‌وکارها"
          data={plans}
          centerValue={workspaceCount}
          centerLabel="کسب‌وکار"
        />
      </div>

      {/* ─── Charts row: net revenue + conversations side by side ─── */}
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
          <NetRevenueChart
            title={`درآمد ${fa(days)} روز اخیر (تومان)`}
            data={rangeSeries.netRev}
            height={240}
          />
          <DashboardPanel
            title={`گفتگوهای ${fa(days)} روز اخیر`}
            subtitle="روند روزانه گفتگوهای جدید پلتفرم"
          >
            <ConversationChart
              data={kpiTrends.conv.map((p) => ({ label: p.day, value: p.value }) as TrendPoint)}
            />
          </DashboardPanel>
        </div>
      ) : null}

    </div>
  )
}
