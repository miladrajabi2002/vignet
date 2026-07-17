import { prisma } from '@/lib/prisma'
import { getPlatformOpenRouterKey, chatCompletion } from '@/lib/ai/openrouter'
import { resolveModelId } from '@/lib/ai/models'
import {
  applyPlatformModelPolicy,
  getPlatformAiConfig,
  hasPlatformAiBudget,
} from '@/lib/ai/platform-config'
import { stripProductTokens } from '@/lib/widget/config'
import { inboundSourceLabel, readInboundSource } from '@/lib/conversations/source'

export interface SummaryJobData {
  conversationId: string
}

export interface ConversationSummaryResult {
  summary: string | null
  source: 'existing' | 'ai' | 'fallback' | 'empty'
}

const MAX_MESSAGES = 40
const MAX_FALLBACK_PART = 180

type SummaryMessage = {
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
  metadata?: unknown
}

function isEmojiOnly(value: string): boolean {
  const clean = stripProductTokens(value).trim()
  if (!clean || !/\p{Extended_Pictographic}/u.test(clean)) return false
  return clean.replace(/[\p{Extended_Pictographic}\p{Emoji_Component}\u200d\ufe0f\s]/gu, '') === ''
}

function isGreetingOnly(value: string): boolean {
  const clean = stripProductTokens(value)
    .trim()
    .toLocaleLowerCase('fa')
    .replace(/[!,.،؛؟?\s]+/g, ' ')
    .trim()
  return /^(سلام|درود|سلام علیکم|صبح بخیر|ظهر بخیر|عصر بخیر|شب بخیر|hi|hello|hey|good (morning|afternoon|evening))$/.test(clean)
}

function isTrivialConversation(messages: SummaryMessage[]): boolean {
  const userTurns = messages.filter((message) => message.role === 'USER' && message.content.trim())
  return userTurns.length > 0 && userTurns.every((message) => isEmojiOnly(message.content) || isGreetingOnly(message.content))
}

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
  const source = readInboundSource(latestUser.metadata)
  const sourceLabel = inboundSourceLabel(source, language === 'en' ? 'en' : 'fa')

  if (isEmojiOnly(intent)) {
    if (language === 'en') {
      return `The customer sent only ${intent}${sourceLabel ? ` via ${sourceLabel}` : ''}. No request or positive/negative sentiment can be inferred, and no specific action is required.`
    }
    return `مشتری${sourceLabel ? ` از طریق ${sourceLabel}` : ''} فقط ${intent} فرستاده است. درخواست مشخص یا نشانه قابل اتکایی از رضایت یا نارضایتی وجود ندارد و اقدام خاصی لازم نیست.`
  }

  if (isGreetingOnly(intent)) {
    if (language === 'en') {
      return `The customer said hello${sourceLabel ? ` via ${sourceLabel}` : ''}. They have not stated a request or problem yet; wait for their next message.`
    }
    return `مشتری${sourceLabel ? ` از طریق ${sourceLabel}` : ''} سلام کرده است. هنوز درخواست یا مشکلی مطرح نشده؛ منتظر پیام بعدی مشتری بمانید.`
  }

  if (language === 'en') {
    return outcome
      ? `Customer message${sourceLabel ? ` via ${sourceLabel}` : ''}: ${intent}. Latest outcome: ${outcome}.`
      : `Customer message${sourceLabel ? ` via ${sourceLabel}` : ''}: ${intent}. No final outcome was recorded before handoff.`
  }

  return outcome
    ? `پیام مشتری${sourceLabel ? ` از طریق ${sourceLabel}` : ''}: ${intent}. آخرین نتیجه: ${outcome}.`
    : `پیام مشتری${sourceLabel ? ` از طریق ${sourceLabel}` : ''}: ${intent}. پیش از انتقال، نتیجه نهایی ثبت نشد.`
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
        select: { role: true, content: true, metadata: true },
      },
    },
  })
  if (!conversation) return { summary: null, source: 'empty' }
  const existingSummary = conversation.summary?.trim() || null
  if (existingSummary && !options.replaceExisting) {
    return { summary: existingSummary, source: 'existing' }
  }

  const messages = [...conversation.messages].reverse()
  const fallback = buildFallbackSummary(messages, conversation.agent.language) ?? existingSummary
  if (!fallback) return { summary: null, source: 'empty' }

  // Greetings and emoji-only reactions are factual classification tasks. Keep
  // them deterministic so a language model cannot invent intent or sentiment.
  if (isTrivialConversation(messages)) {
    await persistSummary(conversation.id, fallback)
    return { summary: fallback, source: 'fallback' }
  }

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
      .map((message) => {
        const source = message.role === 'USER'
          ? inboundSourceLabel(readInboundSource(message.metadata), conversation.agent.language === 'en' ? 'en' : 'fa')
          : null
        return `${message.role === 'USER' ? 'Customer' : 'Agent'}${source ? ` [${source}]` : ''}: ${stripProductTokens(message.content)}`
      })
      .join('\n')

    const instruction =
      conversation.agent.language === 'en'
        ? 'Summarize this support conversation in 1-2 short sentences for the next human operator. State the source shown in brackets (DM, comment, story reply, or reaction). Capture only explicit intent, verified facts, actions already taken, and the unresolved next step. A greeting is not a request for help. An emoji or reaction alone does not prove positive or negative sentiment. Do not invent facts. Return only the summary.'
        : 'این گفتگو را برای اپراتور بعدی در یک تا دو جمله کوتاه خلاصه کن و منبع داخل کروشه (دایرکت، کامنت، پاسخ یا ری‌اکشن استوری) را ذکر کن. فقط نیت صریح مشتری، فکت‌های تأییدشده، اقدام‌های انجام‌شده و قدم بعدی باقی‌مانده را بنویس. سلام‌کردن به معنی درخواست کمک نیست و یک ایموجی یا ری‌اکشن به‌تنهایی نشانه رضایت یا نارضایتی نیست. هیچ فکتی نساز و فقط خلاصه را بنویس.'

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
