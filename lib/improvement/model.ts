import { chatCompletion, getPlatformOpenRouterKey, type ChatMessage } from '@/lib/ai/openrouter'
import { getPlatformAiConfig, hasPlatformAiBudget } from '@/lib/ai/platform-config'
import { captureAiCredit, releaseAiCredit, reserveAiCredit } from '@/lib/billing/ai-credits'
import { getImprovementPricing } from './pricing'

export type ImprovementBillingContext = {
  idempotencyKey: string
  conversationId?: string | null
}

export async function improvementCompletion(
  workspaceId: string,
  agentId: string,
  messages: ChatMessage[],
  requestedModel: string | null | undefined,
  billing: ImprovementBillingContext,
) {
  const config = await getPlatformAiConfig()
  if (!getPlatformOpenRouterKey() || !(await hasPlatformAiBudget(config))) throw new Error('AI_UNAVAILABLE')
  const pricing = await getImprovementPricing(requestedModel)
  const reserved = await reserveAiCredit({
    workspaceId,
    agentId,
    conversationId: billing.conversationId,
    model: pricing.modelAlias,
    providerModel: pricing.providerModel,
    idempotencyKey: billing.idempotencyKey,
    usageType: 'LEARNING',
    ledgerNote: `AI conversation improvement (${pricing.modelAlias}) reserved`,
  })
  if (!reserved.ok) throw new Error(reserved.reason)
  try {
    const result = await chatCompletion({ model: pricing.providerModel, task: 'learning-review', temperature: 0.1, maxTokens: 6000, messages })
    await captureAiCredit(reserved.reservation, result.usage)
    return result.content
  } catch (error) {
    await releaseAiCredit(reserved.reservation, 'Conversation improvement request failed').catch(() => {})
    throw error
  }
}
export function parseModelJson(content: string): unknown {
  return JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))
}
