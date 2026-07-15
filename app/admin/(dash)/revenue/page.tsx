import {
  TrendingUp,
  Wallet,
  DollarSign,
  Users,
  Percent,
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
import { MonthlyBarChart } from '@/components/admin/trend-chart'
import { Sparkline } from '@/components/admin/sparkline'
import {
  getRevenueKPIs,
  getTopWorkspacesByRevenue,
  getPlanRevenue,
  getFinanceSummary,
} from '@/lib/admin/revenue'
import {
  revenueIRRMonthly,
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
    paySparks,
    finance,
  ] = await Promise.all([
    getRevenueKPIs(),
    getTopWorkspacesByRevenue(6),
    getPlanRevenue(),
    revenueIRRMonthly(12),
    paymentsDailyByWorkspace(7),
    getFinanceSummary(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="درآمد و سود"
        subtitle="تحلیل مالی پلتفرم، MRR و رشد"
        breadcrumbs={[
          { label: 'داشبورد', href: '/admin' },
          { label: 'درآمد' },
        ]}
      />

      <Panel
        title="سود واقعی پلتفرم"
        subtitle="درآمد پلن‌ها + شارژ اعتبارها − هزینه واقعی OpenRouter"
      >
        {!finance.usdToIRR && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
            برای نمایش سود تلفیقی، نرخ صریح <bdi dir="ltr" className="font-mono">FINANCE_USD_TO_IRR</bdi> (ریال به‌ازای هر دلار) را تنظیم کنید. تا آن زمان عدد سود نمایش داده نمی‌شود تا گزارش گمراه‌کننده نباشد.
          </div>
        )}
        {finance.usdToIRR && (
          <p className="mb-4 text-xs text-zinc-500">
            نرخ محاسبه: هر دلار = {fa(finance.usdToIRR)} ریال
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard
            label="درآمد پلن‌ها"
            value={fmtIRR(finance.planRevenueIRR)}
            icon={<TrendingUp className="h-5 w-5" />}
            tone="success"
            sub={`به‌علاوه ${fmtUSD(finance.planRevenueUSD)} پرداخت ارزی`}
          />
          <StatCard
            label="شارژ اعتبارها"
            value={fmtIRR(finance.creditTopupIRR)}
            icon={<Wallet className="h-5 w-5" />}
            tone="info"
            sub={finance.creditTopupUSD > 0 ? `به‌علاوه ${fmtUSD(finance.creditTopupUSD)}` : 'فقط پرداخت نقدی؛ هدیه جداست'}
          />
          <StatCard
            label="هزینه OpenRouter"
            value={fmtUSD(finance.openRouterCostUSD)}
            icon={<DollarSign className="h-5 w-5" />}
            sub={finance.openRouterCostIRR == null ? 'نیازمند نرخ تبدیل' : fmtIRR(finance.openRouterCostIRR)}
          />
          <StatCard
            label="سود عملیاتی"
            value={finance.operatingProfitIRR == null ? 'نرخ تنظیم نشده' : fmtIRR(finance.operatingProfitIRR)}
            icon={<Percent className="h-5 w-5" />}
            tone={finance.operatingProfitIRR != null && finance.operatingProfitIRR >= 0 ? 'success' : 'danger'}
            sub="قبل از کسر اعتبار هدیه"
          />
          <StatCard
            label="اعتبار هدیه صادرشده"
            value={fmtIRR(finance.giftedCreditIRR)}
            icon={<Wallet className="h-5 w-5" />}
            sub="تعهد/یارانه با ارزش اسمی"
          />
          <StatCard
            label="سود تعدیل‌شده محافظه‌کارانه"
            value={finance.adjustedProfitIRR == null ? 'نرخ تنظیم نشده' : fmtIRR(finance.adjustedProfitIRR)}
            icon={<TrendingUp className="h-5 w-5" />}
            tone={finance.adjustedProfitIRR != null && finance.adjustedProfitIRR >= 0 ? 'success' : 'danger'}
            sub="سود عملیاتی منهای کل اعتبار هدیه"
          />
        </div>
      </Panel>

      {/* Commercial growth KPIs — transaction detail belongs to Payments. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="MRR (تومان)"
          value={fmtIRR(kpi.mrrIRR)}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="success"
          trend={{ value: kpi.momChange, label: 'نسبت به ماه قبل' }}
        />
        <StatCard
          label="درآمد این ماه"
          value={fmtIRR(kpi.thisMonthIRR)}
          icon={<Wallet className="h-5 w-5" />}
          tone="success"
          sub={`ماه قبل: ${fmtIRR(kpi.lastMonthIRR)}`}
        />
        <StatCard
          label="ARPU"
          value={fmtIRR(kpi.arpuIRR)}
          icon={<Users className="h-5 w-5" />}
          sub="برای هر کسب‌وکار پرداختی"
        />
        <StatCard
          label="نرخ تبدیل"
          value={`${kpi.conversionRate.toLocaleString('fa-IR')}٪`}
          icon={<Percent className="h-5 w-5" />}
          tone="success"
          sub={`${kpi.payingWorkspaces.toLocaleString('fa-IR')} از ${kpi.totalWorkspaces.toLocaleString('fa-IR')}`}
        />
      </div>

      {/* Main chart — full width */}
      <MonthlyBarChart
        title="درآمد ماهانه (تومان) — ۱۲ ماه اخیر"
        data={irrMonthly}
        color="#18181b"
        format="compact-irr"
      />


      {/* Bottom row — top workspaces (with sparkline) + plan revenue table */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="پردرآمدترین کسب‌وکارها" subtitle="روند پرداخت ۷ روز اخیر">
          <TableShell minWidth={0}>
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
                    <Td className="max-w-32 truncate font-medium text-zinc-900">{w.name}</Td>
                    <Td>
                      <PlanBadge plan={w.plan} />
                    </Td>
                    <Td className="font-medium tabular-nums">{fmtIRR(w.revenueIRR)}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Sparkline
                          data={spark?.series ?? []}
                          color="#18181b"
                          width={58}
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
          <TableShell minWidth={0}>
            <thead className="border-b border-zinc-200 bg-zinc-50/50">
              <tr>
                <Th>پلن</Th>
                <Th className="px-2 text-[11px]">کسب‌وکار</Th>
                <Th className="px-2 text-[11px]">پرداخت</Th>
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
                  <Td className="px-2 text-center tabular-nums text-zinc-600">
                    {fa(row.workspaceCount)}
                  </Td>
                  <Td className="px-2 text-center tabular-nums text-zinc-600">
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
