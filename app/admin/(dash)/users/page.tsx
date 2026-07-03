import { prisma } from '@/lib/prisma'
import {
  Wallet,
  Building2,
  MessagesSquare,
  TrendingUp,
  Users,
  Bot,
  AlertTriangle,
  CreditCard,
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
import { TrendChart, DonutChart, BarList } from '@/components/admin/trend-chart'
import {
  conversationsDaily,
  errorsDaily,
  newUsersDaily,
  revenueIRRDaily,
  planDistribution,
  gatewayBreakdown,
  channelBreakdown,
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

export default async function AdminOverviewPage() {
  const startToday = startOfToday()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [
    revenueKPIs,
    workspaceCount,
    userCount,
    activeAgents,
    conversationsToday,
    errors24h,
    recentErrors,
    recentPayments,
    revenueTrend,
    usersTrend,
    convTrend,
    errTrend,
    plans,
    gateways,
    channels,
  ] = await Promise.all([
    getRevenueKPIs(),
    prisma.workspace.count(),
    prisma.user.count(),
    prisma.agent.count({ where: { active: true } }),
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
    revenueIRRDaily(14),
    newUsersDaily(14),
    conversationsDaily(14),
    errorsDaily(14),
    planDistribution(),
    gatewayBreakdown(),
    channelBreakdown(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title="داشبورد" subtitle="نمای کلی وضعیت پلتفرم ویجنت" />

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
          label="ایجنت‌های فعال"
          value={activeAgents}
          icon={<Bot className="h-5 w-5" />}
        />
        <StatCard
          label="خطاهای ۲۴ ساعت"
          value={errors24h}
          tone={errors24h > 0 ? 'danger' : 'default'}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard
          label="MRR"
          value={fmtIRR(revenueKPIs.mrrIRR)}
          icon={<CreditCard className="h-5 w-5" />}
          tone="success"
        />
      </div>

      {/* ─── Charts row 1 ───────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart
          title="درآمد ۱۴ روز اخیر (تومان)"
          data={revenueTrend}
          color="#18181b"
          variant="area"
          format="irr"
        />
        <TrendChart
          title="ثبت‌نام کاربران ۱۴ روز اخیر"
          data={usersTrend}
          color="#3b82f6"
          variant="bar"
          format="number"
        />
      </div>

      {/* ─── Charts row 2 ───────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart
          title="مکالمات ۱۴ روز اخیر"
          data={convTrend}
          color="#22c55e"
          variant="bar"
        />
        <TrendChart
          title="خطاهای ۱۴ روز اخیر"
          data={errTrend}
          color="#ef4444"
          variant="bar"
        />
      </div>

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
    </div>
  )
}
