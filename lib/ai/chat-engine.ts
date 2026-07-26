import { prisma } from '@/lib/prisma'
import {
        getPlatformOpenRouterKey,
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
        loadHistory,
        fetchCatalogProducts,
        fetchCatalogServices,
        historyForProductTurn,
        isHumanOwnedConversation,
        planProductRequest,
        type ProductRequestPlan,
} from '@/lib/ai/conversation'
import type { CatalogProduct } from '@/lib/ai/rag'
import { shouldHandoff, notifyHandoff, detectUnanswered, handoffReplyText } from '@/lib/ai/handoff'
import { syncOnboarding } from '@/lib/onboarding'
import { captureError } from '@/lib/errors/capture'
import { checkChatAllowed, type BlockReason } from '@/lib/billing/entitlements'
import { DEFAULT_MODEL, resolveModelAlias, resolveModelId } from '@/lib/ai/models'
import { applyPlatformModelPolicy, getPlatformAiConfig, hasPlatformAiBudget } from '@/lib/ai/platform-config'
import {
        captureChatCredit,
        releaseChatCredit,
        reserveChatCredit,
        type CreditReservation,
} from '@/lib/billing/ai-credits'
import { bumpContactActivity } from '@/lib/crm/contact-activity'
import type { ChatAgent, StartChatParams } from '@/lib/ai/chat-types'
import {
        buildTurnReceipts,
        metadataWithReceipts,
        type ConversationReceipt,
} from '@/lib/conversations/activity'
import { maybeRunBookingAgentTurn } from '@/lib/bookings/chat-orchestrator'
import { refreshConversationSalesInsight, salesGuidanceForModel } from '@/lib/ai/sales-intelligence'
import { buildOrderContext } from '@/lib/ai/order-context'
import { buildTrustedProductReply, parseProductDirectives } from '@/lib/products/presentation'

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
        contactName: string | null
}): string {
        const { agent, customerInfoState, contactName } = params

        // 1. Resolve the layered/role prompt, with the legacy prompt as fallback.
        let base = resolveSystemPrompt({
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

function appendSalesGuidance(
        messages: ReturnType<typeof buildMessages>,
        guidance: string,
): void {
        const system = messages.find((item) => item.role === 'system')
        if (!system) return
        system.content = `${system.content ?? ''}\n\n${guidance}`
}

async function buildDeterministicTurnReply(params: {
        workspaceId: string
        agent: ChatAgent
        channel: StartChatParams['channel']
        catalogProducts: CatalogProduct[]
        productRequest: ProductRequestPlan
        canBypass: boolean
}): Promise<string | null> {
        if (!params.canBypass || params.channel === 'API') return null
        if (params.productRequest.requestNewTopic) {
                return params.agent.language === 'en'
                        ? 'Okay, I cleared the previous topic. Please tell me your new request.'
                        : 'باشه؛ موضوع قبلی را کنار گذاشتم. لطفاً درخواست جدیدتان را بگویید.'
        }
        if (!params.productRequest.explicitShowcase) return null
        if (!params.agent.productAccessEnabled) {
                return params.agent.language === 'en'
                        ? 'This agent does not currently have access to the product catalog.'
                        : 'دسترسی این ایجنت به کاتالوگ محصولات در حال حاضر غیرفعال است.'
        }

        return buildTrustedProductReply({
                raw: '',
                workspaceId: params.workspaceId,
                agentId: params.agent.id,
                isFa: params.agent.language !== 'en',
                preferredProductIds: params.catalogProducts.map((product) => product.id),
                forceShowcase: true,
        })
}

/**
 * Shared per-turn setup for both engines: plan gate, key lookup, conversation
 * resolution, identity extraction, prompt/history/RAG assembly and persisting
 * the inbound user message.
 */
async function prepareTurn(params: StartChatParams): Promise<
        | { error: 'AI_UNAVAILABLE' }
        | { error: 'NO_CREDIT' }
        | { error: 'OPERATOR_ACTIVE'; conversationId: string }
        | { error: 'PLAN_BLOCKED'; reason: BlockReason }
        | {
                  model: string
                  modelAlias: string
                  reservation: CreditReservation
                  conversationId: string
                  contactId: string | null
                  contactName: string | null
                  contactPhone: string | null
                  messages: ReturnType<typeof buildMessages>
                  retrievedChunks: Array<{ metadata: unknown }>
                  catalogProducts: CatalogProduct[]
                  productRequest: ProductRequestPlan
                  canBypassDeterministicReply: boolean
          }
> {
        const { workspaceId, agent, message } = params

        // Resolve first so a returning messenger thread keeps its operator/AI
        // ownership state even when the workspace plan is currently blocked.
        const conversation = await resolveConversation(params)
        const conversationId = conversation.id

        // Human ownership is a hard, channel-agnostic gate. Persist the inbound
        // message for the inbox, but never reserve credit or call a model until
        // the operator explicitly returns the conversation to the agent.
        if (isHumanOwnedConversation(conversation)) {
                await prisma.$transaction([
                        prisma.message.create({
                                data: {
                                        conversationId,
                                        role: 'USER',
                                        content: message,
                                        metadata: params.inboundMetadata,
                                },
                        }),
                        prisma.conversation.update({
                                where: { id: conversationId },
                                data: {
                                        status: 'HANDED_OFF',
                                        handedOff: true,
                                        messageCount: { increment: 1 },
                                        lastMessageAt: new Date(),
                                },
                        }),
                ])
                bumpContactActivity(conversationId)
                // Human ownership stays sticky, but new customer messages still
                // refresh the sales/urgency snapshot for operator triage.
                await refreshConversationSalesInsight(conversationId).catch((error) =>
                        console.error('[chat-engine] operator-owned sales insight refresh failed:', error),
                )
                return { error: 'OPERATOR_ACTIVE', conversationId }
        }

        // Plan gate: expired trial/subscription or exhausted monthly quota.
        const gate = await checkChatAllowed(workspaceId)
        if (!gate.allowed) return { error: 'PLAN_BLOCKED', reason: gate.reason }

        if (!getPlatformOpenRouterKey()) return { error: 'AI_UNAVAILABLE' }

        const platformConfig = await getPlatformAiConfig()
        const requestedAlias = resolveModelAlias(agent.model || platformConfig.defaultModel || DEFAULT_MODEL)
        const modelAlias = applyPlatformModelPolicy(requestedAlias, platformConfig, gate.plan)
        const model = resolveModelId(modelAlias, platformConfig.providerModels)
        if (!(await hasPlatformAiBudget(platformConfig))) return { error: 'AI_UNAVAILABLE' }

        // F3: best-effort identity extraction from the inbound user message,
        // merged with structured identity from the widget's pre-chat lead form.
        const extracted = extractIdentity(message)
        if (!extracted.name && params.contactName?.trim()) {
                extracted.name = params.contactName.trim().slice(0, 60)
        }
        if (!extracted.phone && params.contactPhone?.trim()) {
                // Reuse the extractor so the phone gets the same +98 normalization.
                extracted.phone =
                        extractIdentity(params.contactPhone).phone ?? params.contactPhone.trim().slice(0, 30)
        }

        // Widget visitors have no platform identity — when the lead form gave us
        // a name/phone, find-or-create a CRM contact and attach it.
        let contactId = params.contactId ?? null
        if (extracted.name || extracted.phone) {
                contactId = await applyExtractedIdentity({
                        workspaceId,
                        conversationId,
                        contactId,
                        extracted,
                }).catch((error) => {
                        console.error('[chat-engine] lead contact attach failed:', error)
                        return contactId
                })
        }

        // Hydrate {customer_name} placeholder if the contact name is known.
        let resolvedContactName = params.contactName ?? null
        let resolvedContactPhone = extracted.phone ?? params.contactPhone ?? null
        if ((!resolvedContactName || !resolvedContactPhone) && contactId) {
                const c = await prisma.contact.findUnique({
                        where: { id: contactId },
                        select: { name: true, phone: true },
                })
                if (!resolvedContactName) resolvedContactName = c?.name ?? null
                if (!resolvedContactPhone) resolvedContactPhone = c?.phone ?? null
        }
        // If we just extracted a name, prefer it for this turn's greeting.
        if (extracted.name) resolvedContactName = extracted.name

        // Re-read the (possibly updated) identification state.
        const freshState = extracted.name || extracted.phone
                ? 'collected'
                : (await prisma.conversation.findUnique({
                          where: { id: conversationId },
                          select: { customerInfoState: true },
                  }))?.customerInfoState ?? conversation.customerInfoState

        const finalSystemPrompt = buildSystemPrompt({
                agent,
                customerInfoState: freshState,
                contactName: resolvedContactName,
        })

        const reserved = await reserveChatCredit({
                workspaceId,
                agentId: agent.id,
                conversationId,
                model: modelAlias,
                providerModel: model,
                idempotencyKey: `chat:${conversationId}:${crypto.randomUUID()}`,
        })
        if (!reserved.ok) return { error: 'NO_CREDIT' }
        const reservation = reserved.reservation

        try {
                const [history, catalogServices] = await Promise.all([
                        loadHistory(conversationId),
                        fetchCatalogServices(workspaceId),
                ])

        // Persist the incoming user message.
                await prisma.message.create({
                        data: {
                                conversationId,
                                role: 'USER',
                                content: message,
                                metadata: params.inboundMetadata,
                        },
                })
        // Every inbound turn (widget, chat-link, and messengers) keeps the
        // contact's denormalized last-activity fresh. Messenger inbound is also
        // bumped in upsertContact; the duplicate is harmless.
                bumpContactActivity(conversationId)

        // Retrieve context and build the prompt.
                const productRequest = planProductRequest(message, history)
                const retrievalQuery = productRequest.isProductTurn && productRequest.searchTerms.length
                        ? productRequest.searchTerms.join(' ')
                        : message
                const { contextText, chunks } = await retrieveContext({
                        workspaceId,
                        agentId: agent.id,
                        query: retrievalQuery,
                        limit: agent.productAccessEnabled && productRequest.isProductTurn
                                ? Math.min(24, Math.max(12, productRequest.requestedCount * 2))
                                : 3,
                        includeProductCatalog: agent.productAccessEnabled && productRequest.isProductTurn,
                        excludeProductContentFromText: true,
                        contextTextLimit: 4,
                })
                bumpProductQueries(workspaceId, chunks)

                const productIds = chunks
                        .map((chunk) => {
                                const metadata = chunk.metadata
                                return metadata && typeof metadata === 'object' && 'productId' in metadata
                                        ? String((metadata as Record<string, unknown>).productId)
                                        : null
                        })
                        .filter((id): id is string => !!id)

                const [catalogProducts, orderContext] = await Promise.all([
                        agent.productAccessEnabled
                                ? fetchCatalogProducts(agent.id, productIds, productRequest)
                                : Promise.resolve([]),
                        buildOrderContext({
                                workspaceId,
                                contactId,
                                contactPhone: resolvedContactPhone,
                                message,
                                enabled: agent.orderTrackingEnabled,
                                language: agent.language,
                        }),
                ])

                const messages = buildMessages({
                        systemPrompt: finalSystemPrompt,
                        language: agent.language,
                        contextText,
                        catalogProducts,
                        catalogServices,
                        history: historyForProductTurn(history, productRequest),
                        userMessage: message,
                        catalogAccessEnabled: agent.productAccessEnabled,
                        orderContext,
                        productRequest,
                        // Web surfaces render cards directly; messenger channels
                        // resolve markers against trusted DB rows before sending.
                        richCards: agent.productAccessEnabled && params.channel !== 'API',
                })

                return {
                        model,
                        modelAlias,
                        reservation,
                        conversationId,
                        contactId,
                        contactName: resolvedContactName,
                        contactPhone: resolvedContactPhone,
                        messages,
                        retrievedChunks: chunks,
                        catalogProducts,
                        productRequest,
                        canBypassDeterministicReply: freshState !== 'pending',
                }
        } catch (error) {
                await releaseChatCredit(reservation, 'Turn preparation failed').catch(() => {})
                throw error
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
                                handedOff: true,
                                messageCount: { increment: 2 },
                                lastMessageAt: new Date(),
                        },
                })
                // Keep the contact's denormalized last-activity fresh for the CRM list.
                bumpContactActivity(params.conversationId)
                // Load agent name for the handoff alert snapshot.
                const agentRow = await prisma.agent.findUnique({
                        where: { id: params.agent.id },
                        select: { name: true },
                })
                await notifyHandoff({
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
        retrievedChunks: Array<{ metadata: unknown }>
        extraReceipts?: ConversationReceipt[]
}): Promise<{ messageId: string }> {
        const unanswered = detectUnanswered(params.reply, params.agent.fallbackMessage)
        const receipts = buildTurnReceipts({
                userMessage: params.userMessage,
                assistantReply: params.reply,
                retrievedChunks: params.retrievedChunks,
        })
        for (const receipt of params.extraReceipts ?? []) {
                if (!receipts.some((item) => item.kind === receipt.kind)) receipts.push(receipt)
        }
        const savedMsg = await prisma.message.create({
                data: {
                        conversationId: params.conversationId,
                        role: 'ASSISTANT',
                        content: params.reply,
                        unanswered,
                        metadata: metadataWithReceipts(
                                receipts,
                                unanswered ? { question: params.userMessage } : undefined,
                        ),
                },
        })
        await prisma.conversation.update({
                where: { id: params.conversationId },
                data: { messageCount: { increment: 2 }, lastMessageAt: new Date() },
        })
        // Keep the contact's denormalized last-activity fresh for the CRM list.
        bumpContactActivity(params.conversationId)
        await syncOnboarding(params.workspaceId)
        return { messageId: savedMsg.id }
}

export type StartChatResult =
        | { error: 'AI_UNAVAILABLE' }
        | { error: 'NO_CREDIT' }
        | { error: 'OPERATOR_ACTIVE'; conversationId: string }
        | { error: 'PLAN_BLOCKED'; reason: BlockReason }
        | { conversationId: string; stream: ReadableStream<Uint8Array> }

export async function startChat(params: StartChatParams): Promise<StartChatResult> {
        const { workspaceId, agent, message } = params

        const prep = await prepareTurn(params)
        if ('error' in prep) return prep
        const {
                model,
                reservation,
                conversationId,
                contactId,
                contactName,
                contactPhone,
                messages,
                retrievedChunks,
                catalogProducts,
                productRequest,
                canBypassDeterministicReply,
        } = prep

        const encoder = new TextEncoder()
        const stream = new ReadableStream<Uint8Array>({
                async start(controller) {
                        const send = (obj: unknown) =>
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

                        send({ type: 'meta', conversationId })

                        // Smart handoff: check before calling AI. A database/policy
                        // failure here must not leave wallet credit reserved forever.
                        let handoffCheck: Awaited<ReturnType<typeof shouldHandoff>>
                        try {
                                handoffCheck = await shouldHandoff(agent, conversationId, message)
                        } catch (error) {
                                await releaseChatCredit(reservation, 'Handoff policy check failed').catch(() => {})
                                captureError('chat-engine:handoff-check', error, {
                                        workspaceId,
                                        metadata: { agentId: agent.id, conversationId },
                                })
                                send({ type: 'error', error: 'PREPARATION_FAILED' })
                                controller.close()
                                return
                        }
                        if (handoffCheck.handoff) {
				await releaseChatCredit(reservation, 'Human handoff before AI call').catch(() => {})
                                const handoffText = handoffReplyText(handoffCheck, agent)
                                send({ type: 'delta', text: handoffText })
                                const persisted = await persistHandoff({
                                        workspaceId,
                                        agent,
                                        conversationId,
                                        channel: params.channel,
                                        contactId,
                                        contactName,
                                        contactPhone,
                                        reason: handoffCheck.reason,
                                        replyText: handoffText,
                                })
                                send(persisted ? { type: 'done', messageId: persisted.messageId } : { type: 'done' })
                                controller.close()
                                return
                        }

                        try {
                                const deterministicReply = await buildDeterministicTurnReply({
                                        workspaceId,
                                        agent,
                                        channel: params.channel,
                                        catalogProducts,
                                        productRequest,
                                        canBypass: canBypassDeterministicReply,
                                })
                                if (deterministicReply) {
                                        // No model call and therefore no AI charge. The DB
                                        // result itself is the trusted response and marker source.
                                        await releaseChatCredit(reservation, 'Deterministic catalog reply').catch(() => {})
                                        send({ type: 'delta', text: deterministicReply })
                                        try {
                                                const { messageId } = await persistAssistantTurn({
                                                        workspaceId,
                                                        agent,
                                                        conversationId,
                                                        model,
                                                        userMessage: message,
                                                        reply: deterministicReply,
                                                        retrievedChunks,
                                                        extraReceipts: [],
                                                })
                                                send({ type: 'done', messageId })
                                        } catch (error) {
                                                console.error('[chat-engine] deterministic persist failed:', error)
                                                send({ type: 'done' })
                                        }
                                        controller.close()
                                        return
                                }
                        } catch (error) {
                                // DB hydration failure falls back to the regular model path;
                                // the reservation remains valid and no customer turn is lost.
                                console.error('[chat-engine] deterministic reply failed:', error)
                        }
                        if (!handoffCheck.recommended && handoffCheck.salesInsight) {
                                appendSalesGuidance(
                                        messages,
                                        salesGuidanceForModel(handoffCheck.salesInsight, agent.language),
                                )
                        }

                        let full = ''
                        let usage: ChatUsage | null = null
                        let extraReceipts: ConversationReceipt[] = []
                        let providerFailed = false
                        try {
                                const bookingTurn = await maybeRunBookingAgentTurn({
                                        workspaceId,
                                        conversationId,
                                        contactId,
                                        model,
                                        messages,
                                        temperature: agent.temperature,
                                        maxTokens: agent.maxTokens,
                                })
                                if (bookingTurn) {
                                        full = bookingTurn.content
                                        usage = bookingTurn.usage
                                        extraReceipts = bookingTurn.receipts
                                        send({ type: 'delta', text: full })
                                } else {
                                        for await (const delta of streamChat({
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
                                }
                        } catch (e) {
				providerFailed = true
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

                        // A 2xx provider response with no content is not a
                        // successful reply and must not consume reply credit.
                        if (!providerFailed && !full.trim()) {
                                providerFailed = true
                                full = agent.fallbackMessage || 'متأسفم، در حال حاضر نمی‌توانم پاسخ دهم.'
                                send({ type: 'delta', text: full })
                                send({ type: 'error', error: 'EMPTY_RESPONSE' })
                        }

                        if (
                                agent.productAccessEnabled &&
                                params.channel !== 'API' &&
                                (!providerFailed || productRequest.explicitShowcase)
                        ) {
                                try {
                                        const trustedReply = await buildTrustedProductReply({
                                                raw: full,
                                                workspaceId,
                                                agentId: agent.id,
                                                isFa: agent.language !== 'en',
                                                preferredProductIds: catalogProducts.map((product) => product.id),
                                                forceShowcase: productRequest.explicitShowcase,
                                        })
                                        if (trustedReply !== full) {
                                                full = trustedReply
                                                send({ type: 'replace', text: full })
                                        }
                                } catch (error) {
                                        console.error('[chat-engine] product-card hydration failed:', error)
                                        const cleanReply = parseProductDirectives(full).text
                                        if (cleanReply !== full) {
                                                full = cleanReply
                                                send({ type: 'replace', text: full })
                                        }
                                }
                        }

			if (providerFailed) {
				await releaseChatCredit(reservation, 'Provider stream failed').catch(() => {})
			} else {
				await captureChatCredit(reservation, usage).catch((e) =>
					console.error('[chat-engine] credit capture failed:', e),
				)
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
                                        retrievedChunks,
                                        extraReceipts,
                                })
                                send({ type: 'done', messageId })
                        } catch (e) {
                                console.error('[chat-engine] persist error:', e)
                                send({ type: 'done' })
                        }

                        controller.close()
                },
                cancel() {
                        // Idempotent: if capture/release already happened this is a no-op.
                        void releaseChatCredit(reservation, 'Client disconnected before completion').catch(() => {})
                },
        })

        return { conversationId, stream }
}

export type GenerateReplyResult =
        | { error: 'AI_UNAVAILABLE' }
        | { error: 'NO_CREDIT' }
        | { error: 'OPERATOR_ACTIVE'; conversationId: string }
        | { error: 'PLAN_BLOCKED'; reason: BlockReason }
        | { conversationId: string; reply: string }

export interface GenerateReplyOptions {
        /** Runs only after ownership and handoff gates confirm that AI will generate. */
        onGenerationStart?: () => void | Promise<void>
}

/**
 * Non-streaming counterpart to {@link startChat}, used by messenger channels
 * (Telegram/Bale/Rubika) where we need the full reply text to send back in one
 * shot. Persists both messages and updates counters, mirroring startChat.
 */
export async function generateReply(
        params: StartChatParams,
        options: GenerateReplyOptions = {},
): Promise<GenerateReplyResult> {
        const { workspaceId, agent, message } = params

        const prep = await prepareTurn(params)
        if ('error' in prep) return prep
        const {
                model,
                reservation,
                conversationId,
                contactId,
                contactName,
                contactPhone,
                messages,
                retrievedChunks,
                catalogProducts,
                productRequest,
                canBypassDeterministicReply,
        } = prep

        // Smart handoff: check before calling AI.
        let handoffCheck: Awaited<ReturnType<typeof shouldHandoff>>
        try {
                handoffCheck = await shouldHandoff(agent, conversationId, message)
        } catch (error) {
                await releaseChatCredit(reservation, 'Handoff policy check failed').catch(() => {})
                throw error
        }
        if (handoffCheck.handoff) {
		await releaseChatCredit(reservation, 'Human handoff before AI call').catch(() => {})
                const reply = handoffReplyText(handoffCheck, agent)
                await persistHandoff({
                        workspaceId,
                        agent,
                        conversationId,
                        channel: params.channel,
                        contactId,
                        contactName,
                        contactPhone,
                        reason: handoffCheck.reason,
                        replyText: reply,
                })
                return { conversationId, reply }
        }

        try {
                const deterministicReply = await buildDeterministicTurnReply({
                        workspaceId,
                        agent,
                        channel: params.channel,
                        catalogProducts,
                        productRequest,
                        canBypass: canBypassDeterministicReply,
                })
                if (deterministicReply) {
                        await options.onGenerationStart?.()
                        await releaseChatCredit(reservation, 'Deterministic catalog reply').catch(() => {})
                        try {
                                await persistAssistantTurn({
                                        workspaceId,
                                        agent,
                                        conversationId,
                                        model,
                                        userMessage: message,
                                        reply: deterministicReply,
                                        retrievedChunks,
                                        extraReceipts: [],
                                })
                        } catch (error) {
                                console.error('[chat-engine] deterministic persist failed:', error)
                        }
                        return { conversationId, reply: deterministicReply }
                }
        } catch (error) {
                console.error('[chat-engine] deterministic reply failed:', error)
        }
        if (!handoffCheck.recommended && handoffCheck.salesInsight) {
                appendSalesGuidance(
                        messages,
                        salesGuidanceForModel(handoffCheck.salesInsight, agent.language),
                )
        }

        // Channel typing indicators must not run before this point: prepareTurn
        // detects operator-owned conversations and shouldHandoff can transfer
        // this turn without calling a model.
        await options.onGenerationStart?.()

        let reply = ''
        let usage: ChatUsage | null = null
        let extraReceipts: ConversationReceipt[] = []
        let providerFailed = false
        try {
                const bookingTurn = await maybeRunBookingAgentTurn({
                        workspaceId,
                        conversationId,
                        contactId,
                        model,
                        messages,
                        temperature: agent.temperature,
                        maxTokens: agent.maxTokens,
                })
                if (bookingTurn) {
                        reply = bookingTurn.content.trim()
                        usage = bookingTurn.usage
                        extraReceipts = bookingTurn.receipts
                } else {
                        const result = await chatCompletion({
                                model,
                                messages,
                                temperature: agent.temperature,
                                maxTokens: agent.maxTokens,
                        })
                        reply = result.content.trim()
                        usage = result.usage
                }
        } catch (e) {
		providerFailed = true
                captureError('chat-engine:completion', e, {
                        workspaceId,
                        metadata: { agentId: agent.id, model, conversationId },
                })
        }
        if (!reply) {
                // Empty provider content is a failed reply for billing purposes.
                providerFailed = true
                reply = agent.fallbackMessage || 'متأسفم، در حال حاضر نمی‌توانم پاسخ دهم.'
        }

        // Canonicalize markers for every public messenger before persistence
        // and return. Text, carousel and conversation UIs now share the exact
        // same trusted DB result-set; model-authored ids/prices never leak.
        if (
                agent.productAccessEnabled &&
                params.channel !== 'API' &&
                (!providerFailed || productRequest.explicitShowcase)
        ) {
                try {
                        reply = await buildTrustedProductReply({
                                raw: reply,
                                workspaceId,
                                agentId: agent.id,
                                isFa: agent.language !== 'en',
                                preferredProductIds: catalogProducts.map((product) => product.id),
                                forceShowcase: productRequest.explicitShowcase,
                        })
                } catch (error) {
                        console.error('[chat-engine] product-card hydration failed:', error)
                        reply = parseProductDirectives(reply).text
                }
        }

	if (providerFailed) {
		await releaseChatCredit(reservation, 'Provider completion failed').catch(() => {})
	} else {
		await captureChatCredit(reservation, usage).catch((e) =>
			console.error('[chat-engine] credit capture failed:', e),
		)
	}

        try {
                await persistAssistantTurn({
                        workspaceId,
                        agent,
                        conversationId,
                        model,
                        userMessage: message,
                        reply,
                        retrievedChunks,
                        extraReceipts,
                })
        } catch (e) {
                console.error('[chat-engine] persist error:', e)
        }

        return { conversationId, reply }
}
