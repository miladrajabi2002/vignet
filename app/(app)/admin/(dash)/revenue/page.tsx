import Link from 'next/link'
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
import { CHART_ACCENT } from '@/components/admin/chart-palette'
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
  BUSINESS: { tone: 'default', label: 'بیزینس' },
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
        icon={TrendingUp}
      />

      <Panel
        title="سود واقعی پلتفرم"
        subtitle="درآمد پلن‌ها + شارژ اعتبارها − هزینه واقعی OpenRouter"
      >
        {!finance.usdToIRR && (
          <div className="mb-4 rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
            برای نمایش سود تلفیقی، «نرخ هر دلار آمریکا» را در <Link href="/admin/settings" className="font-semibold underline underline-offset-2">تنظیمات پلتفرم</Link> وارد کنید. تا آن زمان عدد سود نمایش داده نمی‌شود تا گزارش گمراه‌کننده نباشد.
          </div>
        )}
        {finance.usdToIRR && (
          <p className="mb-4 text-xs text-[var(--text-muted)]">
            نرخ محاسبه: هر دلار = {fa(Math.round(finance.usdToIRR / 10))} تومان
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
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
            value={finance.operatingProfitIRR == null ? '—' : fmtIRR(finance.operatingProfitIRR)}
            icon={<Percent className="h-5 w-5" />}
            tone={finance.operatingProfitIRR == null ? 'warning' : finance.operatingProfitIRR >= 0 ? 'success' : 'danger'}
            sub={finance.operatingProfitIRR == null ? 'نرخ دلار تنظیم نشده · قبل از کسر اعتبار هدیه' : 'قبل از کسر اعتبار هدیه'}
          />
          <StatCard
            label="اعتبار هدیه صادرشده"
            value={fmtIRR(finance.giftedCreditIRR)}
            icon={<Wallet className="h-5 w-5" />}
            sub="تعهد/یارانه با ارزش اسمی"
          />
          <StatCard
            label="سود تعدیل‌شده محافظه‌کارانه"
            value={finance.adjustedProfitIRR == null ? '—' : fmtIRR(finance.adjustedProfitIRR)}
            icon={<TrendingUp className="h-5 w-5" />}
            tone={finance.adjustedProfitIRR == null ? 'warning' : finance.adjustedProfitIRR >= 0 ? 'success' : 'danger'}
            sub={finance.adjustedProfitIRR == null ? 'نرخ دلار تنظیم نشده · منهای کل اعتبار هدیه' : 'سود عملیاتی منهای کل اعتبار هدیه'}
          />
        </div>
      </Panel>

      {/* Commercial growth KPIs — transaction detail belongs to Payments. */}
      <div className="grid grid-cols-2 gap-3 min-[1380px]:grid-cols-4">
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
        format="compact-irr"
      />


      {/* Bottom row — top workspaces (with sparkline) + plan revenue table */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="پردرآمدترین کسب‌وکارها" subtitle="روند پرداخت ۷ روز اخیر">
          <div className="grid gap-2 md:hidden">
            {topWorkspaces.map((workspace) => {
              const spark = paySparks.get(workspace.id)
              return (
                <article key={workspace.id} className="rounded-control bg-[var(--bg-surface)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 truncate text-xs font-bold text-[var(--text-primary)]">{workspace.name}</h3>
                    <PlanBadge plan={workspace.plan} />
                  </div>
                  <p className="mt-3 text-lg font-bold tabular-nums text-[var(--text-primary)]">{fmtIRR(workspace.revenueIRR)}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[12px] text-[var(--text-muted)]">
                    <span>روند ۷ روز</span>
                    <span className="flex items-center gap-2"><Sparkline data={spark?.series ?? []} color={CHART_ACCENT} width={82} height={24} />{spark ? fa(spark.total) : '۰'}</span>
                  </div>
                </article>
              )
            })}
            {topWorkspaces.length === 0 && <p className="py-8 text-center text-xs text-[var(--text-muted)]">پرداختی ثبت نشده است</p>}
          </div>
          <div className="hidden md:block">
          <TableShell minWidth={0} bare>
            <thead>
              <tr>
                <Th>کسب‌وکار</Th>
                <Th>پلن</Th>
                <Th>درآمد کل</Th>
                <Th>روند ۷ روز</Th>
              </tr>
            </thead>
            <tbody>
              {topWorkspaces.map((w) => {
                const spark = paySparks.get(w.id)
                return (
                  <tr key={w.id}>
                    <Td className="max-w-32 truncate font-medium text-[var(--text-primary)]">{w.name}</Td>
                    <Td>
                      <PlanBadge plan={w.plan} />
                    </Td>
                    <Td className="font-medium tabular-nums">{fmtIRR(w.revenueIRR)}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Sparkline
                          data={spark?.series ?? []}
                          color={CHART_ACCENT}
                          width={58}
                          height={24}
                        />
                        <span className="text-[12px] tabular-nums text-[var(--text-muted)]">
                          {spark ? fa(spark.total) : '۰'}
                        </span>
                      </div>
                    </Td>
                  </tr>
                )
              })}
              {topWorkspaces.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
                    پرداختی ثبت نشده است
                  </td>
                </tr>
              )}
            </tbody>
          </TableShell>
          </div>
        </Panel>

        <Panel title="درآمد به تفکیک پلن">
          <div className="grid gap-2 md:hidden">
            {planRevenue.map((row) => (
              <article key={row.plan} className="rounded-control bg-[var(--bg-surface)] p-3">
                <div className="flex items-center justify-between gap-2"><PlanBadge plan={row.plan} /><strong className="text-sm tabular-nums text-[var(--text-primary)]">{fmtIRR(row.revenueIRR)}</strong></div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div><dt className="text-[12px] text-[var(--text-muted)]">کسب‌وکار</dt><dd className="mt-1 text-xs font-bold">{fa(row.workspaceCount)}</dd></div>
                  <div><dt className="text-[12px] text-[var(--text-muted)]">پرداخت</dt><dd className="mt-1 text-xs font-bold">{fa(row.paymentCount)}</dd></div>
                  <div><dt className="text-[12px] text-[var(--text-muted)]">ماهانه</dt><dd className="mt-1 truncate text-[12px] font-bold">{fmtIRR(row.monthlyPriceIRR)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <div className="hidden md:block">
          <TableShell minWidth={0} bare>
            <thead>
              <tr>
                <Th>پلن</Th>
                <Th className="px-2 text-[12px]">کسب‌وکار</Th>
                <Th className="px-2 text-[12px]">پرداخت</Th>
                <Th>درآمد کل</Th>
                <Th>قیمت ماهانه</Th>
              </tr>
            </thead>
            <tbody>
              {planRevenue.map((row) => (
                <tr key={row.plan}>
                  <Td>
                    <PlanBadge plan={row.plan} />
                  </Td>
                  <Td className="px-2 text-center tabular-nums text-[var(--text-secondary)]">
                    {fa(row.workspaceCount)}
                  </Td>
                  <Td className="px-2 text-center tabular-nums text-[var(--text-secondary)]">
                    {fa(row.paymentCount)}
                  </Td>
                  <Td className="font-medium tabular-nums">{fmtIRR(row.revenueIRR)}</Td>
                  <Td className="tabular-nums text-[var(--text-muted)]">{fmtIRR(row.monthlyPriceIRR)}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
          </div>
        </Panel>
      </div>
    </div>
  )
}
