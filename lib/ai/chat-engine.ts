import type { ChannelType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  getWorkspaceOpenRouterKey,
  streamChat,
  chatCompletion,
  type ChatMessage,
} from '@/lib/ai/openrouter'
import { retrieveContext, buildMessages } from '@/lib/ai/rag'
import { syncOnboarding } from '@/lib/onboarding'

export interface ChatAgent {
  id: string
  systemPrompt: string
  language: string
  model: string | null
  temperature: number
  maxTokens: number
  fallbackMessage: string | null
}

export interface StartChatParams {
  workspaceId: string
  agent: ChatAgent
  message: string
  conversationId?: string
  channel: ChannelType
  contactId?: string
  /** Platform thread id (e.g. Telegram chat id) used to resume conversations. */
  externalId?: string
}

export type StartChatResult =
  | { error: 'NO_KEY' }
  | { conversationId: string; stream: ReadableStream<Uint8Array> }

const HISTORY_LIMIT = 10

/**
 * Find an existing conversation (by id, or by channel + externalId) or create
 * a new one. Always scoped to the workspace + agent.
 */
async function resolveConversation(
  params: StartChatParams,
): Promise<{ id: string }> {
  const { workspaceId, agent } = params

  if (params.conversationId) {
    const found = await prisma.conversation.findFirst({
      where: { id: params.conversationId, workspaceId, agentId: agent.id },
      select: { id: true },
    })
    if (found) return found
  }

  if (params.externalId) {
    const found = await prisma.conversation.findFirst({
      where: {
        workspaceId,
        agentId: agent.id,
        channel: params.channel,
        externalId: params.externalId,
        status: 'OPEN',
      },
      select: { id: true },
    })
    if (found) return found
  }

  return prisma.conversation.create({
    data: {
      workspaceId,
      agentId: agent.id,
      channel: params.channel,
      contactId: params.contactId,
      externalId: params.externalId,
    },
    select: { id: true },
  })
}

/** Load recent conversation history as model-ready chat messages. */
async function loadHistory(conversationId: string): Promise<ChatMessage[]> {
  const past = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT,
    select: { role: true, content: true },
  })
  return past
    .reverse()
    .filter((m) => m.role === 'USER' || m.role === 'ASSISTANT')
    .map((m) => ({
      role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    }))
}

/** Bump queryCount for any product chunks retrieved (fire-and-forget). */
function bumpProductQueries(
  workspaceId: string,
  chunks: { metadata: unknown }[],
): void {
  const productIds = chunks
    .map((c) =>
      c.metadata && typeof c.metadata === 'object' && 'productId' in c.metadata
        ? String((c.metadata as Record<string, unknown>).productId)
        : null,
    )
    .filter((v): v is string => !!v)
  if (productIds.length) {
    prisma.product
      .updateMany({
        where: { id: { in: productIds }, workspaceId },
        data: { queryCount: { increment: 1 } },
      })
      .catch(() => {})
  }
}

export async function startChat(
  params: StartChatParams,
): Promise<StartChatResult> {
  const { workspaceId, agent, message } = params

  const key = await getWorkspaceOpenRouterKey(workspaceId)
  if (!key) return { error: 'NO_KEY' }

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { defaultModel: true },
  })
  const model = agent.model || ws?.defaultModel || 'deepseek/deepseek-chat'

  // Resolve (or create) the conversation, scoped to the workspace.
  const conversation = await resolveConversation(params)
  const conversationId = conversation.id

  const history = await loadHistory(conversationId)

  // Persist the incoming user message.
  await prisma.message.create({
    data: { conversationId, role: 'USER', content: message },
  })

  // Retrieve context and build the prompt.
  const { contextText, chunks } = await retrieveContext({
    workspaceId,
    agentId: agent.id,
    query: message,
  })
  bumpProductQueries(workspaceId, chunks)

  const messages = buildMessages({
    systemPrompt: agent.systemPrompt,
    language: agent.language,
    contextText,
    history,
    userMessage: message,
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      send({ type: 'meta', conversationId })

      let full = ''
      try {
        for await (const delta of streamChat({
          key,
          model,
          messages,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
        })) {
          full += delta
          send({ type: 'delta', text: delta })
        }
      } catch (e) {
        console.error('[chat-engine] stream error:', e)
        if (!full) {
          full = agent.fallbackMessage || 'متأسفم، در حال حاضر نمی‌توانم پاسخ دهم.'
          send({ type: 'delta', text: full })
        }
        send({ type: 'error', error: 'STREAM_FAILED' })
      }

      // Persist assistant reply and update conversation counters.
      try {
        await prisma.message.create({
          data: { conversationId, role: 'ASSISTANT', content: full },
        })
        await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            messageCount: { increment: 2 },
            lastMessageAt: new Date(),
          },
        })
        await syncOnboarding(workspaceId)
      } catch (e) {
        console.error('[chat-engine] persist error:', e)
      }

      send({ type: 'done' })
      controller.close()
    },
  })

  return { conversationId, stream }
}

export type GenerateReplyResult =
  | { error: 'NO_KEY' }
  | { conversationId: string; reply: string }

/**
 * Non-streaming counterpart to {@link startChat}, used by messenger channels
 * (Telegram/Bale/Rubika) where we need the full reply text to send back in one
 * shot. Persists both messages and updates counters, mirroring startChat.
 */
export async function generateReply(
  params: StartChatParams,
): Promise<GenerateReplyResult> {
  const { workspaceId, agent, message } = params

  const key = await getWorkspaceOpenRouterKey(workspaceId)
  if (!key) return { error: 'NO_KEY' }

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { defaultModel: true },
  })
  const model = agent.model || ws?.defaultModel || 'deepseek/deepseek-chat'

  const conversation = await resolveConversation(params)
  const conversationId = conversation.id

  const history = await loadHistory(conversationId)

  await prisma.message.create({
    data: { conversationId, role: 'USER', content: message },
  })

  const { contextText, chunks } = await retrieveContext({
    workspaceId,
    agentId: agent.id,
    query: message,
  })
  bumpProductQueries(workspaceId, chunks)

  const messages = buildMessages({
    systemPrompt: agent.systemPrompt,
    language: agent.language,
    contextText,
    history,
    userMessage: message,
  })

  let reply = ''
  try {
    const result = await chatCompletion({
      key,
      model,
      messages,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
    })
    reply = result.content.trim()
  } catch (e) {
    console.error('[chat-engine] completion error:', e)
  }
  if (!reply) {
    reply = agent.fallbackMessage || 'متأسفم، در حال حاضر نمی‌توانم پاسخ دهم.'
  }

  try {
    await prisma.message.create({
      data: { conversationId, role: 'ASSISTANT', content: reply },
    })
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { messageCount: { increment: 2 }, lastMessageAt: new Date() },
    })
    await syncOnboarding(workspaceId)
  } catch (e) {
    console.error('[chat-engine] persist error:', e)
  }

  return { conversationId, reply }
}
