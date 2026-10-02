import { prisma } from '@/lib/prisma'
import { DEFAULT_MODEL, MODEL_ALIASES, isModelAlias, resolveModelAlias, type ModelAlias } from '@/lib/ai/models'
import type { Plan } from '@prisma/client'

export type PlatformAiConfig = {
  defaultModel: ModelAlias
  enabledModels: ModelAlias[]
  trialModel: ModelAlias
  vigentoModel: ModelAlias
  providerModels: Partial<Record<ModelAlias, string>>
  monthlyBudgetUSD: number | null
}

const FALLBACK: PlatformAiConfig = {
  defaultModel: DEFAULT_MODEL,
  enabledModels: [...MODEL_ALIASES],
  trialModel: DEFAULT_MODEL,
  vigentoModel: 'smart',
  providerModels: {},
  monthlyBudgetUSD: null,
}

const DEFAULT_PROVIDER_MODELS: Partial<Record<ModelAlias, string>> = {
  fast: 'deepseek/deepseek-v4-flash',
  smart: 'deepseek/deepseek-v4.1-flash',
}

let cache: { value: PlatformAiConfig; expiresAt: number } | null = null

export async function getPlatformAiConfig(): Promise<PlatformAiConfig> {
  if (cache && cache.expiresAt > Date.now()) return cache.value
  try {
    const row = await prisma.platformAiSettings.findUnique({ where: { id: 'primary' } })
    if (!row) return FALLBACK
    // Rows saved before the catalog shrank to two modes still hold retired
    // aliases (standard / balanced / premium); map them onto today's modes.
    const enabled = [...new Set(row.enabledModels.map(resolveModelAlias))]
    const defaultModel = resolveModelAlias(row.defaultModel)
    const trialModel = resolveModelAlias(row.trialModel)
    const vigentoModel = row.vigentoModel ? resolveModelAlias(row.vigentoModel) : FALLBACK.vigentoModel
    const storedProviders = row.providerModels && typeof row.providerModels === 'object'
      ? row.providerModels as Record<string, unknown>
      : {}
    const providerModels = Object.fromEntries(
      MODEL_ALIASES
        .map((alias) => [alias, typeof storedProviders[alias] === 'string' && storedProviders[alias].trim()
          ? storedProviders[alias].trim()
          : DEFAULT_PROVIDER_MODELS[alias]])
        .filter((entry): entry is [ModelAlias, string] => Boolean(entry[1])),
    ) as Partial<Record<ModelAlias, string>>
    const value: PlatformAiConfig = {
      defaultModel,
      enabledModels: enabled.includes(defaultModel) ? enabled : [defaultModel, ...enabled],
      trialModel,
      vigentoModel,
      providerModels,
      monthlyBudgetUSD: row.monthlyBudgetUSD,
    }
    cache = { value, expiresAt: Date.now() + 30_000 }
    return value
  } catch {
    // During first deploy the app may briefly run before migration completes.
    return FALLBACK
  }
}

export function applyPlatformModelPolicy(
  requested: string | null | undefined,
  config: PlatformAiConfig,
  plan?: Plan,
): ModelAlias {
  if (plan === 'TRIAL') return config.trialModel
  const alias = requested ? resolveModelAlias(requested) : config.defaultModel
  return config.enabledModels.includes(alias) ? alias : config.defaultModel
}

export async function updatePlatformAiConfig(input: PlatformAiConfig): Promise<PlatformAiConfig> {
  const enabledModels = input.enabledModels.filter(isModelAlias)
  if (!enabledModels.length) throw new Error('AT_LEAST_ONE_MODEL')
  if (!enabledModels.includes(input.defaultModel)) throw new Error('DEFAULT_MUST_BE_ENABLED')
  if (!isModelAlias(input.trialModel)) throw new Error('INVALID_TRIAL_MODEL')
  if (!isModelAlias(input.vigentoModel)) throw new Error('INVALID_VIGENTO_MODEL')
  const providerModels = Object.fromEntries(
    MODEL_ALIASES.map((alias) => [alias, input.providerModels[alias]?.trim()]).filter((entry): entry is [ModelAlias, string] => Boolean(entry[1])),
  ) as Partial<Record<ModelAlias, string>>

  const row = await prisma.platformAiSettings.upsert({
    where: { id: 'primary' },
    create: {
      id: 'primary',
      defaultModel: input.defaultModel,
      enabledModels,
      trialModel: input.trialModel,
      vigentoModel: input.vigentoModel,
      providerModels,
      monthlyBudgetUSD: input.monthlyBudgetUSD,
    },
    update: {
      defaultModel: input.defaultModel,
      enabledModels,
      trialModel: input.trialModel,
      vigentoModel: input.vigentoModel,
      providerModels,
      monthlyBudgetUSD: input.monthlyBudgetUSD,
    },
  })
  const value: PlatformAiConfig = {
    defaultModel: row.defaultModel as ModelAlias,
    enabledModels: row.enabledModels as ModelAlias[],
    trialModel: row.trialModel as ModelAlias,
    vigentoModel: row.vigentoModel as ModelAlias,
    providerModels: row.providerModels as Partial<Record<ModelAlias, string>>,
    monthlyBudgetUSD: row.monthlyBudgetUSD,
  }
  cache = { value, expiresAt: Date.now() + 30_000 }
  return value
}

// The month-to-date sum scans every usage row of the month (the table is
// indexed by workspace, not by date alone) and a single turn checks it up to
// three times (reply, analyzer, memory). The ceiling is a soft operator cap,
// so a short-lived per-process total is accurate enough.
const SPEND_CACHE_MS = 30_000
let spendCache: { monthStart: number; totalUSD: number; expiresAt: number } | null = null

async function monthToDateSpendUSD(monthStart: Date): Promise<number> {
  const now = Date.now()
  if (spendCache && spendCache.monthStart === monthStart.getTime() && spendCache.expiresAt > now) {
    return spendCache.totalUSD
  }
  const usage = await prisma.usageLog.aggregate({
    where: { date: { gte: monthStart }, status: 'CAPTURED' },
    _sum: { cost: true },
  })
  const totalUSD = usage._sum.cost ?? 0
  spendCache = { monthStart: monthStart.getTime(), totalUSD, expiresAt: now + SPEND_CACHE_MS }
  return totalUSD
}

/** Enforce the optional operator-set monthly wholesale spend ceiling. */
export async function hasPlatformAiBudget(config?: PlatformAiConfig): Promise<boolean> {
  const policy = config ?? (await getPlatformAiConfig())
  if (!policy.monthlyBudgetUSD) return true
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  return (await monthToDateSpendUSD(monthStart)) < policy.monthlyBudgetUSD
}
