import type { Plan } from '@prisma/client'

/**
 * Plan catalog — prices and limits, all overridable via env so the operator
 * can tune pricing without a deploy. Vigent is BYOK (the tenant pays their own
 * OpenRouter token costs), so plans price the *platform*: message volume,
 * agent count and channels — not AI tokens.
 *
 * Env overrides (all optional):
 *   PLAN_PRICE_STARTER_IRR / PLAN_PRICE_PRO_IRR / PLAN_PRICE_BUSINESS_IRR
 *   PLAN_PRICE_STARTER_USD / PLAN_PRICE_PRO_USD / PLAN_PRICE_BUSINESS_USD
 *   PLAN_LIMIT_TRIAL_MSGS / PLAN_LIMIT_STARTER_MSGS / PLAN_LIMIT_PRO_MSGS / PLAN_LIMIT_BUSINESS_MSGS
 *   PLAN_LIMIT_TRIAL_AGENTS / PLAN_LIMIT_STARTER_AGENTS / PLAN_LIMIT_PRO_AGENTS / PLAN_LIMIT_BUSINESS_AGENTS
 */

export interface PlanDef {
  plan: Plan
  /** Monthly price in Iranian Rials (ZarinPay). 0 = free/trial. */
  priceIRR: number
  /** Monthly price in USD (NowPayments / crypto). 0 = free/trial. */
  priceUSD: number
  /** Assistant replies per calendar month across all agents/channels. */
  monthlyMessages: number
  maxAgents: number
}

function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v > 0 ? Math.round(v) : fallback
}

export function getPlanDefs(): Record<Plan, PlanDef> {
  return {
    TRIAL: {
      plan: 'TRIAL',
      priceIRR: 0,
      priceUSD: 0,
      monthlyMessages: envInt('PLAN_LIMIT_TRIAL_MSGS', 200),
      maxAgents: envInt('PLAN_LIMIT_TRIAL_AGENTS', 1),
    },
    STARTER: {
      plan: 'STARTER',
      priceIRR: envInt('PLAN_PRICE_STARTER_IRR', 8_900_000),
      priceUSD: envInt('PLAN_PRICE_STARTER_USD', 9),
      monthlyMessages: envInt('PLAN_LIMIT_STARTER_MSGS', 3_000),
      maxAgents: envInt('PLAN_LIMIT_STARTER_AGENTS', 2),
    },
    PRO: {
      plan: 'PRO',
      priceIRR: envInt('PLAN_PRICE_PRO_IRR', 24_900_000),
      priceUSD: envInt('PLAN_PRICE_PRO_USD', 25),
      monthlyMessages: envInt('PLAN_LIMIT_PRO_MSGS', 15_000),
      maxAgents: envInt('PLAN_LIMIT_PRO_AGENTS', 5),
    },
    BUSINESS: {
      plan: 'BUSINESS',
      priceIRR: envInt('PLAN_PRICE_BUSINESS_IRR', 59_000_000),
      priceUSD: envInt('PLAN_PRICE_BUSINESS_USD', 59),
      monthlyMessages: envInt('PLAN_LIMIT_BUSINESS_MSGS', 60_000),
      maxAgents: envInt('PLAN_LIMIT_BUSINESS_AGENTS', 20),
    },
  }
}

export const PAID_PLANS = ['STARTER', 'PRO', 'BUSINESS'] as const satisfies readonly Plan[]
export type PaidPlan = (typeof PAID_PLANS)[number]

export function isPaidPlan(p: string): p is PaidPlan {
  return (PAID_PLANS as readonly string[]).includes(p)
}

/** Subscription period granted per successful payment. */
export const PERIOD_DAYS = 30
