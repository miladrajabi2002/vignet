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
import { resolveSystemPrompt, type PromptConfig } from '@/lib/ai/prompt-builder'
import {
        extractIdentity,
        applyExtractedIdentity,
        identificationInstruction,
} from '@/lib/ai/customer-identification'
import { createHandoffAlert } from '@/lib/channels/operator-handoff'
import { syncOnboarding } from '@/lib/onboarding'
import { captureError } from '@/lib/errors/capture'

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
        // ─ F1: layered prompt
        promptConfig: PromptConfig | null
        roleTemplate: string | null
        // ─ F3: customer identification
        requireCustomerInfo: boolean
        customerInfoPrompt: string | null
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
async function notifyHandoff(params: {
        workspaceId: string
        conversationId: string
        agentId: string
        agentName: string
        channel: ChannelType
        contactId: string | null
        contactName: string | null
        contactPhone: string | null
        reason: string
        summary?: string | null
}): Promise<void> {
        await createHandoffAlert({
                workspaceId: params.workspaceId,
                conversationId: params.conversationId,
                agentId: params.agentId,
                agentName: params.agentName,
                channel: params.channel,
                contactId: params.contactId,
                contactName: params.contactName,
                contactPhone: params.contactPhone,
                reason: params.reason,
                summary: params.summary,
        }).catch(() => {})
}

async function shouldHandoff(
        agent: ChatAgent,
        conversationId: string,
        userMessage: string,
): Promise<{ handoff: boolean; reason: string }> {
        if (!agent.handoffEnabled) return { handoff: false, reason: '' }
        if (agent.handoffKeywords.length > 0) {
                const lower = userMessage.toLowerCase()
                const hit = agent.handoffKeywords.find((kw) =>
                        lower.includes(kw.toLowerCase()),
                )
                if (hit) return { handoff: true, reason: `کلمه کلیدی: ${hit}` }
        }
        const consecutiveFallbacks = await prisma.message.count({
                where: { conversationId, role: 'ASSISTANT', unanswered: true },
        })
        if (consecutiveFallbacks >= 3) {
                return { handoff: true, reason: 'پاسخ‌های متوالی ناموفق (۳ بار)' }
        }
        return { handoff: false, reason: '' }
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
        /** Customer display name — when present, replaces {customer_name} in the system prompt. */
        contactName?: string | null
}

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
): Promise<{ id: string; variant: string; customerInfoState: string }> {
        const { workspaceId, agent } = params

        if (params.conversationId) {
                const found = await prisma.conversation.findFirst({
                        where: { id: params.conversationId, workspaceId, agentId: agent.id },
                        select: { id: true, variant: true, customerInfoState: true },
                })
                if (found)
                        return {
                                id: found.id,
                                variant: found.variant ?? 'A',
                                customerInfoState: found.customerInfoState,
                        }
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
                        select: { id: true, status: true, variant: true, customerInfoState: true },
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
                        return {
                                id: found.id,
                                variant: found.variant ?? 'A',
                                customerInfoState: found.customerInfoState,
                        }
                }
        }

        // Determine the initial identification state for a brand-new conversation.
        const initialState = (() => {
                const messenger: ChannelType[] = ['TELEGRAM', 'BALE', 'RUBIKA', 'WHATSAPP', 'INSTAGRAM']
                if (agent.requireCustomerInfo && !(messenger as string[]).includes(params.channel)) {
                        return 'pending'
                }
                return 'skipped'
        })()

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
                                customerInfoState: initialState,
                        },
                        select: { id: true },
                })
                return { id: created.id, variant, customerInfoState: initialState }
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
                                select: { id: true, variant: true, customerInfoState: true },
                        })
                        if (winner)
                                return {
                                        id: winner.id,
                                        variant: winner.variant ?? 'A',
                                        customerInfoState: winner.customerInfoState,
                                }
                }
                throw e
        }
}

/** Fetch model default + experiment config for an agent in one round-trip. */
async function loadAgentRuntime(
        workspaceId: string,
        agentId: string,
): Promise<{
        defaultModel: string | null
        exp: ExperimentConfig
        variantPrompt: string | null
}> {
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
async function buildSystemPrompt(params: {
        agent: ChatAgent
        conversationId: string
        customerInfoState: string
        variantPrompt: string | null
        variant: string
        contactName: string | null
}): Promise<string> {
        const { agent, conversationId, customerInfoState, variantPrompt, variant, contactName } = params

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

        void conversationId // (kept for future conversation-scoped prompt tweaks)
        return base
}

export async function startChat(params: StartChatParams): Promise<StartChatResult> {
        const { workspaceId, agent, message } = params

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

        const finalSystemPrompt = await buildSystemPrompt({
                agent,
                conversationId,
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
        })

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
                                try {
                                        const savedMsg = await prisma.message.create({
                                                data: { conversationId, role: 'ASSISTANT', content: handoffText },
                                        })
                                        await prisma.conversation.update({
                                                where: { id: conversationId },
                                                data: {
                                                        status: 'HANDED_OFF',
                                                        messageCount: { increment: 2 },
                                                        lastMessageAt: new Date(),
                                                },
                                        })
                                        // Load agent name + contact info for the handoff alert snapshot.
                                        const agentRow = await prisma.agent.findUnique({
                                                where: { id: agent.id },
                                                select: { name: true },
                                        })
                                        void notifyHandoff({
                                                workspaceId,
                                                conversationId,
                                                agentId: agent.id,
                                                agentName: agentRow?.name ?? 'ایجنت',
                                                channel: params.channel,
                                                contactId: params.contactId ?? null,
                                                contactName: resolvedContactName,
                                                contactPhone: extracted.phone,
                                                reason: handoffCheck.reason,
                                        })
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
        if (extracted.name) resolvedContactName = extracted.name

        const freshState = extracted.name
                ? 'collected'
                : (await prisma.conversation.findUnique({
                          where: { id: conversationId },
                          select: { customerInfoState: true },
                  }))?.customerInfoState ?? conversation.customerInfoState

        const finalSystemPrompt = await buildSystemPrompt({
                agent,
                conversationId,
                customerInfoState: freshState,
                variantPrompt: runtime.variantPrompt,
                variant: conversation.variant,
                contactName: resolvedContactName,
        })

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
                systemPrompt: finalSystemPrompt,
                language: agent.language,
                contextText,
                catalogProducts,
                history,
                userMessage: message,
        })

        // Smart handoff: check before calling AI
        const handoffCheck = await shouldHandoff(agent, conversationId, message)
        if (handoffCheck.handoff) {
                const reply = agent.handoffMessage || 'در حال اتصال به پشتیبانی انسانی...'
                try {
                        await prisma.message.create({
                                data: { conversationId, role: 'ASSISTANT', content: reply },
                        })
                        await prisma.conversation.update({
                                where: { id: conversationId },
                                data: {
                                        status: 'HANDED_OFF',
                                        messageCount: { increment: 2 },
                                        lastMessageAt: new Date(),
                                },
                        })
                        const agentRow = await prisma.agent.findUnique({
                                where: { id: agent.id },
                                select: { name: true },
                        })
                        void notifyHandoff({
                                workspaceId,
                                conversationId,
                                agentId: agent.id,
                                agentName: agentRow?.name ?? 'ایجنت',
                                channel: params.channel,
                                contactId: params.contactId ?? null,
                                contactName: resolvedContactName,
                                contactPhone: extracted.phone,
                                reason: handoffCheck.reason,
                        })
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
