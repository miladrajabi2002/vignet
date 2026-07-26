import { prisma } from '@/lib/prisma'
import { DEFAULT_MODEL, MODEL_ALIASES, isModelAlias, type ModelAlias } from '@/lib/ai/models'
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
  vigentoModel: 'balanced',
  providerModels: {},
  monthlyBudgetUSD: null,
}

const DEFAULT_PROVIDER_MODELS: Partial<Record<ModelAlias, string>> = {
  fast: 'deepseek/deepseek-v4-flash',
  standard: 'google/gemini-3.1-flash-lite',
  balanced: 'openai/gpt-5.4-nano',
  premium: 'deepseek/deepseek-v4-pro',
}

let cache: { value: PlatformAiConfig; expiresAt: number } | null = null

export async function getPlatformAiConfig(): Promise<PlatformAiConfig> {
  if (cache && cache.expiresAt > Date.now()) return cache.value
  try {
    const row = await prisma.platformAiSettings.findUnique({ where: { id: 'primary' } })
    if (!row) return FALLBACK
    const enabled = row.enabledModels.filter(isModelAlias)
    const defaultModel = isModelAlias(row.defaultModel) ? row.defaultModel : DEFAULT_MODEL
    const trialModel = isModelAlias(row.trialModel) ? row.trialModel : DEFAULT_MODEL
    const vigentoModel = isModelAlias(row.vigentoModel) ? row.vigentoModel : 'balanced'
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
      enabledModels: enabled.length ? enabled : [defaultModel],
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
  const alias = isModelAlias(requested) ? requested : config.defaultModel
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

/** Enforce the optional operator-set monthly wholesale spend ceiling. */
export async function hasPlatformAiBudget(config?: PlatformAiConfig): Promise<boolean> {
  const policy = config ?? (await getPlatformAiConfig())
  if (!policy.monthlyBudgetUSD) return true
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const usage = await prisma.usageLog.aggregate({
    where: { date: { gte: monthStart }, status: 'CAPTURED' },
    _sum: { cost: true },
  })
  return (usage._sum.cost ?? 0) < policy.monthlyBudgetUSD
}
