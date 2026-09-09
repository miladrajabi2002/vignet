import { findModel, resolveModelAlias, resolveModelId, type ModelAlias } from '@/lib/ai/models'
import { applyPlatformModelPolicy, getPlatformAiConfig } from '@/lib/ai/platform-config'
import { getPlatformCommercialConfig } from '@/lib/platform/commercial-config'

export type ImprovementPricing = {
  modelAlias: ModelAlias
  providerModel: string
  modelNameFa: string
  modelNameEn: string
  requestPriceIRR: number
  previewRequestCount: number
}

/** The reviewer uses the agent's managed model and the same fixed per-request
 * tariff as a successful customer reply. A preview reuses the real historical
 * answer as its baseline, so only candidate + judge are billable requests. */
export async function getImprovementPricing(requestedModel: string | null | undefined): Promise<ImprovementPricing> {
  const [policy, commercial] = await Promise.all([
    getPlatformAiConfig(),
    getPlatformCommercialConfig(),
  ])
  const modelAlias = applyPlatformModelPolicy(resolveModelAlias(requestedModel), policy)
  const model = findModel(modelAlias)
  return {
    modelAlias,
    providerModel: resolveModelId(modelAlias, policy.providerModels),
    modelNameFa: model.name,
    modelNameEn: model.provider,
    requestPriceIRR: commercial.replyPricesIRR[modelAlias],
    previewRequestCount: 2,
  }
}
