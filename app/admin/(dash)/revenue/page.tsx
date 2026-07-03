import {
  TrendingUp,
  Wallet,
  DollarSign,
  Users,
  Percent,
  CheckCircle,
  XCircle,
  Calendar,
} from 'lucide-react'
import {
  PageHeader,
  StatCard,
  Panel,
  Badge,
  Th,
  Td,
  TableShell,
  fmtIRR,
  fmtUSD,
  fa,
} from '../ui'
import { MonthlyBarChart, DonutChart } from '@/components/admin/trend-chart'
import { Sparkline } from '@/components/admin/sparkline'
import { MiniTrend } from '@/components/admin/mini-trend'
import {
  getRevenueKPIs,
  getTopWorkspacesByRevenue,
  getPlanRevenue,
} from '@/lib/admin/revenue'
import {
  revenueIRRMonthly,
  revenueUSDMonthly,
  paymentsMonthly,
  newUsersMonthly,
  planDistribution,
  revenueIRRDaily,
  paymentsDaily,
  paymentsDailyByWorkspace,
} from '@/lib/admin/charts'

export const dynamic = 'force-dynamic'

// ─── BADGE LOOKUPS ────────────────────────────────────────────────

const PLAN_BADGE: Record<
  string,
  { tone: 'muted' | 'info' | 'success' | 'default'; label: string }
> = {
  TRIAL: { tone: 'muted', label: 'آزمایشی' },
  STARTER: { tone: 'info', label: 'استارتر' },
  PRO: { tone: 'success', label: 'حرفه‌ای' },
  BUSINESS: { tone: 'default', label: 'سازمانی' },
}

function PlanBadge({ plan }: { plan: string }) {
  const cfg = PLAN_BADGE[plan] ?? { tone: 'muted' as const, label: plan }
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>
}

// ─── PAGE ─────────────────────────────────────────────────────────

export default async function AdminRevenuePage() {
  const [
    kpi,
    topWorkspaces,
    planRevenue,
    irrMonthly,
    usdMonthly,
    paysMonthly,
    usersMonthly,
    planDist,
    irrTrend7,
    paysTrend7,
    paySparks,
  ] = await Promise.all([
    getRevenueKPIs(),
    getTopWorkspacesByRevenue(6),
    getPlanRevenue(),
    revenueIRRMonthly(12),
    revenueUSDMonthly(12),
    paymentsMonthly(12),
    newUsersMonthly(12),
    planDistribution(),
    revenueIRRDaily(7),
    paymentsDaily(7),
    paymentsDailyByWorkspace(7),
  ])

  // Map plan distribution slices → DonutChart shape
  const donutData = planDist.map((s) => ({ label: s.label, value: s.value }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="درآمد و گزارش‌ها"
        subtitle="تحلیل مالی پلتفرم، MRR و رشد"
        breadcrumbs={[
          { label: 'داشبورد', href: '/admin' },
          { label: 'درآمد' },
        ]}
      />

      {/* KPI row 1 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="MRR (تومان)"
          value={fmtIRR(kpi.mrrIRR)}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="success"
          trend={{ value: kpi.momChange, label: 'نسبت به ماه قبل' }}
        />
        <StatCard
          label="درآمد کل (تومان)"
          value={fmtIRR(kpi.totalIRR)}
          icon={<Wallet className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="درآمد کل (دلار)"
          value={fmtUSD(kpi.totalUSD)}
          icon={<DollarSign className="h-5 w-5" />}
          tone="info"
        />
        <StatCard
          label="ARPU"
          value={fmtIRR(kpi.arpuIRR)}
          icon={<Users className="h-5 w-5" />}
          sub="برای هر کسب‌وکار پرداختی"
        />
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="نرخ تبدیل"
          value={`${kpi.conversionRate.toLocaleString('fa-IR')}٪`}
          icon={<Percent className="h-5 w-5" />}
          tone="success"
          sub={`${kpi.payingWorkspaces.toLocaleString('fa-IR')} از ${kpi.totalWorkspaces.toLocaleString('fa-IR')}`}
        />
        <StatCard
          label="پرداخت‌های موفق"
          value={kpi.paidCount}
          icon={<CheckCircle className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="پرداخت‌های ناموفق"
          value={kpi.failedCount}
          icon={<XCircle className="h-5 w-5" />}
          tone="danger"
        />
        <StatCard
          label="این ماه (تومان)"
          value={fmtIRR(kpi.thisMonthIRR)}
          icon={<Calendar className="h-5 w-5" />}
          sub={`ماه قبل: ${fmtIRR(kpi.lastMonthIRR)}`}
        />
      </div>

      {/* ─── Mini trends: 7-day revenue + payments ─── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MiniTrend
          label="درآمد ۷ روز اخیر (تومان)"
          value={fmtIRR(irrTrend7.reduce((s, p) => s + p.value, 0))}
          series={irrTrend7.map((p) => p.value)}
          color="#22c55e"
          hint="روزانه"
        />
        <MiniTrend
          label="پرداخت‌های ۷ روز اخیر"
          value={paysTrend7.reduce((s, p) => s + p.value, 0)}
          series={paysTrend7.map((p) => p.value)}
          color="#3b82f6"
          hint="تعداد پرداخت موفق"
        />
      </div>

      {/* Main chart — full width */}
      <MonthlyBarChart
        title="درآمد ماهانه (تومان) — ۱۲ ماه اخیر"
        data={irrMonthly}
        color="#18181b"
        format="compact-irr"
      />

      {/* Charts row — IRR USD + payments count */}
      <div className="grid gap-4 lg:grid-cols-2">
        <MonthlyBarChart
          title="درآمد دلاری ماهانه"
          data={usdMonthly}
          color="#3b82f6"
          format="usd"
        />
        <MonthlyBarChart
          title="تعداد پرداخت‌های ماهانه"
          data={paysMonthly}
          color="#22c55e"
          format="number"
        />
      </div>

      {/* Charts row — new users + plan distribution */}
      <div className="grid gap-4 lg:grid-cols-2">
        <MonthlyBarChart
          title="ثبت‌نام کاربران ماهانه"
          data={usersMonthly}
          color="#a855f7"
          format="number"
        />
        <DonutChart
          title="توزیع پلن‌ها"
          data={donutData}
          centerValue={kpi.totalWorkspaces}
          centerLabel="کسب‌وکار"
        />
      </div>

      {/* Bottom row — top workspaces (with sparkline) + plan revenue table */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="پردرآمدترین کسب‌وکارها" subtitle="روند پرداخت ۷ روز اخیر">
          <TableShell>
            <thead className="border-b border-zinc-200 bg-zinc-50/50">
              <tr>
                <Th>کسب‌وکار</Th>
                <Th>پلن</Th>
                <Th>درآمد کل</Th>
                <Th>روند ۷ روز</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {topWorkspaces.map((w) => {
                const spark = paySparks.get(w.id)
                return (
                  <tr key={w.id} className="hover:bg-zinc-50/60">
                    <Td className="font-medium text-zinc-900">{w.name}</Td>
                    <Td>
                      <PlanBadge plan={w.plan} />
                    </Td>
                    <Td className="font-medium tabular-nums">{fmtIRR(w.revenueIRR)}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Sparkline
                          data={spark?.series ?? []}
                          color="#22c55e"
                          width={72}
                          height={24}
                        />
                        <span className="text-[11px] tabular-nums text-zinc-500">
                          {spark ? fa(spark.total) : '۰'}
                        </span>
                      </div>
                    </Td>
                  </tr>
                )
              })}
              {topWorkspaces.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-xs text-zinc-400">
                    پرداختی ثبت نشده است
                  </td>
                </tr>
              )}
            </tbody>
          </TableShell>
        </Panel>

        <Panel title="درآمد به تفکیک پلن">
          <TableShell>
            <thead className="border-b border-zinc-200 bg-zinc-50/50">
              <tr>
                <Th>پلن</Th>
                <Th>کسب‌وکار</Th>
                <Th>پرداخت</Th>
                <Th>درآمد کل</Th>
                <Th>قیمت ماهانه</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {planRevenue.map((row) => (
                <tr key={row.plan} className="hover:bg-zinc-50/60">
                  <Td>
                    <PlanBadge plan={row.plan} />
                  </Td>
                  <Td className="tabular-nums text-zinc-600">
                    {fa(row.workspaceCount)}
                  </Td>
                  <Td className="tabular-nums text-zinc-600">
                    {fa(row.paymentCount)}
                  </Td>
                  <Td className="font-medium tabular-nums">{fmtIRR(row.revenueIRR)}</Td>
                  <Td className="tabular-nums text-zinc-500">{fmtIRR(row.monthlyPriceIRR)}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Panel>
      </div>
    </div>
  )
}
