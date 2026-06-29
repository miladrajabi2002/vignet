import type { ChannelType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  getWorkspaceOpenRouterKey,
  streamChat,
  chatCompletion,
  type ChatMessage,
  type ChatUsage,
} from '@/lib/ai/openrouter'
import { retrieveContext, buildMessages, type CatalogProduct } from '@/lib/ai/rag'
import { syncOnboarding } from '@/lib/onboarding'
import { captureError } from '@/lib/errors/capture'
import { notifyWorkspace } from '@/lib/notifications/create'

export interface ChatAgent {
  id: string
  systemPrompt: string
  language: string
  model: string | null
  temperature: number
  maxTokens: number
  fallbackMessage: string | null
  handoffEnabled: boolean
  handoffMessage: string | null
  handoffKeywords: string[]
}

const UNANSWERED_PHRASES = [
  'اطلاعاتم کامل نیست',
  'اطلاعات این محصول را ندارم',
  'اطلاعات محصولات ما در حال',
  'اطلاعات در این مورد کامل نیست',
  "I don't have information",
  'catalog is being updated',
]

function detectUnanswered(reply: string, fallback: string | null): boolean {
  if (fallback && reply.trim() === fallback.trim()) return true
  const lower = reply.toLowerCase()
  return UNANSWERED_PHRASES.some((p) => lower.includes(p.toLowerCase()))
}

/** Notify the workspace owner that a conversation was handed off to a human. */
function notifyHandoff(workspaceId: string, conversationId: string): Promise<void> {
  return notifyWorkspace({
    workspaceId,
    type: 'HANDOFF',
    title: 'گفتگو به اپراتور انسانی منتقل شد',
    body: 'یک مکالمه نیاز به پاسخ شما دارد.',
    link: `/conversations/${conversationId}`,
    sms: true,
  }).catch(() => {})
}

async function shouldHandoff(
  agent: ChatAgent,
  conversationId: string,
  userMessage: string,
): Promise<boolean> {
  if (!agent.handoffEnabled) return false
  if (agent.handoffKeywords.length > 0) {
    const lower = userMessage.toLowerCase()
    if (agent.handoffKeywords.some((kw) => lower.includes(kw.toLowerCase()))) return true
  }
  const consecutiveFallbacks = await prisma.message.count({
    where: { conversationId, role: 'ASSISTANT', unanswered: true },
  })
  return consecutiveFallbacks >= 3
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
 *
 * For messenger channels the same platform thread (externalId, e.g. a Telegram
 * chat id) always maps back to a single ongoing conversation — regardless of
 * its status — so a returning user keeps their full history instead of starting
 * over. A resumed conversation that was auto-resolved is reopened.
 *
 * A unique constraint on (agentId, channel, externalId) makes creation safe
 * against the race where two webhook deliveries arrive nearly simultaneously:
 * the loser of the race catches the conflict and re-reads the winner's row.
 */
interface ExperimentConfig {
  active: boolean
  hasVariant: boolean
  split: number
}

/** Decide which prompt variant a brand-new conversation should be served. */
function pickVariant(exp?: ExperimentConfig): string {
  if (exp?.active && exp.hasVariant && Math.random() * 100 < exp.split) return 'B'
  return 'A'
}

async function resolveConversation(
  params: StartChatParams,
  exp?: ExperimentConfig,
): Promise<{ id: string; variant: string }> {
  const { workspaceId, agent } = params

  if (params.conversationId) {
    const found = await prisma.conversation.findFirst({
      where: { id: params.conversationId, workspaceId, agentId: agent.id },
      select: { id: true, variant: true },
    })
    if (found) return { id: found.id, variant: found.variant ?? 'A' }
  }

  if (params.externalId) {
    const found = await prisma.conversation.findFirst({
      where: {
        workspaceId,
        agentId: agent.id,
        channel: params.channel,
        externalId: params.externalId,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, variant: true },
    })
    if (found) {
      // Reopen a conversation the stale-sweep (or a handoff) had closed so the
      // thread shows as active again and continuity is preserved.
      if (found.status !== 'OPEN') {
        await prisma.conversation.update({
          where: { id: found.id },
          data: { status: 'OPEN' },
        })
      }
      return { id: found.id, variant: found.variant ?? 'A' }
    }
  }

  const variant = pickVariant(exp)
  try {
    const created = await prisma.conversation.create({
      data: {
        workspaceId,
        agentId: agent.id,
        channel: params.channel,
        contactId: params.contactId,
        externalId: params.externalId,
        variant,
      },
      select: { id: true },
    })
    return { id: created.id, variant }
  } catch (e) {
    // Unique-constraint race: a concurrent delivery created the row first.
    if (
      params.externalId &&
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      (e as { code?: string }).code === 'P2002'
    ) {
      const winner = await prisma.conversation.findFirst({
        where: {
          workspaceId,
          agentId: agent.id,
          channel: params.channel,
          externalId: params.externalId,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, variant: true },
      })
      if (winner) return { id: winner.id, variant: winner.variant ?? 'A' }
    }
    throw e
  }
}

/** Fetch model default + experiment config for an agent in one round-trip. */
async function loadAgentRuntime(
  workspaceId: string,
  agentId: string,
): Promise<{ defaultModel: string | null; exp: ExperimentConfig; variantPrompt: string | null }> {
  const [ws, a] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { defaultModel: true },
    }),
    prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        experimentActive: true,
        experimentVariantPrompt: true,
        experimentSplit: true,
      },
    }),
  ])
  return {
    defaultModel: ws?.defaultModel ?? null,
    variantPrompt: a?.experimentVariantPrompt ?? null,
    exp: {
      active: !!a?.experimentActive,
      hasVariant: !!a?.experimentVariantPrompt,
      split: a?.experimentSplit ?? 50,
    },
  }
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

/** Fetch the products assigned to this agent's catalog. */
async function fetchCatalogProducts(agentId: string): Promise<CatalogProduct[]> {
  const rows = await prisma.agentCatalog.findMany({
    where: { agentId },
    select: {
      product: {
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          stock: true,
          active: true,
          category: { select: { name: true } },
        },
      },
    },
  })
  return rows
    .filter((r) => r.product.active)
    .map((r) => ({
      id: r.product.id,
      name: r.product.name,
      description: r.product.description,
      price: r.product.price,
      stock: r.product.stock,
      category: r.product.category?.name ?? null,
    }))
}

/** Record token usage for a chat turn (fire-and-forget). */
function logUsage(params: {
  workspaceId: string
  agentId: string
  conversationId: string
  model: string
  usage: ChatUsage
}): void {
  if (!params.usage.promptTokens && !params.usage.completionTokens) return
  prisma.usageLog
    .create({
      data: {
        workspaceId: params.workspaceId,
        agentId: params.agentId,
        conversationId: params.conversationId,
        model: params.model,
        promptTokens: params.usage.promptTokens,
        completionTokens: params.usage.completionTokens,
        type: 'CHAT',
      },
    })
    .catch((e) => console.error('[chat-engine] usage log failed:', e))
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

  const runtime = await loadAgentRuntime(workspaceId, agent.id)
  const model = agent.model || runtime.defaultModel || 'deepseek/deepseek-chat'

  // Resolve (or create) the conversation, scoped to the workspace.
  const conversation = await resolveConversation(params, runtime.exp)
  const conversationId = conversation.id
  const systemPrompt =
    conversation.variant === 'B' && runtime.variantPrompt
      ? runtime.variantPrompt
      : agent.systemPrompt

  const [history, catalogProducts] = await Promise.all([
    loadHistory(conversationId),
    fetchCatalogProducts(agent.id),
  ])

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
    systemPrompt,
    language: agent.language,
    contextText,
    catalogProducts,
    history,
    userMessage: message,
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      send({ type: 'meta', conversationId })

      // Smart handoff: check before calling AI
      const handoff = await shouldHandoff(agent, conversationId, message)
      if (handoff) {
        const handoffText = agent.handoffMessage || 'در حال اتصال به پشتیبانی انسانی...'
        send({ type: 'delta', text: handoffText })
        try {
          const savedMsg = await prisma.message.create({
            data: { conversationId, role: 'ASSISTANT', content: handoffText },
          })
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { status: 'HANDED_OFF', messageCount: { increment: 2 }, lastMessageAt: new Date() },
          })
          void notifyHandoff(workspaceId, conversationId)
          send({ type: 'done', messageId: savedMsg.id })
        } catch (e) {
          console.error('[chat-engine] handoff persist error:', e)
          send({ type: 'done' })
        }
        controller.close()
        return
      }

      let full = ''
      let usage: ChatUsage | null = null
      try {
        for await (const delta of streamChat({
          key,
          model,
          messages,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
          onUsage: (u) => {
            usage = u
          },
        })) {
          full += delta
          send({ type: 'delta', text: delta })
        }
      } catch (e) {
        captureError('chat-engine:stream', e, {
          workspaceId,
          metadata: { agentId: agent.id, model, conversationId },
        })
        if (!full) {
          full = agent.fallbackMessage || 'متأسفم، در حال حاضر نمی‌توانم پاسخ دهم.'
          send({ type: 'delta', text: full })
        }
        send({ type: 'error', error: 'STREAM_FAILED' })
      }

      // Persist assistant reply and update conversation counters.
      try {
        const unanswered = detectUnanswered(full, agent.fallbackMessage)
        const savedMsg = await prisma.message.create({
          data: {
            conversationId,
            role: 'ASSISTANT',
            content: full,
            unanswered,
            metadata: unanswered ? { question: message } : undefined,
          },
        })
        await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            messageCount: { increment: 2 },
            lastMessageAt: new Date(),
          },
        })
        if (usage) {
          logUsage({ workspaceId, agentId: agent.id, conversationId, model, usage })
        }
        await syncOnboarding(workspaceId)
        send({ type: 'done', messageId: savedMsg.id })
      } catch (e) {
        console.error('[chat-engine] persist error:', e)
        send({ type: 'done' })
      }

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

  const runtime = await loadAgentRuntime(workspaceId, agent.id)
  const model = agent.model || runtime.defaultModel || 'deepseek/deepseek-chat'

  const conversation = await resolveConversation(params, runtime.exp)
  const conversationId = conversation.id
  const systemPrompt =
    conversation.variant === 'B' && runtime.variantPrompt
      ? runtime.variantPrompt
      : agent.systemPrompt

  const [history, catalogProducts] = await Promise.all([
    loadHistory(conversationId),
    fetchCatalogProducts(agent.id),
  ])

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
    systemPrompt,
    language: agent.language,
    contextText,
    catalogProducts,
    history,
    userMessage: message,
  })

  // Smart handoff: check before calling AI
  const handoff = await shouldHandoff(agent, conversationId, message)
  if (handoff) {
    const reply = agent.handoffMessage || 'در حال اتصال به پشتیبانی انسانی...'
    try {
      await prisma.message.create({ data: { conversationId, role: 'ASSISTANT', content: reply } })
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { status: 'HANDED_OFF', messageCount: { increment: 2 }, lastMessageAt: new Date() },
      })
      void notifyHandoff(workspaceId, conversationId)
    } catch (e) {
      console.error('[chat-engine] handoff persist error:', e)
    }
    return { conversationId, reply }
  }

  let reply = ''
  let usage: ChatUsage | null = null
  try {
    const result = await chatCompletion({
      key,
      model,
      messages,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
    })
    reply = result.content.trim()
    usage = result.usage
  } catch (e) {
    captureError('chat-engine:completion', e, {
      workspaceId,
      metadata: { agentId: agent.id, model, conversationId },
    })
  }
  if (!reply) {
    reply = agent.fallbackMessage || 'متأسفم، در حال حاضر نمی‌توانم پاسخ دهم.'
  }

  try {
    const unanswered = detectUnanswered(reply, agent.fallbackMessage)
    await prisma.message.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content: reply,
        unanswered,
        metadata: unanswered ? { question: message } : undefined,
      },
    })
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { messageCount: { increment: 2 }, lastMessageAt: new Date() },
    })
    if (usage) {
      logUsage({ workspaceId, agentId: agent.id, conversationId, model, usage })
    }
    await syncOnboarding(workspaceId)
  } catch (e) {
    console.error('[chat-engine] persist error:', e)
  }

  return { conversationId, reply }
}
