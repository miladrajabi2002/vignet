export interface FinanceInputs {
  planRevenueIRR: number
  planRevenueUSD: number
  creditTopupIRR: number
  creditTopupUSD: number
  openRouterCostUSD: number
  giftedCreditIRR: number
  usdToIRR: number | null
}

export interface FinanceSummary extends FinanceInputs {
  /** Cash revenue converted into one IRR unit; null until a rate is configured. */
  cashRevenueIRR: number | null
  openRouterCostIRR: number | null
  /** Requested formula: plans + credit top-ups - OpenRouter. */
  operatingProfitIRR: number | null
  /** Conservative view that also subtracts issued gift credit at face value. */
  adjustedProfitIRR: number | null
}

function safeNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

/** Explicit rials per USD. Invalid/missing values deliberately return null. */
export function parseUsdToIrrRate(raw: string | undefined): number | null {
  if (!raw?.trim()) return null
  const rate = Number(raw)
  return Number.isFinite(rate) && rate > 0 ? Math.round(rate) : null
}

export function calculateFinanceSummary(input: FinanceInputs): FinanceSummary {
  const planRevenueIRR = safeNonNegative(input.planRevenueIRR)
  const planRevenueUSD = safeNonNegative(input.planRevenueUSD)
  const creditTopupIRR = safeNonNegative(input.creditTopupIRR)
  const creditTopupUSD = safeNonNegative(input.creditTopupUSD)
  const openRouterCostUSD = safeNonNegative(input.openRouterCostUSD)
  const giftedCreditIRR = safeNonNegative(input.giftedCreditIRR)
  const usdToIRR = input.usdToIRR && input.usdToIRR > 0
    ? Math.round(input.usdToIRR)
    : null

  if (!usdToIRR) {
    return {
      planRevenueIRR,
      planRevenueUSD,
      creditTopupIRR,
      creditTopupUSD,
      openRouterCostUSD,
      giftedCreditIRR,
      usdToIRR: null,
      cashRevenueIRR: null,
      openRouterCostIRR: null,
      operatingProfitIRR: null,
      adjustedProfitIRR: null,
    }
  }

  const usdRevenueIRR = Math.round((planRevenueUSD + creditTopupUSD) * usdToIRR)
  const cashRevenueIRR = Math.round(planRevenueIRR + creditTopupIRR + usdRevenueIRR)
  const openRouterCostIRR = Math.round(openRouterCostUSD * usdToIRR)
  const operatingProfitIRR = cashRevenueIRR - openRouterCostIRR

  return {
    planRevenueIRR,
    planRevenueUSD,
    creditTopupIRR,
    creditTopupUSD,
    openRouterCostUSD,
    giftedCreditIRR,
    usdToIRR,
    cashRevenueIRR,
    openRouterCostIRR,
    operatingProfitIRR,
    adjustedProfitIRR: operatingProfitIRR - giftedCreditIRR,
  }
}
