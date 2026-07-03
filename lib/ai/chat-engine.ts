import { prisma } from '@/lib/prisma'
import {
        getWorkspaceOpenRouterKey,
        streamChat,
        chatCompletion,
        type ChatUsage,
} from '@/lib/ai/openrouter'
import { retrieveContext, buildMessages } from '@/lib/ai/rag'
import { resolveSystemPrompt } from '@/lib/ai/prompt-builder'
import {
        extractIdentity,
        applyExtractedIdentity,
        identificationInstruction,
} from '@/lib/ai/customer-identification'
import {
        resolveConversation,
        loadAgentRuntime,
        loadHistory,
        fetchCatalogProducts,
} from '@/lib/ai/conversation'
import { shouldHandoff, notifyHandoff, detectUnanswered } from '@/lib/ai/handoff'
import { syncOnboarding } from '@/lib/onboarding'
import { captureError } from '@/lib/errors/capture'
import { checkChatAllowed, type BlockReason } from '@/lib/billing/entitlements'
import type { ChatAgent, StartChatParams } from '@/lib/ai/chat-types'

// Re-exported so existing imports (routes, channel handler) keep working.
export type { ChatAgent, StartChatParams } from '@/lib/ai/chat-types'

/**
 * The chat engine proper: orchestrates one inbound message end-to-end —
 * plan gate → conversation resolution → identity extraction → prompt build →
 * RAG → LLM call → persistence. Conversation/data loading lives in
 * lib/ai/conversation.ts and escalation policy in lib/ai/handoff.ts.
 */

/**
 * Inject runtime variables into the system prompt.
 *
 * Supported placeholders:
 *   {customer_name}  → contact name (or "مشتری" if unknown)
 *
 * Example system prompt:
 *   "تو دستیار فروش هستی. اگر نام مشتری را می‌دانی، با نام او خطاب کن. نام: {customer_name}"
 */
function hydrateSystemPrompt(prompt: string, contactName?: string | null): string {
        if (!prompt) return prompt
        const name = (contactName && contactName.trim()) || 'مشتری'
        return prompt.replaceAll('{customer_name}', name)
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
function bumpProductQueries(workspaceId: string, chunks: { metadata: unknown }[]): void {
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

/**
 * Resolve the final system prompt: layered prompt config → role template → legacy
 * free-form. Then hydrate {customer_name}. If the conversation is still in the
 * 'pending' identification state, append the identification instruction.
 */
function buildSystemPrompt(params: {
        agent: ChatAgent
        customerInfoState: string
        variantPrompt: string | null
        variant: string
        contactName: string | null
}): string {
        const { agent, customerInfoState, variantPrompt, variant, contactName } = params

        // 1. Pick base prompt: A/B variant → layered/role → legacy.
        let base =
                variant === 'B' && variantPrompt
                        ? variantPrompt
                        : resolveSystemPrompt({
                                  promptConfig: agent.promptConfig,
                                  roleTemplate: agent.roleTemplate,
                                  legacySystemPrompt: agent.systemPrompt,
                                  language: agent.language,
                          })

        // 2. Hydrate {customer_name}.
        base = hydrateSystemPrompt(base, contactName)

        // 3. If the conversation is still pending identification, inject the
        //    collect-info instruction so the agent asks for name+phone first.
        if (customerInfoState === 'pending' && agent.requireCustomerInfo) {
                const isFa = agent.language !== 'en'
                base += identificationInstruction(isFa, agent.customerInfoPrompt)
        }

        return base
}

/**
 * Shared per-turn setup for both engines: plan gate, key lookup, conversation
 * resolution, identity extraction, prompt/history/RAG assembly and persisting
 * the inbound user message.
 */
async function prepareTurn(params: StartChatParams): Promise<
        | { error: 'NO_KEY' }
        | { error: 'PLAN_BLOCKED'; reason: BlockReason }
        | {
                  key: string
                  model: string
                  conversationId: string
                  contactName: string | null
                  contactPhone: string | null
                  messages: ReturnType<typeof buildMessages>
          }
> {
        const { workspaceId, agent, message } = params

        // Plan gate: expired trial/subscription or exhausted monthly quota.
        const gate = await checkChatAllowed(workspaceId)
        if (!gate.allowed) return { error: 'PLAN_BLOCKED', reason: gate.reason }

        const key = await getWorkspaceOpenRouterKey(workspaceId)
        if (!key) return { error: 'NO_KEY' }

        const runtime = await loadAgentRuntime(workspaceId, agent.id)
        const model = agent.model || runtime.defaultModel || 'deepseek/deepseek-chat'

        // Resolve (or create) the conversation, scoped to the workspace.
        const conversation = await resolveConversation(params, runtime.exp)
        const conversationId = conversation.id

        // F3: best-effort identity extraction from the inbound user message.
        const extracted = extractIdentity(message)
        if (extracted.name || extracted.phone) {
                await applyExtractedIdentity({
                        conversationId,
                        contactId: params.contactId ?? null,
                        extracted,
                }).catch(() => {})
        }

        // Hydrate {customer_name} placeholder if the contact name is known.
        let resolvedContactName = params.contactName ?? null
        if (!resolvedContactName && params.contactId) {
                const c = await prisma.contact.findUnique({
                        where: { id: params.contactId },
                        select: { name: true },
                })
                resolvedContactName = c?.name ?? null
        }
        // If we just extracted a name, prefer it for this turn's greeting.
        if (extracted.name) resolvedContactName = extracted.name

        // Re-read the (possibly updated) identification state.
        const freshState = extracted.name
                ? 'collected'
                : (await prisma.conversation.findUnique({
                          where: { id: conversationId },
                          select: { customerInfoState: true },
                  }))?.customerInfoState ?? conversation.customerInfoState

        const finalSystemPrompt = buildSystemPrompt({
                agent,
                customerInfoState: freshState,
                variantPrompt: runtime.variantPrompt,
                variant: conversation.variant,
                contactName: resolvedContactName,
        })

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
                systemPrompt: finalSystemPrompt,
                language: agent.language,
                contextText,
                catalogProducts,
                history,
                userMessage: message,
                // Rich [[product:{…}]] cards are only renderable by the web widget.
                richCards: params.channel === 'WEB_WIDGET',
        })

        return {
                key,
                model,
                conversationId,
                contactName: resolvedContactName,
                contactPhone: extracted.phone,
                messages,
        }
}

/** Persist a handoff turn: assistant notice + conversation flip + owner alert. */
async function persistHandoff(params: {
        workspaceId: string
        agent: ChatAgent
        conversationId: string
        channel: StartChatParams['channel']
        contactId: string | null
        contactName: string | null
        contactPhone: string | null
        reason: string
        replyText: string
}): Promise<{ messageId: string } | null> {
        try {
                const savedMsg = await prisma.message.create({
                        data: {
                                conversationId: params.conversationId,
                                role: 'ASSISTANT',
                                content: params.replyText,
                        },
                })
                await prisma.conversation.update({
                        where: { id: params.conversationId },
                        data: {
                                status: 'HANDED_OFF',
                                messageCount: { increment: 2 },
                                lastMessageAt: new Date(),
                        },
                })
                // Load agent name for the handoff alert snapshot.
                const agentRow = await prisma.agent.findUnique({
                        where: { id: params.agent.id },
                        select: { name: true },
                })
                void notifyHandoff({
                        workspaceId: params.workspaceId,
                        conversationId: params.conversationId,
                        agentId: params.agent.id,
                        agentName: agentRow?.name ?? 'ایجنت',
                        channel: params.channel,
                        contactId: params.contactId,
                        contactName: params.contactName,
                        contactPhone: params.contactPhone,
                        reason: params.reason,
                })
                return { messageId: savedMsg.id }
        } catch (e) {
                console.error('[chat-engine] handoff persist error:', e)
                return null
        }
}

/** Persist an assistant reply + counters + usage (shared by both engines). */
async function persistAssistantTurn(params: {
        workspaceId: string
        agent: ChatAgent
        conversationId: string
        model: string
        userMessage: string
        reply: string
        usage: ChatUsage | null
}): Promise<{ messageId: string }> {
        const unanswered = detectUnanswered(params.reply, params.agent.fallbackMessage)
        const savedMsg = await prisma.message.create({
                data: {
                        conversationId: params.conversationId,
                        role: 'ASSISTANT',
                        content: params.reply,
                        unanswered,
                        metadata: unanswered ? { question: params.userMessage } : undefined,
                },
        })
        await prisma.conversation.update({
                where: { id: params.conversationId },
                data: { messageCount: { increment: 2 }, lastMessageAt: new Date() },
        })
        if (params.usage) {
                logUsage({
                        workspaceId: params.workspaceId,
                        agentId: params.agent.id,
                        conversationId: params.conversationId,
                        model: params.model,
                        usage: params.usage,
                })
        }
        await syncOnboarding(params.workspaceId)
        return { messageId: savedMsg.id }
}

export type StartChatResult =
        | { error: 'NO_KEY' }
        | { error: 'PLAN_BLOCKED'; reason: BlockReason }
        | { conversationId: string; stream: ReadableStream<Uint8Array> }

export async function startChat(params: StartChatParams): Promise<StartChatResult> {
        const { workspaceId, agent, message } = params

        const prep = await prepareTurn(params)
        if ('error' in prep) return prep
        const { key, model, conversationId, contactName, contactPhone, messages } = prep

        const encoder = new TextEncoder()
        const stream = new ReadableStream<Uint8Array>({
                async start(controller) {
                        const send = (obj: unknown) =>
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

                        send({ type: 'meta', conversationId })

                        // Smart handoff: check before calling AI
                        const handoffCheck = await shouldHandoff(agent, conversationId, message)
                        if (handoffCheck.handoff) {
                                const handoffText = agent.handoffMessage || 'در حال اتصال به پشتیبانی انسانی...'
                                send({ type: 'delta', text: handoffText })
                                const persisted = await persistHandoff({
                                        workspaceId,
                                        agent,
                                        conversationId,
                                        channel: params.channel,
                                        contactId: params.contactId ?? null,
                                        contactName,
                                        contactPhone,
                                        reason: handoffCheck.reason,
                                        replyText: handoffText,
                                })
                                send(persisted ? { type: 'done', messageId: persisted.messageId } : { type: 'done' })
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
                                const { messageId } = await persistAssistantTurn({
                                        workspaceId,
                                        agent,
                                        conversationId,
                                        model,
                                        userMessage: message,
                                        reply: full,
                                        usage,
                                })
                                send({ type: 'done', messageId })
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
        | { error: 'PLAN_BLOCKED'; reason: BlockReason }
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

        const prep = await prepareTurn(params)
        if ('error' in prep) return prep
        const { key, model, conversationId, contactName, contactPhone, messages } = prep

        // Smart handoff: check before calling AI
        const handoffCheck = await shouldHandoff(agent, conversationId, message)
        if (handoffCheck.handoff) {
                const reply = agent.handoffMessage || 'در حال اتصال به پشتیبانی انسانی...'
                await persistHandoff({
                        workspaceId,
                        agent,
                        conversationId,
                        channel: params.channel,
                        contactId: params.contactId ?? null,
                        contactName,
                        contactPhone,
                        reason: handoffCheck.reason,
                        replyText: reply,
                })
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
                await persistAssistantTurn({
                        workspaceId,
                        agent,
                        conversationId,
                        model,
                        userMessage: message,
                        reply,
                        usage,
                })
        } catch (e) {
                console.error('[chat-engine] persist error:', e)
        }

        return { conversationId, reply }
}
