import { prisma } from '@/lib/prisma'
import { chatCompletion, getPlatformOpenRouterKey, type ChatMessage } from '@/lib/ai/openrouter'
import { applyPlatformModelPolicy, getPlatformAiConfig, hasPlatformAiBudget } from '@/lib/ai/platform-config'
import { resolveModelId } from '@/lib/ai/models'

export async function improvementCompletion(workspaceId: string, agentId: string, messages: ChatMessage[], previewModel?: string | null) {
  const config = await getPlatformAiConfig()
  if (!getPlatformOpenRouterKey() || !(await hasPlatformAiBudget(config))) throw new Error('AI_UNAVAILABLE')
  const model = resolveModelId(applyPlatformModelPolicy(previewModel ?? config.vigentoModel, config), config.providerModels)
  const result = await chatCompletion({ model, task: 'learning-review', temperature: 0.1, maxTokens: 6000, messages })
  await prisma.usageLog.create({ data: {
    workspaceId, agentId, type: 'LEARNING', model,
    promptTokens: result.usage.promptTokens, completionTokens: result.usage.completionTokens,
    reasoningTokens: result.usage.reasoningTokens, cachedTokens: result.usage.cachedTokens,
    providerRequestId: result.usage.providerRequestId, cost: result.usage.costUSD,
  } })
  return result.content
}
export function parseModelJson(content: string): unknown {
  return JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))
}
