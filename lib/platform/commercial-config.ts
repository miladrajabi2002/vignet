import { prisma } from '@/lib/prisma'
import { MODEL_ALIASES, type ModelAlias } from '@/lib/ai/models'
import { parseProviderRouting, serializeProviderRouting } from '@/lib/ai/provider-routing'
import {
  DEFAULT_COMMERCIAL_CONFIG,
  PLATFORM_STT_MODEL,
  PLATFORM_VISION_MODEL,
  PLAN_NAMES,
  safeChannelLimit,
  safePositive,
  type ManagedPlanConfig,
  type PlanName,
  type PlatformCommercialConfig,
} from '@/lib/platform/plan-limits'

// Pure surface (types, defaults, unlimited-channel sentinel and helpers)
// lives in plan-limits.ts so client components can import it without dragging
// the Prisma runtime into the browser bundle ("Extensions.defineExtension is
// unable to run in this browser environment"). Everything is re-exported here
// so every existing server import keeps working unchanged.
export {
  DEFAULT_COMMERCIAL_CONFIG,
  PLAN_LIMIT_UNLIMITED,
  PLATFORM_STT_MODEL,
  PLATFORM_VISION_MODEL,
  isUnlimitedPlanLimit,
} from '@/lib/platform/plan-limits'
export type {
  ManagedPlanConfig,
  PlanName,
  PlatformCommercialConfig,
} from '@/lib/platform/plan-limits'

function fallbackConfig(): PlatformCommercialConfig {
  return structuredClone(DEFAULT_COMMERCIAL_CONFIG)
}

let cache: { value: PlatformCommercialConfig; expiresAt: number } | null = null

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
    const plans = Object.fromEntries(PLAN_NAMES.map((plan) => {
      const base = fallback.plans[plan]
      const stored = objectValue(storedPlans[plan])
      return [plan, {
        priceIRR: plan === 'TRIAL' ? 0 : safePositive(stored.priceIRR, base.priceIRR),
        priceUSD: plan === 'TRIAL' ? 0 : safePositive(stored.priceUSD, base.priceUSD),
        // Read the former maxAgents key during rollout so existing DB-backed
        // admin settings keep their value until the next save writes maxChannels.
        // -1 means unlimited channel connections (flagship plan).
        maxChannels: safeChannelLimit(stored.maxChannels ?? stored.maxAgents, base.maxChannels),
        maxProducts: safePositive(stored.maxProducts, base.maxProducts),
        maxOrders: safePositive(stored.maxOrders, base.maxOrders),
        maxCustomers: safePositive(stored.maxCustomers, base.maxCustomers),
        // Reply pricing is global and identical across plans. Keep the legacy
        // field in persisted JSON for a safe rollout, but never apply it.
        replyDiscountBps: 0,
      }]
    })) as Record<PlanName, ManagedPlanConfig>
    const value: PlatformCommercialConfig = {
      // STT is intentionally pinned to one multilingual, economical model.
      sttModel: PLATFORM_STT_MODEL,
      sttPricePerMinuteIRR: safePositive(row.sttPricePerMinuteIRR, fallback.sttPricePerMinuteIRR),
      visionModel: PLATFORM_VISION_MODEL,
      visionPricePerImageIRR: safePositive(row.visionPricePerImageIRR, fallback.visionPricePerImageIRR),
      providerRouting: parseProviderRouting(row.providerSort),
      replyPricesIRR: Object.fromEntries(MODEL_ALIASES.map((alias) => [
        alias,
        safePositive(storedPrices[alias], fallback.replyPricesIRR[alias]),
      ])) as Record<ModelAlias, number>,
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
  await prisma.platformAiSettings.upsert({
    where: { id: 'primary' },
    create: {
      id: 'primary',
      sttModel: PLATFORM_STT_MODEL,
      sttPricePerMinuteIRR: input.sttPricePerMinuteIRR,
      visionPricePerImageIRR: input.visionPricePerImageIRR,
      providerSort: serializeProviderRouting(input.providerRouting),
      replyPricesIRR: input.replyPricesIRR,
      planConfig: input.plans,
      financeUsdToIRR: input.financeUsdToIRR,
    },
    update: {
      sttModel: PLATFORM_STT_MODEL,
      sttPricePerMinuteIRR: input.sttPricePerMinuteIRR,
      visionPricePerImageIRR: input.visionPricePerImageIRR,
      providerSort: serializeProviderRouting(input.providerRouting),
      replyPricesIRR: input.replyPricesIRR,
      planConfig: input.plans,
      financeUsdToIRR: input.financeUsdToIRR,
    },
  })
  cache = null
  return getPlatformCommercialConfig()
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}
