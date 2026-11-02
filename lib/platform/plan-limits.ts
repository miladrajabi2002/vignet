/**
 * Pure plan/commercial primitives — the client-safe half of
 * `commercial-config.ts`.
 *
 * This module must NEVER import `@/lib/prisma`, `@prisma/client` (as a value)
 * or anything else server-only: client components (the admin platform
 * settings form) import the unlimited-channel sentinel and config types from
 * here. Prisma-backed read/write lives in commercial-config.ts, which
 * re-exports this module's surface for server callers.
 */
import { MODEL_ALIASES, type ModelAlias } from '@/lib/ai/models'
import { DEFAULT_PROVIDER_ROUTING, type ProviderRouting } from '@/lib/ai/provider-routing'

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
}

/**
 * Sentinel stored in `maxChannels` when a plan has no channel-connection
 * ceiling. Defined here (not in plans.ts) because plans.ts already imports
 * this module — a reverse import would create a cycle.
 */
export const PLAN_LIMIT_UNLIMITED = -1

/** True when a plan limit is the "no ceiling" sentinel (any negative). */
export function isUnlimitedPlanLimit(value: number): boolean {
  return value < 0
}

/**
 * Plan union mirrored locally so this module never imports @prisma/client.
 * Mirrors the Prisma `Plan` enum; the two are structurally identical.
 */
export const PLAN_NAMES = ['TRIAL', 'STARTER', 'PRO', 'BUSINESS'] as const
export type PlanName = (typeof PLAN_NAMES)[number]

export type PlatformCommercialConfig = {
  sttModel: string
  sttPricePerMinuteIRR: number
  visionModel: string
  visionPricePerImageIRR: number
  providerRouting: ProviderRouting
  replyPricesIRR: Record<ModelAlias, number>
  financeUsdToIRR: number | null
  plans: Record<PlanName, ManagedPlanConfig>
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
  providerRouting: DEFAULT_PROVIDER_ROUTING,
  replyPricesIRR: {
    fast: 4_000,
    smart: 6_500,
  },
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
    },
    STARTER: {
      priceIRR: 8_900_000,
      priceUSD: 6,
      maxChannels: 2,
      maxProducts: 500,
      maxOrders: 2_000,
      maxCustomers: 2_000,
      replyDiscountBps: 0,
    },
    PRO: {
      priceIRR: 24_900_000,
      priceUSD: 15,
      maxChannels: 5,
      maxProducts: 2_500,
      maxOrders: 10_000,
      maxCustomers: 10_000,
      replyDiscountBps: 0,
    },
    BUSINESS: {
      priceIRR: 59_000_000,
      priceUSD: 35,
      // The flagship plan sells unlimited channel connections (-1 sentinel).
      maxChannels: PLAN_LIMIT_UNLIMITED,
      maxProducts: 10_000,
      maxOrders: 50_000,
      maxCustomers: 50_000,
      replyDiscountBps: 0,
    },
  },
}

export function safePositive(value: unknown, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback
}

/** Channel allowance accepts the unlimited sentinel or a positive ceiling. */
export function safeChannelLimit(value: unknown, fallback: number): number {
  const number = Number(value)
  if (Number.isFinite(number) && number < 0) return PLAN_LIMIT_UNLIMITED
  return safePositive(number, fallback)
}
