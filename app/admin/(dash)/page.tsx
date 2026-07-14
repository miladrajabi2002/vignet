import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  Wallet,
  Building2,
  MessagesSquare,
  TrendingUp,
  Users,
  AlertTriangle,
  CreditCard,
  Repeat,
  Activity,
  BrainCircuit,
  CircleDollarSign,
} from 'lucide-react'
import {
  PageHeader,
  StatCard,
  Panel,
  EmptyState,
  LevelBadge,
  Badge,
  fmtDate,
  fmtIRR,
  fmtUSD,
  fa,
} from './ui'
import {
  TrendChart,
  DonutChart,
  BarList,
  MonthlyBarChart,
} from '@/components/admin/trend-chart'
import { DashboardPanel } from '@/components/dashboard/panel'
import { ConversationChart } from '@/components/dashboard/charts/lazy'
import type { TrendPoint } from '@/components/dashboard/charts/conversation-chart'
import { RangeSwitch, type RangeKind } from '@/components/admin/range-switch'
import { ServerStatsWidget } from '@/components/admin/server-stats-widget'
import { TrendsStrip } from '@/components/admin/trends-strip'
import {
  conversationsDaily,
  errorsDaily,
  newUsersDaily,
  newWorkspacesDaily,
  revenueIRRDaily,
  paymentsDaily,
  planDistribution,
  gatewayBreakdown,
  channelBreakdown,
  revenueIRRMonthly,
} from '@/lib/admin/charts'
import { getRevenueKPIs } from '@/lib/admin/revenue'
import { getAiOverview } from '@/lib/admin/ai-usage'
import { VigentoAdminConsole } from '@/components/admin/vigento-admin-console'

export const dynamic = 'force-dynamic'

const PLAN_LABELS: Record<string, string> = {
  TRIAL: 'آزمایشی',
  STARTER: 'استارتر',
  PRO: 'حرفه‌ای',
  BUSINESS: 'سازمانی',
}

const PLAN_TONES: Record<string, 'muted' | 'info' | 'success' | 'default'> = {
  TRIAL: 'muted',
  STARTER: 'info',
  PRO: 'success',
  BUSINESS: 'default',
}

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

  // Range-dependent series — only fetch what the selected range needs.
  const rangeSeriesPromise =
    range === 'monthly'
      ? Promise.resolve(revenueIRRMonthly(12)).then((m) => ({ monthly: m, daily: null as null }))
      : Promise.all([
          revenueIRRDaily(days),
          conversationsDaily(days),
          newUsersDaily(days),
          errorsDaily(days),
        ]).then(([rev, conv, users, err]) => ({
          monthly: null as null,
          daily: { rev, conv, users, err },
        }))

  const [
    revenueKPIs,
    workspaceCount,
    userCount,
    conversationsToday,
    errors24h,
    recentErrors,
    recentPayments,
    rangeSeries,
    plans,
    gateways,
    channels,
    kpiTrends,
    aiOverview,
  ] = await Promise.all([
    getRevenueKPIs(),
    prisma.workspace.count(),
    prisma.user.count(),
    prisma.conversation.count({ where: { createdAt: { gte: startToday } } }),
    prisma.errorLog.count({ where: { createdAt: { gte: since24h } } }),
    prisma.errorLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        source: true,
        message: true,
        level: true,
        createdAt: true,
      },
    }),
    prisma.payment.findMany({
      where: { status: 'PAID' },
      orderBy: { paidAt: 'desc' },
      take: 5,
      include: { workspace: { select: { name: true } } },
    }),
    rangeSeriesPromise,
    planDistribution(),
    gatewayBreakdown(),
    channelBreakdown(),
    // ─ 7-day series for KPI card sparklines (always 7d, regardless of the
    //   range switch, so the cards always show recent site-wide momentum).
    Promise.all([
      revenueIRRDaily(7),
      newWorkspacesDaily(7),
      conversationsDaily(7),
      newUsersDaily(7),
      errorsDaily(7),
      paymentsDaily(7),
    ]).then(([rev, ws, conv, users, err, pays]) => ({
      rev, ws, conv, users, err, pays,
    })),
    getAiOverview(30),
  ])

  return (
    <div className="space-y-6">
      <VigentoAdminConsole />

      <PageHeader
        title="نبض پلتفرم"
        subtitle="نمای یکپارچه عملکرد، درآمد و سلامت Vigento AI"
        icon={Activity}
        action={<RangeSwitch current={range} />}
      />

      {/* ─── Top KPI row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="درآمد کل"
          value={fmtIRR(revenueKPIs.totalIRR)}
          icon={<Wallet className="h-5 w-5" />}
          tone="success"
          trend={{ value: revenueKPIs.momChange, label: 'نسبت به ماه قبل' }}
        />
        <StatCard
          label="کسب‌وکارهای فعال"
          value={workspaceCount}
          sub="از کل کاربران"
          icon={<Building2 className="h-5 w-5" />}
        />
        <StatCard
          label="مکالمات امروز"
          value={conversationsToday}
          icon={<MessagesSquare className="h-5 w-5" />}
          tone="info"
        />
        <StatCard
          label="نرخ تبدیل"
          value={`${fa(revenueKPIs.conversionRate)}٪`}
          sub={`${fa(revenueKPIs.payingWorkspaces)} پرداختی`}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="success"
        />
      </div>

      {/* ─── Second KPI row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="کاربران کل"
          value={userCount}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="اشتراک‌های فعال"
          value={revenueKPIs.activeSubscriptions}
          sub="اشتراک‌های در حال اعتبار"
          icon={<Repeat className="h-5 w-5" />}
          tone="success"
          trend={{ value: revenueKPIs.subWeekChange, label: 'هفته اخیر' }}
        />
        <StatCard
          label="خطاهای ۲۴ ساعت"
          value={errors24h}
          tone={errors24h > 0 ? 'danger' : 'default'}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard
          label="درآمد ماهانه تکرارشونده"
          value={fmtIRR(revenueKPIs.mrrIRR)}
          sub="مجموع اشتراک‌های فعال"
          icon={<CreditCard className="h-5 w-5" />}
          tone="success"
        />
      </div>

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
          />
          <StatCard
            label="کسر از اعتبار کاربران"
            value={fmtIRR(aiOverview.chargedIRR)}
            sub={`${fa(aiOverview.requests)} پاسخ موفق`}
            icon={<Wallet className="h-5 w-5" />}
            tone="success"
          />
          <StatCard
            label="میانگین کسر هر پاسخ"
            value={fmtIRR(aiOverview.requests > 0 ? Math.round(aiOverview.chargedIRR / aiOverview.requests) : 0)}
            sub="بر اساس پاسخ‌های موفق ثبت‌شده"
            icon={<Activity className="h-5 w-5" />}
            tone="warning"
          />
          <StatCard
            label="پوشش ثبت هزینه"
            value={`${fa(aiOverview.requests > 0 ? Math.round((aiOverview.pricedRequests / aiOverview.requests) * 100) : 0)}٪`}
            sub="سهم پاسخ‌های دارای cost واقعی"
            icon={<BrainCircuit className="h-5 w-5" />}
            tone={aiOverview.requests === 0 || aiOverview.pricedRequests / aiOverview.requests >= 0.95 ? 'success' : 'warning'}
          />
        </div>
      </section>

      {/* ─── Trends strip: distinct 7-day sparklines ────────────── */}
      {/*    Shows site-wide momentum at a glance: green = progressing,
            gray = flat, red = declining. Errors are inverted (up = bad).
            One tile per distinct series — no duplicated charts. */}
      <TrendsStrip
        tiles={[
          { label: 'درآمد', series: kpiTrends.rev.map((p) => p.value) },
          { label: 'کسب‌وکار جدید', series: kpiTrends.ws.map((p) => p.value) },
          { label: 'کاربر جدید', series: kpiTrends.users.map((p) => p.value) },
          { label: 'مکالمات', series: kpiTrends.conv.map((p) => p.value) },
          { label: 'پرداخت جدید', series: kpiTrends.pays.map((p) => p.value) },
          { label: 'خطاها', series: kpiTrends.err.map((p) => p.value), invert: true },
        ]}
      />

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
            color="#22c55e"
            variant="bar"
            format="number"
          />
        </div>
      ) : null}

      {/* ─── Charts row 2 ───────────────────────────────────────── */}
      {range !== 'monthly' && rangeSeries.daily && (
        <div className="grid gap-4 lg:grid-cols-2">
          <TrendChart
            title={`مکالمات ${fa(days)} روز اخیر`}
            data={rangeSeries.daily.conv}
            color="#3b82f6"
            variant="bar"
          />
          <TrendChart
            title={`خطاهای ${fa(days)} روز اخیر`}
            data={rangeSeries.daily.err}
            color="#ef4444"
            variant="bar"
          />
        </div>
      )}

      {/* ─── Distribution row ───────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <DonutChart
          title="توزیع پلن‌ها"
          data={plans}
          centerValue={workspaceCount}
          centerLabel="کسب‌وکار"
        />
        <DonutChart
          title="درگاه‌های پرداخت"
          data={gateways}
          centerValue={revenueKPIs.paidCount}
          centerLabel="پرداخت موفق"
        />
        <BarList
          title="پربازدیدترین کانال‌ها"
          data={channels.map((c) => ({ label: c.label, value: c.value }))}
          format="number"
        />
      </div>

      {/* ─── Bottom row: recent errors + payments ───────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="آخرین خطاها" href="/admin/errors" linkLabel="همه خطاها">
          {recentErrors.length === 0 ? (
            <EmptyState icon={<AlertTriangle className="h-8 w-8" />}>
              خطایی ثبت نشده
            </EmptyState>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {recentErrors.map((e) => (
                <li key={e.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <LevelBadge level={e.level} />
                    <span className="truncate text-xs text-zinc-500">
                      {e.source ?? '—'}
                    </span>
                    <span className="ms-auto shrink-0 text-[11px] text-zinc-400">
                      {fmtDate(e.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-zinc-700">{e.message}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="آخرین پرداخت‌ها" href="/admin/payments" linkLabel="همه پرداخت‌ها">
          {recentPayments.length === 0 ? (
            <EmptyState icon={<CreditCard className="h-8 w-8" />}>
              پرداختی ثبت نشده
            </EmptyState>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {recentPayments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-zinc-900">
                        {p.workspace.name}
                      </span>
                      <Badge tone={p.kind === 'AI_CREDIT' || !p.plan ? 'info' : (PLAN_TONES[p.plan] ?? 'muted')}>
                        {p.kind === 'AI_CREDIT' || !p.plan
                          ? 'اعتبار هوش مصنوعی'
                          : (PLAN_LABELS[p.plan] ?? p.plan)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-zinc-400">
                      {fmtDate(p.paidAt ?? p.createdAt)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-zinc-900">
                    {p.currency === 'IRR' ? fmtIRR(p.amount) : fmtUSD(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ─── Live server resources (CPU + RAM) ──────────────────── */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-900">منابع سرور</h2>
          <span className="text-[11px] text-zinc-400">به‌روزرسانی هر ۵ ثانیه</span>
        </div>
        <ServerStatsWidget />
      </div>
    </div>
  )
}
