import { prisma } from '@/lib/prisma'
import { getPlatformOpenRouterKey, chatCompletion } from '@/lib/ai/openrouter'
import { resolveModelId } from '@/lib/ai/models'
import {
  applyPlatformModelPolicy,
  getPlatformAiConfig,
  hasPlatformAiBudget,
} from '@/lib/ai/platform-config'
import { stripProductTokens } from '@/lib/widget/config'

export interface SummaryJobData {
  conversationId: string
}

export interface ConversationSummaryResult {
  summary: string | null
  source: 'existing' | 'ai' | 'fallback' | 'empty'
}

const MAX_MESSAGES = 40
const MAX_FALLBACK_PART = 180

type SummaryMessage = { role: 'USER' | 'ASSISTANT' | 'SYSTEM'; content: string }

function compact(value: string, max = MAX_FALLBACK_PART): string {
  const clean = stripProductTokens(value).replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1).trimEnd()}\u2026`
}

/**
 * A deterministic summary is always available for handoff, even when the AI
 * provider or platform budget is unavailable. It intentionally uses only the
 * latest customer intent and the last substantive agent outcome.
 */
export function buildFallbackSummary(
  messages: SummaryMessage[],
  language: string,
): string | null {
  const turns = messages.filter((message) => message.role !== 'SYSTEM' && message.content.trim())
  const latestUser = [...turns].reverse().find((message) => message.role === 'USER')
  if (!latestUser) return null

  const handoffPattern = /(\u0627\u067e\u0631\u0627\u062a\u0648\u0631|\u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u06cc \u0627\u0646\u0633\u0627\u0646\u06cc|human (support|operator)|hand.?off)/i
  const latestOutcome = [...turns]
    .reverse()
    .find(
      (message) =>
        message.role === 'ASSISTANT' && !handoffPattern.test(message.content),
    )

  const intent = compact(latestUser.content)
  const outcome = latestOutcome ? compact(latestOutcome.content) : null
  if (language === 'en') {
    return outcome
      ? `Customer request: ${intent}. Latest outcome: ${outcome}.`
      : `Customer request: ${intent}. No final outcome was recorded before handoff.`
  }

  return outcome
    ? `\u062f\u0631\u062e\u0648\u0627\u0633\u062a \u0645\u0634\u062a\u0631\u06cc: ${intent}. \u0622\u062e\u0631\u06cc\u0646 \u0646\u062a\u06cc\u062c\u0647: ${outcome}.`
    : `\u062f\u0631\u062e\u0648\u0627\u0633\u062a \u0645\u0634\u062a\u0631\u06cc: ${intent}. \u067e\u06cc\u0634 \u0627\u0632 \u0627\u0646\u062a\u0642\u0627\u0644\u060c \u0646\u062a\u06cc\u062c\u0647 \u0646\u0647\u0627\u06cc\u06cc \u062b\u0628\u062a \u0646\u0634\u062f.`
}

async function persistSummary(conversationId: string, summary: string): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { summary },
  })
}

/**
 * Ensure a handoff/resolved conversation has a useful summary now.
 *
 * AI is preferred when it is configured and within budget. The deterministic
 * fallback is persisted first-class when AI is unavailable or fails, so an
 * operator never receives an empty handoff card.
 */
export async function ensureConversationSummary(
  conversationId: string,
  options: { preferAi?: boolean; replaceExisting?: boolean } = {},
): Promise<ConversationSummaryResult> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      workspaceId: true,
      summary: true,
      agent: { select: { id: true, language: true, model: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: MAX_MESSAGES,
        select: { role: true, content: true },
      },
    },
  })
  if (!conversation) return { summary: null, source: 'empty' }
  const existingSummary = conversation.summary?.trim() || null
  if (existingSummary && !options.replaceExisting) {
    return { summary: existingSummary, source: 'existing' }
  }

  const messages = [...conversation.messages].reverse()
  const fallback = existingSummary ?? buildFallbackSummary(messages, conversation.agent.language)
  if (!fallback) return { summary: null, source: 'empty' }

  if (options.preferAi === false) {
    if (!existingSummary) await persistSummary(conversation.id, fallback)
    return { summary: fallback, source: 'fallback' }
  }

  if (!getPlatformOpenRouterKey()) {
    await persistSummary(conversation.id, fallback)
    return { summary: fallback, source: 'fallback' }
  }

  try {
    const platformConfig = await getPlatformAiConfig()
    if (!(await hasPlatformAiBudget(platformConfig))) {
      await persistSummary(conversation.id, fallback)
      return { summary: fallback, source: 'fallback' }
    }

    // Summaries are a bounded extraction task. Always route them through the
    // platform's economical tier instead of inheriting a potentially premium
    // customer-facing agent model.
    const alias = applyPlatformModelPolicy('fast', platformConfig)
    const model = resolveModelId(alias, platformConfig.providerModels)
    const transcript = messages
      .filter((message) => message.role !== 'SYSTEM')
      .map((message) => `${message.role === 'USER' ? 'Customer' : 'Agent'}: ${stripProductTokens(message.content)}`)
      .join('\n')

    const instruction =
      conversation.agent.language === 'en'
        ? 'Summarize this support conversation in 1-2 short sentences for the next human operator. Capture customer intent, verified facts, actions already taken, and the unresolved next step. Do not invent facts. Return only the summary.'
        : '\u0627\u06cc\u0646 \u06af\u0641\u062a\u06af\u0648\u06cc \u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u06cc \u0631\u0627 \u0628\u0631\u0627\u06cc \u0627\u067e\u0631\u0627\u062a\u0648\u0631 \u0628\u0639\u062f\u06cc \u062f\u0631 \u06cc\u06a9 \u062a\u0627 \u062f\u0648 \u062c\u0645\u0644\u0647 \u06a9\u0648\u062a\u0627\u0647 \u062e\u0644\u0627\u0635\u0647 \u06a9\u0646. \u0646\u06cc\u062a \u0645\u0634\u062a\u0631\u06cc\u060c \u0641\u06a9\u062a\u200c\u0647\u0627\u06cc \u062a\u0623\u06cc\u06cc\u062f\u0634\u062f\u0647\u060c \u0627\u0642\u062f\u0627\u0645\u200c\u0647\u0627\u06cc \u0627\u0646\u062c\u0627\u0645\u200c\u0634\u062f\u0647 \u0648 \u0642\u062f\u0645 \u0628\u0639\u062f\u06cc \u0628\u0627\u0642\u06cc\u200c\u0645\u0627\u0646\u062f\u0647 \u0631\u0627 \u0628\u06cc\u0627\u0646 \u06a9\u0646. \u0647\u06cc\u0686 \u0641\u06a9\u062a\u06cc \u0631\u0627 \u0646\u0633\u0627\u0632. \u0641\u0642\u0637 \u062e\u0644\u0627\u0635\u0647 \u0631\u0627 \u0628\u0646\u0648\u06cc\u0633.'

    const result = await chatCompletion({
      model,
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: transcript },
      ],
      temperature: 0.2,
      maxTokens: 220,
    })
    const summary = compact(result.content.trim(), 600) || fallback
    await persistSummary(conversation.id, summary)
    await prisma.usageLog
      .create({
        data: {
          workspaceId: conversation.workspaceId,
          agentId: conversation.agent.id,
          conversationId: conversation.id,
          type: 'SUMMARY',
          model,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          reasoningTokens: result.usage.reasoningTokens,
          cachedTokens: result.usage.cachedTokens,
          providerRequestId: result.usage.providerRequestId,
          cost: result.usage.costUSD,
        },
      })
      .catch((error) => console.error('[summary] usage log failed:', error))

    return { summary, source: summary === fallback ? 'fallback' : 'ai' }
  } catch (error) {
    console.error('[summary] generation failed:', error)
    await persistSummary(conversation.id, fallback).catch(() => {})
    return { summary: fallback, source: 'fallback' }
  }
}

/** BullMQ-compatible entrypoint retained for resolved-conversation jobs. */
export async function processSummary(data: SummaryJobData): Promise<void> {
  await ensureConversationSummary(data.conversationId)
}
