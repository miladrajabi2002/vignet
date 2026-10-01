import type { Plan } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { MODEL_ALIASES, type ModelAlias } from '@/lib/ai/models'

export const PLATFORM_STT_MODEL = 'openai/gpt-transcribe'

/** Pinned vision model for inbound photo understanding (A15 admin surface). */
export const PLATFORM_VISION_MODEL = 'deepseek/deepseek-v4.1-flash'

export type ManagedPlanConfig = {
  priceIRR: number
  priceUSD: number
  maxChannels: number
  maxProducts: number
  maxOrders: number
  maxCustomers: number
  replyDiscountBps: number
  includedCreditIRR: number
}

export type PlatformCommercialConfig = {
  sttModel: string
  sttPricePerMinuteIRR: number
  visionModel: string
  visionPricePerImageIRR: number
  providerSort: 'price' | 'latency' | 'throughput'
  zeroDataRetention: boolean
  replyPricesIRR: Record<ModelAlias, number>
  trialCreditIRR: number
  financeUsdToIRR: number | null
  plans: Record<Plan, ManagedPlanConfig>
}

/**
 * Built-in defaults, used only until the owner saves the admin panel (the
 * panel's values in PlatformAiSettings always win). These are deliberately
 * not read from env: the admin panel is the single place to change them.
 */
export const DEFAULT_COMMERCIAL_CONFIG: PlatformCommercialConfig = {
  sttModel: PLATFORM_STT_MODEL,
  sttPricePerMinuteIRR: 100,
  visionModel: PLATFORM_VISION_MODEL,
  visionPricePerImageIRR: 800,
  providerSort: 'price',
  zeroDataRetention: true,
  replyPricesIRR: {
    fast: 4_000,
    smart: 6_500,
  },
  trialCreditIRR: 1_000_000,
  financeUsdToIRR: null,
  plans: {
    TRIAL: {
      priceIRR: 0,
      priceUSD: 0,
      maxChannels: 1,
      maxProducts: 50,
      maxOrders: 100,
      maxCustomers: 100,
      replyDiscountBps: 0,
      includedCreditIRR: 0,
    },
    STARTER: {
      priceIRR: 8_900_000,
      priceUSD: 6,
      maxChannels: 2,
      maxProducts: 500,
      maxOrders: 2_000,
      maxCustomers: 2_000,
      replyDiscountBps: 0,
      includedCreditIRR: 2_000_000,
    },
    PRO: {
      priceIRR: 24_900_000,
      priceUSD: 15,
      maxChannels: 5,
      maxProducts: 2_500,
      maxOrders: 10_000,
      maxCustomers: 10_000,
      replyDiscountBps: 0,
      includedCreditIRR: 6_000_000,
    },
    BUSINESS: {
      priceIRR: 59_000_000,
      priceUSD: 35,
      maxChannels: 20,
      maxProducts: 10_000,
      maxOrders: 50_000,
      maxCustomers: 50_000,
      replyDiscountBps: 0,
      includedCreditIRR: 15_000_000,
    },
  },
}

function fallbackConfig(): PlatformCommercialConfig {
  return structuredClone(DEFAULT_COMMERCIAL_CONFIG)
}

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
        // Read the former maxAgents key during rollout so existing DB-backed
        // admin settings keep their value until the next save writes maxChannels.
        maxChannels: safePositive(stored.maxChannels ?? stored.maxAgents, base.maxChannels),
        maxProducts: safePositive(stored.maxProducts, base.maxProducts),
        maxOrders: safePositive(stored.maxOrders, base.maxOrders),
        maxCustomers: safePositive(stored.maxCustomers, base.maxCustomers),
        // Reply pricing is global and identical across plans. Keep the legacy
        // field in persisted JSON for a safe rollout, but never apply it.
        replyDiscountBps: 0,
        includedCreditIRR: plan === 'TRIAL' ? 0 : safeNonNegative(stored.includedCreditIRR, base.includedCreditIRR),
      }]
    })) as Record<Plan, ManagedPlanConfig>
    const value: PlatformCommercialConfig = {
      // STT is intentionally pinned to one multilingual, economical model.
      sttModel: PLATFORM_STT_MODEL,
      sttPricePerMinuteIRR: safePositive(row.sttPricePerMinuteIRR, fallback.sttPricePerMinuteIRR),
      visionModel: PLATFORM_VISION_MODEL,
      visionPricePerImageIRR: safePositive(row.visionPricePerImageIRR, fallback.visionPricePerImageIRR),
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
      sttModel: PLATFORM_STT_MODEL,
      sttPricePerMinuteIRR: input.sttPricePerMinuteIRR,
      visionPricePerImageIRR: input.visionPricePerImageIRR,
      providerSort: input.providerSort,
      zeroDataRetention: input.zeroDataRetention,
      replyPricesIRR: input.replyPricesIRR,
      trialCreditIRR: input.trialCreditIRR,
      planConfig: input.plans,
      financeUsdToIRR: input.financeUsdToIRR,
    },
    update: {
      sttModel: PLATFORM_STT_MODEL,
      sttPricePerMinuteIRR: input.sttPricePerMinuteIRR,
      visionPricePerImageIRR: input.visionPricePerImageIRR,
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
