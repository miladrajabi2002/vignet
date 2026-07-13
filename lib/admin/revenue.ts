import { prisma } from '@/lib/prisma'
import {
  calculateFinanceSummary,
  parseUsdToIrrRate,
  type FinanceSummary,
} from '@/lib/admin/finance'
import { getEffectivePlanDefs } from '@/lib/billing/plans'
import { getPlatformCommercialConfig } from '@/lib/platform/commercial-config'

/** Consolidated cash/profit report with explicit USD -> IRR conversion. */
export async function getFinanceSummary(): Promise<FinanceSummary> {
  const [paymentRows, providerCost, giftedCredit, commercialConfig] = await Promise.all([
    prisma.payment.groupBy({
      by: ['kind', 'currency'],
      where: { status: 'PAID' },
      _sum: { amount: true },
    }),
    prisma.usageLog.aggregate({
      where: { status: 'CAPTURED' },
      _sum: { cost: true },
    }),
    prisma.walletLedger.aggregate({
      where: { type: 'PLAN_CREDIT_GRANT' },
      _sum: { amountIRR: true },
    }),
    getPlatformCommercialConfig(),
  ])

  const paid = (kind: 'SUBSCRIPTION' | 'AI_CREDIT', currency: 'IRR' | 'USD') =>
    paymentRows.find((row) => row.kind === kind && row.currency === currency)?._sum.amount ?? 0

  return calculateFinanceSummary({
    planRevenueIRR: paid('SUBSCRIPTION', 'IRR'),
    planRevenueUSD: paid('SUBSCRIPTION', 'USD'),
    creditTopupIRR: paid('AI_CREDIT', 'IRR'),
    creditTopupUSD: paid('AI_CREDIT', 'USD'),
    openRouterCostUSD: providerCost._sum.cost ?? 0,
    giftedCreditIRR: giftedCredit._sum.amountIRR ?? 0,
    usdToIRR: parseUsdToIrrRate(commercialConfig.financeUsdToIRR?.toString()),
  })
}

export interface RevenueKPIs {
  /** Total IRR collected from all PAID payments (ZarinPay). */
  totalIRR: number
  /** Total USD collected from all PAID payments (NowPayments). */
  totalUSD: number
  /** MRR estimate in IRR — sum of active subscription monthlyPrice. */
  mrrIRR: number
  /** Count of successful payments. */
  paidCount: number
  /** Count of failed/expired payments. */
  failedCount: number
  /** Conversion rate: paid workspaces / total workspaces (%). */
  conversionRate: number
  /** ARPU in IRR — average revenue per paying workspace. */
  arpuIRR: number
  /** Total workspaces. */
  totalWorkspaces: number
  /** Paying workspaces (active subscription, not TRIAL). */
  payingWorkspaces: number
  /** Revenue change this month vs last month (%). */
  momChange: number
  /** This month's IRR revenue so far. */
  thisMonthIRR: number
  /** Last month's IRR revenue. */
  lastMonthIRR: number
  /** Count of currently ACTIVE subscriptions. */
  activeSubscriptions: number
  /** Week-over-week change in successful payment count (%). */
  subWeekChange: number
}

/** Aggregate revenue KPIs from the Payment + Subscription + Workspace tables. */
export async function getRevenueKPIs(): Promise<RevenueKPIs> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000)

  const [
    irrAgg,
    usdAgg,
    paidCount,
    failedCount,
    mrrAgg,
    totalWorkspaces,
    payingWorkspaces,
    thisMonthAgg,
    lastMonthAgg,
    activeSubscriptions,
    paidThisWeek,
    paidLastWeek,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: 'PAID', currency: 'IRR' },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: 'PAID', currency: 'USD' },
      _sum: { amount: true },
    }),
    prisma.payment.count({ where: { status: 'PAID' } }),
    prisma.payment.count({ where: { status: { in: ['FAILED', 'EXPIRED'] } } }),
    prisma.subscription.aggregate({
      where: { status: 'ACTIVE', currency: 'IRR' },
      _sum: { monthlyPrice: true },
    }),
    prisma.workspace.count(),
    prisma.workspace.count({ where: { plan: { in: ['STARTER', 'PRO', 'BUSINESS'] } } }),
    prisma.payment.aggregate({
      where: {
        status: 'PAID',
        currency: 'IRR',
        paidAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        status: 'PAID',
        currency: 'IRR',
        paidAt: { gte: startOfLastMonth, lt: startOfMonth },
      },
      _sum: { amount: true },
    }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.payment.count({
      where: { status: 'PAID', paidAt: { gte: weekAgo } },
    }),
    prisma.payment.count({
      where: { status: 'PAID', paidAt: { gte: twoWeeksAgo, lt: weekAgo } },
    }),
  ])

  const totalIRR = irrAgg._sum.amount ?? 0
  const totalUSD = usdAgg._sum.amount ?? 0
  const mrrIRR = mrrAgg._sum.monthlyPrice ?? 0
  const thisMonthIRR = thisMonthAgg._sum.amount ?? 0
  const lastMonthIRR = lastMonthAgg._sum.amount ?? 0
  const momChange =
    lastMonthIRR > 0 ? Math.round(((thisMonthIRR - lastMonthIRR) / lastMonthIRR) * 100) : 0
  const subWeekChange =
    paidLastWeek > 0 ? Math.round(((paidThisWeek - paidLastWeek) / paidLastWeek) * 100) : 0

  return {
    totalIRR,
    totalUSD,
    mrrIRR,
    paidCount,
    failedCount,
    conversionRate: totalWorkspaces > 0 ? Math.round((payingWorkspaces / totalWorkspaces) * 100) : 0,
    arpuIRR: payingWorkspaces > 0 ? Math.round(totalIRR / payingWorkspaces) : 0,
    totalWorkspaces,
    payingWorkspaces,
    momChange,
    thisMonthIRR,
    lastMonthIRR,
    activeSubscriptions,
    subWeekChange,
  }
}

export interface TopWorkspace {
  id: string
  name: string
  plan: string
  revenueIRR: number
  paymentCount: number
}

/** Top N workspaces by total IRR revenue. */
export async function getTopWorkspacesByRevenue(limit = 5): Promise<TopWorkspace[]> {
  const rows = await prisma.payment.groupBy({
    by: ['workspaceId'],
    where: { status: 'PAID', currency: 'IRR' },
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: limit,
  })

  if (rows.length === 0) return []

  const wsIds = rows.map((r) => r.workspaceId)
  const workspaces = await prisma.workspace.findMany({
    where: { id: { in: wsIds } },
    select: { id: true, name: true, plan: true },
  })
  const wsMap = new Map(workspaces.map((w) => [w.id, w]))

  return rows.map((r) => {
    const ws = wsMap.get(r.workspaceId)
    return {
      id: r.workspaceId,
      name: ws?.name ?? '—',
      plan: ws?.plan ?? 'TRIAL',
      revenueIRR: r._sum.amount ?? 0,
      paymentCount: r._count._all,
    }
  })
}

export interface PlanRevenueRow {
  plan: string
  label: string
  revenueIRR: number
  paymentCount: number
  workspaceCount: number
  monthlyPriceIRR: number
}

/** Revenue + workspace count per plan. */
export async function getPlanRevenue(): Promise<PlanRevenueRow[]> {
  const planDefs = await getEffectivePlanDefs()
  const labels: Record<string, string> = {
    TRIAL: 'آزمایشی',
    STARTER: 'استارتر',
    PRO: 'حرفه‌ای',
    BUSINESS: 'سازمانی',
  }

  const [revByPlan, wsByPlan] = await Promise.all([
    prisma.payment.groupBy({
      by: ['plan'],
      where: { status: 'PAID', currency: 'IRR' },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.workspace.groupBy({
      by: ['plan'],
      _count: { _all: true },
    }),
  ])

  const revMap = new Map(revByPlan.map((r) => [r.plan, r]))
  const wsMap = new Map(wsByPlan.map((r) => [r.plan, r._count._all]))

  const order: Array<keyof typeof planDefs> = ['BUSINESS', 'PRO', 'STARTER', 'TRIAL']
  return order.map((plan) => {
    const rev = revMap.get(plan)
    return {
      plan,
      label: labels[plan] ?? plan,
      revenueIRR: rev?._sum.amount ?? 0,
      paymentCount: rev?._count._all ?? 0,
      workspaceCount: wsMap.get(plan) ?? 0,
      monthlyPriceIRR: planDefs[plan].priceIRR,
    }
  })
}
