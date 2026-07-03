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
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="داشبورد"
        subtitle="نمای کلی وضعیت پلتفرم ویجنت"
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

      {/* ─── Trends strip: 8 sparklines in one row ──────────────── */}
      {/*    Shows site-wide momentum at a glance: green = progressing,
            gray = flat, red = declining. Errors are inverted (up = bad). */}
      <TrendsStrip
        tiles={[
          { label: 'درآمد', series: kpiTrends.rev.map((p) => p.value) },
          { label: 'کسب‌وکار جدید', series: kpiTrends.ws.map((p) => p.value) },
          { label: 'مکالمات', series: kpiTrends.conv.map((p) => p.value) },
          { label: 'تبدیل جدید', series: kpiTrends.pays.map((p) => p.value) },
          { label: 'کاربر جدید', series: kpiTrends.users.map((p) => p.value) },
          { label: 'پرداخت جدید', series: kpiTrends.pays.map((p) => p.value) },
          { label: 'خطاها', series: kpiTrends.err.map((p) => p.value), invert: true },
          { label: 'MRR روند', series: kpiTrends.rev.map((p) => p.value) },
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
          <TrendChart
            title={`درآمد ${fa(days)} روز اخیر (تومان)`}
            data={rangeSeries.daily.rev}
            color="#18181b"
            variant="area"
            format="irr"
          />
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
                      <Badge tone={PLAN_TONES[p.plan] ?? 'muted'}>
                        {PLAN_LABELS[p.plan] ?? p.plan}
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
