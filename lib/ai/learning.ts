import {
  getWorkspaceOpenRouterKey,
  chatCompletion,
  type ChatMessage,
} from '@/lib/ai/openrouter'
import { retrieveContext } from '@/lib/ai/rag'
import { prisma } from '@/lib/prisma'

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
}

export type DraftResult =
  | { error: 'NO_KEY' }
  | { answer: string }

/**
 * Draft a suggested answer to a question the agent previously couldn't answer.
 * Used by the "agent learning" center: the operator reviews/edits the draft
 * before it's saved into the knowledge base (human-in-the-loop).
 *
 * Pulls any existing knowledge for grounding, but explicitly allows a sensible
 * draft even when context is thin — the human approves it, so a starting point
 * is more useful than a refusal.
 */
export async function draftAnswer(
  workspaceId: string,
  agent: DraftAgent,
  question: string,
): Promise<DraftResult> {
  const key = await getWorkspaceOpenRouterKey(workspaceId)
  if (!key) return { error: 'NO_KEY' }

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { defaultModel: true },
  })
  const model = agent.model || ws?.defaultModel || 'deepseek/deepseek-chat'

  const { contextText } = await retrieveContext({
    workspaceId,
    agentId: agent.id,
    query: question,
  })

  const isFa = agent.language === 'fa'
  const instruction = isFa
    ? `تو دستیار صاحب یک کسب‌وکار هستی. مشتری این سؤال را پرسیده و دستیار قبلاً نتوانسته پاسخ دهد. یک پاسخ کوتاه، دقیق و حرفه‌ای پیشنهاد بده که بعداً به پایگاه دانش اضافه شود. اگر اطلاعات کافی نداری، یک پیش‌نویس منطقی بنویس که صاحب کسب‌وکار بتواند ویرایش و تکمیلش کند. فقط متن پاسخ را بنویس، بدون مقدمه.`
    : `You assist a business owner. A customer asked this question and the agent previously failed to answer it. Draft a short, accurate, professional answer to be added to the knowledge base. If you lack details, write a reasonable draft the owner can edit. Output only the answer text, no preamble.`

  const contextBlock = contextText
    ? isFa
      ? `\n\nاطلاعات موجود در پایگاه دانش:\n${contextText}`
      : `\n\nExisting knowledge base context:\n${contextText}`
    : ''

  const messages: ChatMessage[] = [
    { role: 'system', content: `${agent.systemPrompt}\n\n${instruction}${contextBlock}` },
    { role: 'user', content: question },
  ]

  const { content } = await chatCompletion({
    key,
    model,
    messages,
    temperature: Math.min(agent.temperature, 0.5), // keep drafts grounded
    maxTokens: 500,
  })

  return { answer: content.trim() }
}
