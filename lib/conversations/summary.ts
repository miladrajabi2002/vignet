import { prisma } from '@/lib/prisma'
import { getWorkspaceOpenRouterKey, chatCompletion } from '@/lib/ai/openrouter'

export interface SummaryJobData {
  conversationId: string
}

const MAX_MESSAGES = 40

/**
 * Generate a concise AI summary of a finished conversation and store it on
 * `Conversation.summary`. Runs in the background (BullMQ) after a conversation
 * is resolved. Degrades gracefully: no key, no messages, or a failed completion
 * simply leaves the summary unset rather than throwing.
 */
export async function processSummary(data: SummaryJobData): Promise<void> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: data.conversationId },
    select: {
      id: true,
      workspaceId: true,
      summary: true,
      agent: { select: { language: true, model: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        take: MAX_MESSAGES,
        select: { role: true, content: true },
      },
    },
  })
  if (!conversation) return
  const turns = conversation.messages.filter((m) => m.role !== 'SYSTEM')
  if (turns.length < 2) return

  const key = await getWorkspaceOpenRouterKey(conversation.workspaceId)
  if (!key) return

  const ws = await prisma.workspace.findUnique({
    where: { id: conversation.workspaceId },
    select: { defaultModel: true },
  })
  const model =
    conversation.agent.model || ws?.defaultModel || 'deepseek/deepseek-chat'
  const language = conversation.agent.language

  const transcript = turns
    .map((m) => `${m.role === 'USER' ? 'User' : 'Agent'}: ${m.content}`)
    .join('\n')

  const instruction =
    language === 'en'
      ? 'Summarize the following support conversation in 1-2 short sentences. Capture the user intent and outcome. Reply with the summary only.'
      : 'این گفتگوی پشتیبانی را در یک تا دو جملهٔ کوتاه خلاصه کن. نیت کاربر و نتیجه را بیان کن. فقط خلاصه را بنویس.'

  try {
    const result = await chatCompletion({
      key,
      model,
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content: transcript },
      ],
      temperature: 0.3,
      maxTokens: 200,
    })
    const summary = result.content.trim()
    if (!summary) return
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { summary },
    })
  } catch (e) {
    console.error('[summary] generation failed:', e)
  }
}
