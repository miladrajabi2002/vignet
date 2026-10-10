import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  Wallet,
  MessagesSquare,
  TrendingUp,
  AlertTriangle,
  CircleDollarSign,
  Coins,
  LayoutDashboard,
  PlugZap,
  UserPlus,
  Clock3,
} from 'lucide-react'
import {
  Badge,
  PageHeader,
  Panel,
  StatCard,
  fmtIRR,
  fmtUSD,
  fa,
} from './ui'
import {
  MonthlyBarChart,
  NetRevenueChart,
  TrendChart,
} from '@/components/admin/trend-chart'
import { CHART_ACCENT } from '@/components/admin/chart-palette'
import { RangeSwitch, type RangeKind } from '@/components/admin/range-switch'
import { PlanMixPanel } from '@/components/admin/plan-mix-panel'
import {
  conversationsDaily,
  conversationsMonthly,
  errorsDailyByLevel,
  newUsersDaily,
  revenueIRRDaily,
  paymentsDaily,
  usageChargesDaily,
  providerCostUSDDaily,
  connectionsDaily,
  revenueIRRMonthly,
  planMix,
  revenueNetDaily,
  topActiveUsers,
} from '@/lib/admin/charts'
import { getRevenueKPIs, getFinanceSummary } from '@/lib/admin/revenue'
import { getAiOverview, getOpenRouterAccountUsage } from '@/lib/admin/ai-usage'
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
  BUSINESS: 'بیزینس',
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
  // Revenue and conversations both follow the selected range so the
  // ۷/۳۰/ماهانه switch visibly changes every chart below.
  const rangeSeriesPromise =
    range === 'monthly'
      ? Promise.all([
          revenueIRRMonthly(12),
          conversationsMonthly(12),
        ]).then(([m, convM]) => ({
          monthly: m,
          monthlyConversations: convM,
          daily: null as null,
          netRev: [] as Awaited<ReturnType<typeof revenueNetDaily>>,
          conversations: [] as Awaited<ReturnType<typeof conversationsDaily>>,
        }))
      : Promise.all([
          revenueNetDaily(days),
          conversationsDaily(days),
        ]).then(([netRev, conv]) => ({
          monthly: null as null,
          monthlyConversations: [] as Awaited<ReturnType<typeof conversationsMonthly>>,
          daily: { rev: netRev, users: [] as Awaited<ReturnType<typeof newUsersDaily>> },
          netRev,
          conversations: conv,
        }))

  const [
    revenueKPIs,
    finance,
    workspaceCount,
    conversationsToday,
    errors24h,
    planMixRows,
    rangeSeries,
    kpiTrends,
    aiOverview,
    openRouterAccount,
    activeUsersList,
    newUsersToday,
    channelHealth,
    responseHealth,
  ] = await Promise.all([
    getRevenueKPIs(),
    getFinanceSummary(),
    prisma.workspace.count({ where: ADMIN_VISIBLE_WORKSPACE_WHERE }),
    prisma.conversation.count({ where: { ...ADMIN_VISIBLE_RELATED_WHERE, createdAt: { gte: startToday } } }),
    prisma.errorLog.count({ where: { AND: [visibleErrorWhere, { createdAt: { gte: since24h }, level: 'error' }] } }),
    planMix(),
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
      providerCostUSDDaily(7),
    ]).then(([rev, conv, users, err, pays, ai, conns, orCost]) => ({
      rev, conv, users, err, pays, ai, conns, orCost,
    })),
    getAiOverview(30),
    getOpenRouterAccountUsage(),
    // Top 5 most recently active users in the last 30 days.
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

  // ── OpenRouter wallet balance (live from the OpenRouter API) ──
  // Replaces the old "هزینه OpenRouter" card: operators care about how much
  // credit is LEFT before inference breaks, not just what was spent.
  const orStatus = openRouterAccount.status
  const orRemaining = openRouterAccount.totalCreditsRemainingUSD
  const orTotal = openRouterAccount.totalCreditsUSD
  const orUsed = openRouterAccount.totalCreditsUsedUSD
  const openRouterBalanceValue =
    orStatus === 'connected' && orRemaining !== null ? fmtUSD(orRemaining) : '—'
  const openRouterBalanceSub =
    orStatus === 'connected' && orRemaining !== null
      ? orTotal !== null && orUsed !== null
        ? `مصرف‌شده ${fmtUSD(orUsed)} از ${fmtUSD(orTotal)} اعتبار حساب`
        : `مصرف ۳۰ روز: ${fmtUSD(aiOverview.providerCostUSD)}`
      : orStatus === 'unavailable'
        ? `دریافت موجودی ناموفق بود · مصرف ۳۰ روز: ${fmtUSD(aiOverview.providerCostUSD)}`
        : 'کلید OpenRouter تنظیم نشده است'
  const openRouterBalanceTone: 'success' | 'warning' | 'danger' =
    orStatus !== 'connected' || orRemaining === null
      ? 'warning'
      : orRemaining <= 1
        ? 'danger'
        : orRemaining <= 5
          ? 'warning'
          : 'success'

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
        icon={LayoutDashboard}
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
          icon={<Coins className="h-5 w-5" />}
          tone="info"
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
          label="موجودی OpenRouter"
          value={openRouterBalanceValue}
          sub={openRouterBalanceSub}
          icon={<Wallet className="h-5 w-5" />}
          tone={openRouterBalanceTone}
          series={kpiTrends.orCost.map((point) => point.value)}
          seriesLabels={kpiTrends.orCost.map((point) => point.day)}
          seriesValueFormat="usd"
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

      {/* ─── Active users list + customers and revenue per plan ─── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="کاربران فعال"
          subtitle="برترین کاربران بر اساس آخرین گفتگو — ۳۰ روز اخیر"
          href="/admin/users"
          linkLabel="همه کاربران"
          className="flex h-full flex-col"
        >
          {activeUsersList.length === 0 ? (
            <p className="flex flex-1 items-center justify-center py-10 text-center text-xs text-[var(--text-muted)]">
              در ۳۰ روز اخیر گفتگویی ثبت نشده است.
            </p>
          ) : (
            <ul className="-mx-2 flex flex-1 flex-col divide-y divide-[var(--border-subtle)]" aria-label="رتبه‌بندی کاربران فعال">
              {activeUsersList.map((user, index) => {
                const displayName = user.name || user.phone
                const showWorkspace = user.workspaceName !== displayName

                return (
                  <li key={user.userId} className="flex min-h-[4rem] flex-1 items-stretch">
                    <Link
                      href={`/admin/users/${user.userId}`}
                      className="grid w-full grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-control px-2 py-2 transition-colors hover:bg-[var(--bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-chip text-xs font-bold tabular-nums ${index === 0 ? 'bg-[#111] text-white' : 'bg-[var(--bg-muted)] text-[var(--text-secondary)]'}`}>
                        {fa(index + 1)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                            {displayName}
                          </span>
                          <Badge tone="muted" className="shrink-0">{PLAN_LABEL[user.plan] ?? user.plan}</Badge>
                        </div>
                        {(showWorkspace || user.name) && (
                          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
                            {showWorkspace && (
                              <>
                                <span className="truncate">{user.workspaceName}</span>
                                {user.name && <span aria-hidden className="text-[var(--text-hint)]">·</span>}
                              </>
                            )}
                            {user.name && <bdi dir="ltr" className="shrink-0 tabular-nums">{user.phone}</bdi>}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="inline-flex items-baseline gap-1 text-[var(--text-primary)]">
                          <strong className="text-sm font-bold tabular-nums">{fa(user.conversationCount)}</strong>
                          <span className="text-[12px] text-[var(--text-muted)]">مکالمه</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[12px] text-[var(--text-muted)]" title="آخرین گفتگو">
                          <Clock3 className="h-3 w-3" aria-hidden="true" />
                          {relativeFromNow(user.lastActivityAt)}
                        </span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <PlanMixPanel rows={planMixRows} />
      </div>

      {/* ─── Charts row: net revenue + conversations side by side ─── */}
      {range === 'monthly' && rangeSeries.monthly ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <MonthlyBarChart
            title="درآمد ماهانه (تومان)"
            subtitle="۱۲ ماه اخیر"
            data={rangeSeries.monthly}
            format="irr"
            height={240}
          />
          <MonthlyBarChart
            title="گفتگوهای ماهانه"
            subtitle="گفتگوهای جدید پلتفرم — ۱۲ ماه اخیر"
            data={rangeSeries.monthlyConversations}
            color={CHART_ACCENT}
            height={240}
          />
        </div>
      ) : rangeSeries.daily ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <NetRevenueChart
            title={`درآمد ${fa(days)} روز اخیر (تومان)`}
            data={rangeSeries.netRev}
            height={240}
          />
          <TrendChart
            title={`گفتگوهای ${fa(days)} روز اخیر`}
            subtitle="روند روزانه گفتگوهای جدید پلتفرم"
            data={rangeSeries.conversations}
            color={CHART_ACCENT}
            variant="area"
            height={240}
          />
        </div>
      ) : null}

    </div>
  )
}
