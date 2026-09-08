import {
  getPlatformOpenRouterKey,
  chatCompletion,
  type ChatMessage,
} from '@/lib/ai/openrouter'
import { retrieveContext } from '@/lib/ai/rag'
import { resolveModelId } from '@/lib/ai/models'
import { applyPlatformModelPolicy, getPlatformAiConfig, hasPlatformAiBudget } from '@/lib/ai/platform-config'
import { prisma } from '@/lib/prisma'
import { responseEndingInstruction } from '@/lib/ai/response-policy'
import {
  resolveSystemPrompt,
  type PromptConfig,
} from '@/lib/ai/prompt-builder'

/**
 * Name prefix for FAQ knowledge bases created through the learning center, so we
 * can distinguish (and count) auto-learned Q&As from manually-added knowledge.
 */
export const LEARNED_PREFIX = '❓ '

export interface DraftAgent {
  id: string
  systemPrompt: string
  language: string
  model: string | null
  temperature: number
  promptConfig: unknown
  roleTemplate: string | null
}

export type DraftResult =
  | { error: 'AI_UNAVAILABLE' }
  | { answer: string }

/**
 * Draft a suggested answer to a question the agent previously couldn't answer.
 * Used by the "agent learning" center: the operator reviews/edits the draft
 * before it's saved into the knowledge base (human-in-the-loop).
 *
 * Grounds drafts in existing knowledge and marks missing business facts for
 * the owner to complete; approval rejects unfinished placeholders.
 */
export async function draftAnswer(
  workspaceId: string,
  agent: DraftAgent,
  question: string,
): Promise<DraftResult> {
  if (!getPlatformOpenRouterKey()) return { error: 'AI_UNAVAILABLE' }

  const platformConfig = await getPlatformAiConfig()
  if (!(await hasPlatformAiBudget(platformConfig))) return { error: 'AI_UNAVAILABLE' }
  const alias = applyPlatformModelPolicy(agent.model, platformConfig)
  const model = resolveModelId(alias, platformConfig.providerModels)

  const { contextText } = await retrieveContext({
    workspaceId,
    agentId: agent.id,
    query: question,
  })

  const isFa = agent.language === 'fa'
  const instruction = isFa
    ? `تو دستیار صاحب یک کسب‌وکار هستی. مشتری این سؤال را پرسیده و دستیار قبلاً نتوانسته پاسخ دهد. یک پاسخ کوتاه، دقیق و حرفه‌ای پیشنهاد بده که بعداً به پایگاه دانش اضافه شود. فقط از اطلاعات معتبر موجود استفاده کن. اگر اطلاعات کافی نداری، جزئیات حدسی، زمان ارسال، قیمت، سیاست فروشگاه یا لینک نساز؛ جای اطلاعات لازم را با [نیاز به تکمیل صاحب کسب‌وکار] مشخص کن. سؤال ممکن است خلاصه یک نیاز باشد؛ پاسخ را برای موارد هم‌معنی و قابل‌تکرار بنویس، بدون داده شخصی یا وضعیت سفارش خاص. فقط متن پاسخ را بنویس، بدون مقدمه.`
    : `You assist a business owner. A customer asked this question and the agent previously failed to answer it. Draft a short, accurate, professional answer to be added to the knowledge base. Use only grounded business facts. Never invent prices, policies, shipping times or URLs. Mark missing facts as [Owner input needed]. The question can describe an intent: make the answer reusable for semantically similar questions without personal or order-specific details. Output only the answer text, no preamble.`

  const contextBlock = contextText
    ? isFa
      ? `\n\nاطلاعات موجود در پایگاه دانش:\n${contextText}`
      : `\n\nExisting knowledge base context:\n${contextText}`
    : ''

  const effectiveAgentPrompt = resolveSystemPrompt({
    promptConfig:
      agent.promptConfig &&
      typeof agent.promptConfig === 'object' &&
      !Array.isArray(agent.promptConfig)
        ? agent.promptConfig as PromptConfig
        : null,
    roleTemplate: agent.roleTemplate,
    legacySystemPrompt: agent.systemPrompt,
    language: agent.language,
  })

  const messages: ChatMessage[] = [
    { role: 'system', content: `${effectiveAgentPrompt}\n\n${instruction}${contextBlock}\n${responseEndingInstruction(isFa)}` },
    { role: 'user', content: question },
  ]

  const { content, usage } = await chatCompletion({
    model,
    messages,
    temperature: Math.min(agent.temperature, 0.5), // keep drafts grounded
    maxTokens: 500,
  })

  await prisma.usageLog.create({
    data: {
      workspaceId,
      agentId: agent.id,
      type: 'LEARNING',
      model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      reasoningTokens: usage.reasoningTokens,
      cachedTokens: usage.cachedTokens,
      providerRequestId: usage.providerRequestId,
      cost: usage.costUSD,
    },
  }).catch((error) => console.error('[learning] usage log failed:', error))

  return { answer: content.trim() }
}
