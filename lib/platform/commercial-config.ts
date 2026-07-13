import type { Plan } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { ModelAlias } from '@/lib/ai/models'

export type ManagedPlanConfig = {
  priceIRR: number
  priceUSD: number
  monthlyMessages: number
  maxAgents: number
  replyDiscountBps: number
  includedCreditIRR: number
}

export type PlatformCommercialConfig = {
  sttModel: string
  ttsModel: string
  providerSort: 'price' | 'latency' | 'throughput'
  zeroDataRetention: boolean
  replyPricesIRR: Record<ModelAlias, number>
  trialCreditIRR: number
  financeUsdToIRR: number | null
  plans: Record<Plan, ManagedPlanConfig>
}

function positiveEnv(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback
}

function nonNegativeEnv(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback
}

function booleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase()
  if (!value) return fallback
  return value === '1' || value === 'true' || value === 'yes'
}

function fallbackConfig(): PlatformCommercialConfig {
  const rate = Number(process.env.FINANCE_USD_TO_IRR)
  return {
    sttModel: process.env.OPENROUTER_STT_MODEL?.trim() || 'openai/whisper-large-v3-turbo',
    ttsModel: process.env.OPENROUTER_TTS_MODEL?.trim() || 'openai/gpt-4o-mini-tts-2025-12-15',
    providerSort: (['price', 'latency', 'throughput'].includes(process.env.OPENROUTER_PROVIDER_SORT || '')
      ? process.env.OPENROUTER_PROVIDER_SORT
      : 'price') as PlatformCommercialConfig['providerSort'],
    zeroDataRetention: booleanEnv('OPENROUTER_ZDR', true),
    replyPricesIRR: {
      fast: positiveEnv('AI_REPLY_PRICE_FAST_IRR', 3_000),
      standard: positiveEnv('AI_REPLY_PRICE_STANDARD_IRR', 4_500),
      balanced: positiveEnv('AI_REPLY_PRICE_BALANCED_IRR', 6_500),
      premium: positiveEnv('AI_REPLY_PRICE_PREMIUM_IRR', 30_000),
    },
    trialCreditIRR: positiveEnv('AI_TRIAL_CREDIT_IRR', 100_000),
    financeUsdToIRR: Number.isFinite(rate) && rate > 0 ? Math.round(rate) : null,
    plans: {
      TRIAL: {
        priceIRR: 0,
        priceUSD: 0,
        monthlyMessages: positiveEnv('PLAN_LIMIT_TRIAL_MSGS', 100),
        maxAgents: positiveEnv('PLAN_LIMIT_TRIAL_AGENTS', 1),
        replyDiscountBps: 0,
        includedCreditIRR: 0,
      },
      STARTER: {
        priceIRR: positiveEnv('PLAN_PRICE_STARTER_IRR', 8_900_000),
        priceUSD: positiveEnv('PLAN_PRICE_STARTER_USD', 9),
        monthlyMessages: positiveEnv('PLAN_LIMIT_STARTER_MSGS', 25_000),
        maxAgents: positiveEnv('PLAN_LIMIT_STARTER_AGENTS', 2),
        replyDiscountBps: nonNegativeEnv('PLAN_REPLY_DISCOUNT_STARTER_BPS', 0),
        includedCreditIRR: nonNegativeEnv('PLAN_INCLUDED_CREDIT_STARTER_IRR', 2_000_000),
      },
      PRO: {
        priceIRR: positiveEnv('PLAN_PRICE_PRO_IRR', 24_900_000),
        priceUSD: positiveEnv('PLAN_PRICE_PRO_USD', 25),
        monthlyMessages: positiveEnv('PLAN_LIMIT_PRO_MSGS', 150_000),
        maxAgents: positiveEnv('PLAN_LIMIT_PRO_AGENTS', 5),
        replyDiscountBps: nonNegativeEnv('PLAN_REPLY_DISCOUNT_PRO_BPS', 1_000),
        includedCreditIRR: nonNegativeEnv('PLAN_INCLUDED_CREDIT_PRO_IRR', 6_000_000),
      },
      BUSINESS: {
        priceIRR: positiveEnv('PLAN_PRICE_BUSINESS_IRR', 59_000_000),
        priceUSD: positiveEnv('PLAN_PRICE_BUSINESS_USD', 59),
        monthlyMessages: positiveEnv('PLAN_LIMIT_BUSINESS_MSGS', 1_000_000),
        maxAgents: positiveEnv('PLAN_LIMIT_BUSINESS_AGENTS', 20),
        replyDiscountBps: nonNegativeEnv('PLAN_REPLY_DISCOUNT_BUSINESS_BPS', 2_000),
        includedCreditIRR: nonNegativeEnv('PLAN_INCLUDED_CREDIT_BUSINESS_IRR', 15_000_000),
      },
    },
  }
}

const MODEL_ALIASES: ModelAlias[] = ['fast', 'standard', 'balanced', 'premium']
const PLANS: Plan[] = ['TRIAL', 'STARTER', 'PRO', 'BUSINESS']
let cache: { value: PlatformCommercialConfig; expiresAt: number } | null = null

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function safePositive(value: unknown, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback
}

function safeNonNegative(value: unknown, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : fallback
}

export async function getPlatformCommercialConfig(): Promise<PlatformCommercialConfig> {
  if (cache && cache.expiresAt > Date.now()) return cache.value
  const fallback = fallbackConfig()
  if (process.env.NODE_ENV === 'test' && process.env.PLATFORM_CONFIG_TEST_DB !== '1') {
    return fallback
  }
  try {
    const row = await prisma.platformAiSettings.findUnique({ where: { id: 'primary' } })
    if (!row) return fallback
    const storedPrices = objectValue(row.replyPricesIRR)
    const storedPlans = objectValue(row.planConfig)
    const plans = Object.fromEntries(PLANS.map((plan) => {
      const base = fallback.plans[plan]
      const stored = objectValue(storedPlans[plan])
      return [plan, {
        priceIRR: plan === 'TRIAL' ? 0 : safePositive(stored.priceIRR, base.priceIRR),
        priceUSD: plan === 'TRIAL' ? 0 : safePositive(stored.priceUSD, base.priceUSD),
        monthlyMessages: safePositive(stored.monthlyMessages, base.monthlyMessages),
        maxAgents: safePositive(stored.maxAgents, base.maxAgents),
        replyDiscountBps: plan === 'TRIAL' ? 0 : Math.min(9_000, safeNonNegative(stored.replyDiscountBps, base.replyDiscountBps)),
        includedCreditIRR: plan === 'TRIAL' ? 0 : safeNonNegative(stored.includedCreditIRR, base.includedCreditIRR),
      }]
    })) as Record<Plan, ManagedPlanConfig>
    const value: PlatformCommercialConfig = {
      sttModel: row.sttModel.trim() || fallback.sttModel,
      ttsModel: row.ttsModel.trim() || fallback.ttsModel,
      providerSort: ['price', 'latency', 'throughput'].includes(row.providerSort)
        ? row.providerSort as PlatformCommercialConfig['providerSort']
        : fallback.providerSort,
      zeroDataRetention: row.zeroDataRetention,
      replyPricesIRR: Object.fromEntries(MODEL_ALIASES.map((alias) => [
        alias,
        safePositive(storedPrices[alias], fallback.replyPricesIRR[alias]),
      ])) as Record<ModelAlias, number>,
      trialCreditIRR: safePositive(row.trialCreditIRR, fallback.trialCreditIRR),
      financeUsdToIRR: row.financeUsdToIRR && row.financeUsdToIRR > 0 ? row.financeUsdToIRR : null,
      plans,
    }
    cache = { value, expiresAt: Date.now() + 30_000 }
    return value
  } catch {
    // Keep the app deployable while the new migration is rolling out.
    return fallback
  }
}

export async function updatePlatformCommercialConfig(
  input: PlatformCommercialConfig,
): Promise<PlatformCommercialConfig> {
  const row = await prisma.platformAiSettings.upsert({
    where: { id: 'primary' },
    create: {
      id: 'primary',
      sttModel: input.sttModel,
      ttsModel: input.ttsModel,
      providerSort: input.providerSort,
      zeroDataRetention: input.zeroDataRetention,
      replyPricesIRR: input.replyPricesIRR,
      trialCreditIRR: input.trialCreditIRR,
      planConfig: input.plans,
      financeUsdToIRR: input.financeUsdToIRR,
    },
    update: {
      sttModel: input.sttModel,
      ttsModel: input.ttsModel,
      providerSort: input.providerSort,
      zeroDataRetention: input.zeroDataRetention,
      replyPricesIRR: input.replyPricesIRR,
      trialCreditIRR: input.trialCreditIRR,
      planConfig: input.plans,
      financeUsdToIRR: input.financeUsdToIRR,
    },
  })
  cache = null
  return getPlatformCommercialConfig().then((value) => ({ ...value, zeroDataRetention: row.zeroDataRetention }))
}

export function clearPlatformCommercialConfigCache(): void {
  cache = null
}
