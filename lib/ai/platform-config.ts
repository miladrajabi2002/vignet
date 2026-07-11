import { prisma } from '@/lib/prisma'
import { DEFAULT_MODEL, MODEL_ALIASES, isModelAlias, type ModelAlias } from '@/lib/ai/models'

export type PlatformAiConfig = {
  defaultModel: ModelAlias
  enabledModels: ModelAlias[]
  monthlyBudgetUSD: number | null
}

const FALLBACK: PlatformAiConfig = {
  defaultModel: DEFAULT_MODEL,
  enabledModels: [...MODEL_ALIASES],
  monthlyBudgetUSD: null,
}

let cache: { value: PlatformAiConfig; expiresAt: number } | null = null

export async function getPlatformAiConfig(): Promise<PlatformAiConfig> {
  if (cache && cache.expiresAt > Date.now()) return cache.value
  try {
    const row = await prisma.platformAiSettings.findUnique({ where: { id: 'primary' } })
    if (!row) return FALLBACK
    const enabled = row.enabledModels.filter(isModelAlias)
    const defaultModel = isModelAlias(row.defaultModel) ? row.defaultModel : DEFAULT_MODEL
    const value: PlatformAiConfig = {
      defaultModel,
      enabledModels: enabled.length ? enabled : [defaultModel],
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
): ModelAlias {
  const alias = isModelAlias(requested) ? requested : config.defaultModel
  return config.enabledModels.includes(alias) ? alias : config.defaultModel
}

export async function updatePlatformAiConfig(input: PlatformAiConfig): Promise<PlatformAiConfig> {
  const enabledModels = input.enabledModels.filter(isModelAlias)
  if (!enabledModels.length) throw new Error('AT_LEAST_ONE_MODEL')
  if (!enabledModels.includes(input.defaultModel)) throw new Error('DEFAULT_MUST_BE_ENABLED')

  const row = await prisma.platformAiSettings.upsert({
    where: { id: 'primary' },
    create: {
      id: 'primary',
      defaultModel: input.defaultModel,
      enabledModels,
      monthlyBudgetUSD: input.monthlyBudgetUSD,
    },
    update: {
      defaultModel: input.defaultModel,
      enabledModels,
      monthlyBudgetUSD: input.monthlyBudgetUSD,
    },
  })
  const value: PlatformAiConfig = {
    defaultModel: row.defaultModel as ModelAlias,
    enabledModels: row.enabledModels as ModelAlias[],
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
