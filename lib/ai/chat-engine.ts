import { prisma } from '@/lib/prisma'
import {
        getPlatformOpenRouterKey,
        streamChat,
        chatCompletion,
        type ChatUsage,
} from '@/lib/ai/openrouter'
import { retrieveContext, buildMessages } from '@/lib/ai/rag'
import { resolveSystemPrompt } from '@/lib/ai/prompt-builder'
import { customerPreferenceInstruction, readCustomerAgentPreferences, type CustomerAgentPreference } from '@/lib/ai/customer-agent-preferences'
import { closingReplyText } from '@/lib/ai/response-policy'
import {
        extractIdentity,
        applyExtractedIdentity,
        identificationInstruction,
} from '@/lib/ai/customer-identification'
import {
        resolveConversation,
        loadHistory,
        fetchCatalogCategories,
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
import { compileAgentSkillPlan } from '@/lib/agent-kernel/registry'
import {
        agentSkillTrace,
        hasAgentSkill,
        type AgentSkillPlan,
} from '@/lib/agent-kernel/contracts'
import { runAgentSkillPostprocessors } from '@/lib/agent-kernel/postprocess'
import { hasBookingIntent } from '@/lib/bookings/intent'
import { getRedis } from '@/lib/redis'
import { notifyWorkspace } from '@/lib/notifications/create'
import { processTrialQuotaAlert } from '@/lib/billing/trial-quota-alert'
import type { ChannelType, Prisma } from '@prisma/client'
import {
        AGENT_MAX_RESPONSE_TOKENS,
        AGENT_RESPONSE_TEMPERATURE,
} from '@/lib/ai/agent-runtime'

// Re-exported so existing imports (routes, channel handler) keep working.
export type { ChatAgent, StartChatParams } from '@/lib/ai/chat-types'

// ─ A4: consecutive provider-failure escalation ──────────────────────────────
// A single failed completion answers with the fallback text. But consecutive
// failures (provider outage, bad platform key, exhausted daily budget) must
// surface to the workspace owner AND hand the current conversation to an
// operator so customers do not keep receiving the apology text forever.
const PROVIDER_FAILURE_STREAK_WINDOW_S = 30 * 60
const PROVIDER_FAILURE_STREAK_THRESHOLD = 3
const providerFailureStreakKey = (workspaceId: string) => `provider-fail-streak:${workspaceId}`

async function resetProviderFailureStreak(workspaceId: string): Promise<void> {
        await getRedis().del(providerFailureStreakKey(workspaceId)).catch(() => {})
}

async function trackProviderFailureStreak(params: {
        workspaceId: string
        conversationId: string
        agentId: string
        channel: ChannelType
        contactId: string | null
        contactName: string | null
}): Promise<void> {
        try {
                const redis = getRedis()
                const key = providerFailureStreakKey(params.workspaceId)
                const streak = await redis.incr(key)
                if (streak === 1) await redis.expire(key, PROVIDER_FAILURE_STREAK_WINDOW_S).catch(() => {})
                if (streak < PROVIDER_FAILURE_STREAK_THRESHOLD) return
                const agentRow = await prisma.agent.findUnique({
                        where: { id: params.agentId },
                        select: { name: true },
                })
                // Escalate once per window: notify the owner, hand this thread over.
                await notifyWorkspace({
                        workspaceId: params.workspaceId,
                        type: 'SYSTEM',
                        title: 'خطای پیوسته در سرویس هوش مصنوعی',
                        body: `در ۳۰ دقیقه اخیر ${streak} پاسخ با خطای سرویس AI مواجه شد. مشتریان پیام «مشکل فنی» می‌گیرند و گفتگوهای اخیر به اپراتور ارجاع شده‌اند.`,
                        link: '/conversations',
                }).catch(() => {})
                await notifyHandoff({
                        workspaceId: params.workspaceId,
                        conversationId: params.conversationId,
                        agentId: params.agentId,
                        agentName: agentRow?.name ?? 'ایجنت',
                        channel: params.channel,
                        contactId: params.contactId,
                        contactName: params.contactName,
                        contactPhone: null,
                        reason: `خطای پیوسته سرویس AI (${streak} مورد متوالی)؛ گفتگو به اپراتور ارجاع شد`,
                }).catch(() => {})
                await prisma.conversation.updateMany({
                        where: { id: params.conversationId },
                        data: { handedOff: true, status: 'HANDED_OFF' },
                }).catch(() => {})
        } catch (e) {
                console.error('[chat-engine] failure streak tracking failed:', e)
        }
}

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
        customerPreferences?: CustomerAgentPreference[]
}): string {
        const { agent, customerInfoState, contactName, customerPreferences = [] } = params

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

        // Explicit per-customer interaction preferences are isolated in CRM
        // metadata and subordinate to business facts, tools and safety rules.
        base += customerPreferenceInstruction(agent.language, customerPreferences)

        return base
}

function appendSalesGuidance(
        messages: ReturnType<typeof buildMessages>,
        guidance: string,
): void {
        const system = messages.find((item) => item.role === 'system')
        if (!system) return
        // Keep the authoritative per-turn rules after historical sales advice.
        system.content = `${guidance}\n\n${system.content ?? ''}`
}

async function buildDeterministicTurnReply(params: {
        workspaceId: string
        agent: ChatAgent
        channel: StartChatParams['channel']
        catalogProducts: CatalogProduct[]
        productRequest: ProductRequestPlan
        canBypass: boolean
        closingReply: string | null
}): Promise<string | null> {
        if (params.closingReply) return params.closingReply
        if (!params.canBypass || params.channel === 'API') return null
        if (params.productRequest.requestNewTopic) {
                return params.agent.language === 'en'
                        ? 'Okay, I set the previous topic aside.'
                        : 'باشه؛ موضوع قبلی را کنار گذاشتم.'
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
 * Create the USER side of a turn exactly once when a durable channel event is
 * present. createMany(skipDuplicates) maps to ON CONFLICT DO NOTHING, so a
 * retry can safely reuse the row committed by a worker that crashed later.
 */
async function persistInboundTurnMessage(
        params: StartChatParams,
        conversationId: string,
        incrementConversation: boolean,
): Promise<boolean> {
        return prisma.$transaction(async (tx) => {
                let created = true
                if (params.inboundEventId) {
                        const result = await tx.message.createMany({
                                data: [{
                                        conversationId,
                                        role: 'USER',
                                        content: params.message,
                                        metadata: params.inboundMetadata,
                                        inboundEventId: params.inboundEventId,
                                }],
                                skipDuplicates: true,
                        })
                        created = result.count === 1
                        if (!created) {
                                const existing = await tx.message.findUnique({
                                        where: { inboundEventId: params.inboundEventId },
                                        select: { conversationId: true },
                                })
                                if (!existing || existing.conversationId !== conversationId) {
                                        throw new Error('Inbound event is linked to a different conversation')
                                }
                        }
                } else {
                        await tx.message.create({
                                data: {
                                        conversationId,
                                        role: 'USER',
                                        content: params.message,
                                        metadata: params.inboundMetadata,
                                },
                        })
                }

                if (created && incrementConversation) {
                        await tx.conversation.update({
                                where: { id: conversationId },
                                data: { messageCount: { increment: 1 }, lastMessageAt: new Date() },
                        })
                }
                return created
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
                  skillPlan: AgentSkillPlan
                  canBypassDeterministicReply: boolean
                  closingReply: string | null
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
                await persistInboundTurnMessage(params, conversationId, true)
                await prisma.conversation.update({
                        where: { id: conversationId },
                        data: { status: 'HANDED_OFF', handedOff: true },
                })
                bumpContactActivity(conversationId)
                // Human ownership stays sticky, but new customer messages still
                // refresh the sales/urgency snapshot for operator triage.
                await refreshConversationSalesInsight(conversationId).catch((error) =>
                        console.error('[chat-engine] operator-owned sales insight refresh failed:', error),
                )
                return { error: 'OPERATOR_ACTIVE', conversationId }
        }

        // A customer message must NEVER vanish just because the workspace can't
        // get an AI reply right now (expired plan, empty wallet, missing platform
        // key). Persist it for the inbox before returning any gate error — the
        // webhook has already ACKed, so the platform will not redeliver it.
        const persistGatedInbound = async () => {
                try {
                        await persistInboundTurnMessage(params, conversationId, true)
                        bumpContactActivity(conversationId)
                } catch (error) {
                        console.error('[chat-engine] gated inbound persist failed:', error)
                }
        }

        // Plan gate: expired trial/subscription or exhausted monthly quota.
        // Instagram automation is free — IG-channel conversations are exempt.
        const gate = await checkChatAllowed(workspaceId, params.channel)
        if (!gate.allowed) {
                await persistGatedInbound()
                return { error: 'PLAN_BLOCKED', reason: gate.reason }
        }

        if (!getPlatformOpenRouterKey()) {
                await persistGatedInbound()
                return { error: 'AI_UNAVAILABLE' }
        }

        const platformConfig = await getPlatformAiConfig()
        const requestedAlias = resolveModelAlias(agent.model || platformConfig.defaultModel || DEFAULT_MODEL)
        const modelAlias = applyPlatformModelPolicy(requestedAlias, platformConfig, gate.plan)
        const model = resolveModelId(modelAlias, platformConfig.providerModels)
        if (!(await hasPlatformAiBudget(platformConfig))) {
                await persistGatedInbound()
                return { error: 'AI_UNAVAILABLE' }
        }

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
        const contact = contactId
                ? await prisma.contact.findFirst({
                        where: { id: contactId, workspaceId },
                        select: { name: true, phone: true, metadata: true },
                })
                : null
        if (!resolvedContactName) resolvedContactName = contact?.name ?? null
        if (!resolvedContactPhone) resolvedContactPhone = contact?.phone ?? null
        // An explicit lead-form name always wins over a heuristic in-message
        // extraction; only fall back to the extracted name when no form name exists.
        if (extracted.name && !params.contactName?.trim()) {
                resolvedContactName = extracted.name
        }

        // Re-read the authoritative state. Supplying only one field must not
        // bypass an agent that requires both name and phone.
        const freshState = (await prisma.conversation.findUnique({
                where: { id: conversationId },
                select: { customerInfoState: true },
        }))?.customerInfoState ?? conversation.customerInfoState

        const customerPreferences = contact
                ? readCustomerAgentPreferences(contact.metadata, agent.id)
                : []
        const finalSystemPrompt = buildSystemPrompt({
                agent,
                customerInfoState: freshState,
                contactName: resolvedContactName,
                customerPreferences,
        })

        const reserved = await reserveChatCredit({
                workspaceId,
                agentId: agent.id,
                conversationId,
                model: modelAlias,
                providerModel: model,
                idempotencyKey: params.inboundEventId
                        ? `chat:event:${params.inboundEventId}`
                        : `chat:${conversationId}:${crypto.randomUUID()}`,
        })
        if (!reserved.ok) {
                await persistGatedInbound()
                return { error: 'NO_CREDIT' }
        }
        const reservation = reserved.reservation

        try {
                const [history, catalogServices] = await Promise.all([
                        loadHistory(conversationId, params.inboundEventId),
                        fetchCatalogServices(workspaceId),
                ])

        // Persist the incoming user message (or reuse the event-anchored row
        // that the durable channel handler committed before automation).
                await persistInboundTurnMessage(params, conversationId, false)
        // Every inbound turn (widget, chat-link, and messengers) keeps the
        // contact's denormalized last-activity fresh. Messenger inbound is also
        // bumped in upsertContact; the duplicate is harmless.
                bumpContactActivity(conversationId)

        // Retrieve context and build the prompt.
                const productRequest = planProductRequest(message, history)
                const closingReply = closingReplyText(message, history, agent.language)
                if (closingReply) {
                        const skillPlan = compileAgentSkillPlan({
                                language: agent.language,
                                userMessage: message,
                                history,
                                deterministicClosing: true,
                                identificationPending: freshState === 'pending' && agent.requireCustomerInfo,
                                hasCustomerPreferences: customerPreferences.length > 0,
                                handoffEnabled: agent.handoffEnabled,
                        })
                        // A pure closing needs neither embedding/catalog retrieval
                        // nor an LLM call. The normal ownership, handoff, persistence
                        // and credit-release paths still apply on every channel.
                        return {
                                model, modelAlias, reservation, conversationId, contactId,
                                contactName: resolvedContactName, contactPhone: resolvedContactPhone,
                                messages: [], retrievedChunks: [], catalogProducts: [], productRequest, skillPlan,
                                canBypassDeterministicReply: freshState !== 'pending', closingReply,
                        }
                }
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

                const [catalogProducts, orderContext, catalogCategories] = await Promise.all([
                        agent.productAccessEnabled
                                ? fetchCatalogProducts(agent.id, productIds, productRequest)
                                : Promise.resolve([]),
                        buildOrderContext({
                                workspaceId,
                                message,
                                history,
                                enabled: agent.orderTrackingEnabled,
                                language: agent.language,
                        }),
                        // Category overview keeps browse-turn consulting factual.
                        agent.productAccessEnabled && productRequest.discoveryBrowse
                                ? fetchCatalogCategories(agent.id).catch(() => [] as string[])
                                : Promise.resolve([] as string[]),
                ])
                const turnHistory = historyForProductTurn(history, productRequest)
                const skillPlan = compileAgentSkillPlan({
                        language: agent.language,
                        userMessage: message,
                        history: turnHistory,
                        hasKnowledgeContext: Boolean(contextText),
                        productTurn: productRequest.isProductTurn,
                        catalogAccessEnabled: agent.productAccessEnabled,
                        orderTurn: Boolean(orderContext),
                        bookingTurn: hasBookingIntent([
                                ...history,
                                { role: 'user', content: message },
                        ]),
                        identificationPending: freshState === 'pending' && agent.requireCustomerInfo,
                        hasCustomerPreferences: customerPreferences.length > 0,
                        handoffEnabled: agent.handoffEnabled,
                        salesIntelligenceEnabled: true,
                        richProductCards: agent.productAccessEnabled && params.channel !== 'API',
                })

                const messages = buildMessages({
                        systemPrompt: finalSystemPrompt,
                        language: agent.language,
                        contextText,
                        catalogProducts,
                        catalogServices,
                        history: turnHistory,
                        userMessage: message,
                        catalogAccessEnabled: agent.productAccessEnabled,
                        orderContext,
                        productRequest,
                        catalogCategories,
                        // Web surfaces render cards directly; messenger channels
                        // resolve markers against trusted DB rows before sending.
                        richCards: agent.productAccessEnabled && params.channel !== 'API',
                        skillPlan,
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
                        skillPlan,
                        canBypassDeterministicReply: freshState !== 'pending',
                        closingReply: null,
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
        skillPlan: AgentSkillPlan
        inboundEventId?: string
        inboundAlreadyPersisted?: boolean
}): Promise<{ messageId: string } | null> {
        try {
                const metadata = {
                        agentSkillTrace: agentSkillTrace(params.skillPlan),
                } as unknown as Prisma.InputJsonObject
                const saved = await prisma.$transaction(async (tx) => {
                        let created = true
                        let messageId: string
                        if (params.inboundEventId) {
                                const inserted = await tx.message.createMany({
                                        data: [{
                                                conversationId: params.conversationId,
                                                role: 'ASSISTANT',
                                                content: params.replyText,
                                                metadata,
                                                resultForInboundEventId: params.inboundEventId,
                                        }],
                                        skipDuplicates: true,
                                })
                                created = inserted.count === 1
                                const row = await tx.message.findUniqueOrThrow({
                                        where: { resultForInboundEventId: params.inboundEventId },
                                        select: { id: true, conversationId: true },
                                })
                                if (row.conversationId !== params.conversationId) {
                                        throw new Error('Inbound event result is linked to a different conversation')
                                }
                                messageId = row.id
                        } else {
                                const row = await tx.message.create({
                                        data: {
                                                conversationId: params.conversationId,
                                                role: 'ASSISTANT',
                                                content: params.replyText,
                                                metadata,
                                        },
                                        select: { id: true },
                                })
                                messageId = row.id
                        }
                        await tx.conversation.update({
                                where: { id: params.conversationId },
                                data: {
                                        status: 'HANDED_OFF',
                                        handedOff: true,
                                        ...(created
                                                ? {
                                                        messageCount: {
                                                                increment: params.inboundAlreadyPersisted ? 1 : 2,
                                                        },
                                                        lastMessageAt: new Date(),
                                                }
                                                : {}),
                                },
                        })
                        return { messageId, created }
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
                return { messageId: saved.messageId }
        } catch (e) {
                console.error('[chat-engine] handoff persist error:', e)
                if (params.inboundEventId) throw e
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
        skillPlan: AgentSkillPlan
        inboundEventId?: string
        inboundAlreadyPersisted?: boolean
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
        const saved = await prisma.$transaction(async (tx) => {
                const metadata = metadataWithReceipts(
                        receipts,
                        {
                                ...(unanswered ? { question: params.userMessage } : {}),
                                agentSkillTrace: agentSkillTrace(params.skillPlan) as unknown as Prisma.InputJsonObject,
                        },
                )
                let created = true
                let messageId: string
                if (params.inboundEventId) {
                        const inserted = await tx.message.createMany({
                                data: [{
                                        conversationId: params.conversationId,
                                        role: 'ASSISTANT',
                                        content: params.reply,
                                        unanswered,
                                        metadata,
                                        resultForInboundEventId: params.inboundEventId,
                                }],
                                skipDuplicates: true,
                        })
                        created = inserted.count === 1
                        const row = await tx.message.findUniqueOrThrow({
                                where: { resultForInboundEventId: params.inboundEventId },
                                select: { id: true, conversationId: true },
                        })
                        if (row.conversationId !== params.conversationId) {
                                throw new Error('Inbound event result is linked to a different conversation')
                        }
                        messageId = row.id
                } else {
                        const row = await tx.message.create({
                                data: {
                                        conversationId: params.conversationId,
                                        role: 'ASSISTANT',
                                        content: params.reply,
                                        unanswered,
                                        metadata,
                                },
                                select: { id: true },
                        })
                        messageId = row.id
                }
                if (created) {
                        await tx.conversation.update({
                                where: { id: params.conversationId },
                                data: {
                                        messageCount: {
                                                increment: params.inboundAlreadyPersisted ? 1 : 2,
                                        },
                                        lastMessageAt: new Date(),
                                },
                        })
                }
                return { messageId, created }
        })
        // Keep the contact's denormalized last-activity fresh for the CRM list.
        bumpContactActivity(params.conversationId)
        if (saved.created) await syncOnboarding(params.workspaceId)
        return { messageId: saved.messageId }
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
                skillPlan,
                canBypassDeterministicReply,
                closingReply,
        } = prep

        const encoder = new TextEncoder()
        const stream = new ReadableStream<Uint8Array>({
                async start(controller) {
                        // Once the consumer cancels (visitor closed the tab, lost network),
                        // every enqueue throws per the Streams spec. Swallow that: the turn
                        // must still finish so the generated reply is persisted for the
                        // inbox and the credit is settled correctly. An unguarded enqueue
                        // used to reject start() and skip capture + persistAssistantTurn
                        // entirely, leaving the customer's question unanswered in the DB.
                        let clientGone = false
                        const send = (obj: unknown) => {
                                if (clientGone) return
                                try {
                                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
                                } catch {
                                        clientGone = true
                                }
                        }
                        const closeStream = () => {
                                if (clientGone) return
                                clientGone = true
                                try {
                                        controller.close()
                                } catch {}
                        }

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
                                closeStream()
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
                                        skillPlan,
                                        inboundEventId: params.inboundEventId,
                                        inboundAlreadyPersisted: params.inboundAlreadyPersisted,
                                })
                                send(persisted ? { type: 'done', messageId: persisted.messageId } : { type: 'done' })
                                closeStream()
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
                                        closingReply,
                                })
                                if (deterministicReply) {
                                        // No model call and therefore no AI charge. The DB
                                        // result itself is the trusted response and marker source.
                                        await releaseChatCredit(reservation, closingReply ? 'Conversation closing without AI' : 'Deterministic catalog reply').catch(() => {})
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
                                                        skillPlan,
                                                        inboundEventId: params.inboundEventId,
                                                        inboundAlreadyPersisted: params.inboundAlreadyPersisted,
                                                })
                                                send({ type: 'done', messageId })
                                        } catch (error) {
                                                console.error('[chat-engine] deterministic persist failed:', error)
                                                send({ type: 'done' })
                                        }
                                        closeStream()
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
                                const bookingTurn = hasAgentSkill(skillPlan, 'appointment-booking')
                                        ? await maybeRunBookingAgentTurn({
                                                workspaceId,
                                                conversationId,
                                                contactId,
                                                model,
                                                messages,
                                                temperature: AGENT_RESPONSE_TEMPERATURE,
                                                maxTokens: AGENT_MAX_RESPONSE_TOKENS,
                                        })
                                        : null
                                if (bookingTurn) {
                                        full = bookingTurn.content
                                        usage = bookingTurn.usage
                                        extraReceipts = bookingTurn.receipts
                                        send({ type: 'delta', text: full })
                                } else {
                                        for await (const delta of streamChat({
                                                model,
                                                messages,
                                                temperature: AGENT_RESPONSE_TEMPERATURE,
                                                maxTokens: AGENT_MAX_RESPONSE_TOKENS,
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
                                        full = agent.fallbackMessage || 'یه مشکل فنی پیش اومده، لطفاً چند لحظه بعد دوباره پیام بده'
                                        send({ type: 'delta', text: full })
                                }
                                send({ type: 'error', error: 'STREAM_FAILED' })
                                // A4: count consecutive provider failures and escalate to the
                                // owner + operator once the streak threshold is crossed.
                                void trackProviderFailureStreak({
                                        workspaceId,
                                        conversationId,
                                        agentId: agent.id,
                                        channel: params.channel,
                                        contactId,
                                        contactName,
                                })
                        }

                        // A disconnect is not a provider failure: the reply was generated
                        // and must still be captured and persisted for the inbox.
                        if (clientGone && full.trim()) providerFailed = false

                        // A 2xx provider response with no content is not a
                        // successful reply and must not consume reply credit.
                        if (!providerFailed && !full.trim()) {
                                providerFailed = true
                                full = agent.fallbackMessage || 'یه مشکل فنی پیش اومده، لطفاً چند لحظه بعد دوباره پیام بده'
                                send({ type: 'delta', text: full })
                                send({ type: 'error', error: 'EMPTY_RESPONSE' })
                        }

                        if (
                                hasAgentSkill(skillPlan, 'product-card-hydration') &&
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
                                // A4: a successful reply resets the consecutive-failure streak.
                                await resetProviderFailureStreak(workspaceId)
                                await captureChatCredit(reservation, usage).catch((e) =>
                                        console.error('[chat-engine] credit capture failed:', e),
                                )
                                // A16: post-capture trial quota milestones (80% warning).
                                void processTrialQuotaAlert({ workspaceId }).catch(() => {})
                        }

                        // A5: canonical chat style — drop trailing periods on short Persian prose.
                        full = runAgentSkillPostprocessors(full, skillPlan, {
                                catalogProducts: providerFailed ? [] : catalogProducts,
                        })
                        send({ type: 'replace', text: full })

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
                                        skillPlan,
                                        inboundEventId: params.inboundEventId,
                                        inboundAlreadyPersisted: params.inboundAlreadyPersisted,
                                })
                                send({ type: 'done', messageId })
                        } catch (e) {
                                console.error('[chat-engine] persist error:', e)
                                send({ type: 'done' })
                        }

                        closeStream()
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
        | { conversationId: string; reply: string; messageId?: string; replayed?: boolean }

export interface GenerateReplyOptions {
        /** Runs only after ownership and handoff gates confirm that AI will generate. */
        onGenerationStart?: () => void | Promise<void>
        /** Receives the complete text-so-far as provider deltas arrive. */
        onTextUpdate?: (text: string) => void
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

        // A previous worker may have committed the assistant row and crashed
        // before it could finish the ledger. Reuse that durable result without
        // another model call, credit reservation, or message/counter mutation.
        if (params.inboundEventId) {
                const committed = await prisma.message.findUnique({
                        where: { resultForInboundEventId: params.inboundEventId },
                        select: { id: true, conversationId: true, content: true },
                })
                if (committed) {
                        return {
                                conversationId: committed.conversationId,
                                reply: committed.content,
                                messageId: committed.id,
                                replayed: true,
                        }
                }
        }

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
                skillPlan,
                canBypassDeterministicReply,
                closingReply,
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
                const persisted = await persistHandoff({
                        workspaceId,
                        agent,
                        conversationId,
                        channel: params.channel,
                        contactId,
                        contactName,
                        contactPhone,
                        reason: handoffCheck.reason,
                        replyText: reply,
                        skillPlan,
                        inboundEventId: params.inboundEventId,
                        inboundAlreadyPersisted: params.inboundAlreadyPersisted,
                })
                return { conversationId, reply, messageId: persisted?.messageId }
        }

        try {
                const deterministicReply = await buildDeterministicTurnReply({
                        workspaceId,
                        agent,
                        channel: params.channel,
                        catalogProducts,
                        productRequest,
                        canBypass: canBypassDeterministicReply,
                        closingReply,
                })
                if (deterministicReply) {
                        await options.onGenerationStart?.()
                        options.onTextUpdate?.(deterministicReply)
                        await releaseChatCredit(reservation, closingReply ? 'Conversation closing without AI' : 'Deterministic catalog reply').catch(() => {})
                        try {
                                const persisted = await persistAssistantTurn({
                                        workspaceId,
                                        agent,
                                        conversationId,
                                        model,
                                        userMessage: message,
                                        reply: deterministicReply,
                                        retrievedChunks,
                                        extraReceipts: [],
                                        skillPlan,
                                        inboundEventId: params.inboundEventId,
                                        inboundAlreadyPersisted: params.inboundAlreadyPersisted,
                                })
                                return {
                                        conversationId,
                                        reply: deterministicReply,
                                        messageId: persisted.messageId,
                                }
                        } catch (error) {
                                console.error('[chat-engine] deterministic persist failed:', error)
                                if (params.inboundEventId) throw error
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
                const bookingTurn = hasAgentSkill(skillPlan, 'appointment-booking')
                        ? await maybeRunBookingAgentTurn({
                                workspaceId,
                                conversationId,
                                contactId,
                                model,
                                messages,
                                temperature: AGENT_RESPONSE_TEMPERATURE,
                                maxTokens: AGENT_MAX_RESPONSE_TOKENS,
                        })
                        : null
                if (bookingTurn) {
                        reply = bookingTurn.content.trim()
                        usage = bookingTurn.usage
                        extraReceipts = bookingTurn.receipts
                        options.onTextUpdate?.(reply)
                } else if (options.onTextUpdate) {
                        for await (const delta of streamChat({
                                model,
                                messages,
                                temperature: AGENT_RESPONSE_TEMPERATURE,
                                maxTokens: AGENT_MAX_RESPONSE_TOKENS,
                                onUsage: (value) => {
                                        usage = value
                                },
                        })) {
                                reply += delta
                                options.onTextUpdate(reply)
                        }
                        reply = reply.trim()
                } else {
                        const result = await chatCompletion({
                                model,
                                messages,
                                temperature: AGENT_RESPONSE_TEMPERATURE,
                                maxTokens: AGENT_MAX_RESPONSE_TOKENS,
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
                // A4: count consecutive provider failures and escalate to the
                // owner + operator once the streak threshold is crossed.
                void trackProviderFailureStreak({
                        workspaceId,
                        conversationId,
                        agentId: agent.id,
                        channel: params.channel,
                        contactId,
                        contactName,
                })
        }
        if (!reply) {
                // Empty provider content is a failed reply for billing purposes.
                providerFailed = true
                reply = agent.fallbackMessage || 'یه مشکل فنی پیش اومده، لطفاً چند لحظه بعد دوباره پیام بده'
        }

        // Canonicalize markers for every public messenger before persistence
        // and return. Text, carousel and conversation UIs now share the exact
        // same trusted DB result-set; model-authored ids/prices never leak.
        if (
                hasAgentSkill(skillPlan, 'product-card-hydration') &&
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
                // A4: a successful reply resets the consecutive-failure streak.
                await resetProviderFailureStreak(workspaceId)
                await captureChatCredit(reservation, usage).catch((e) =>
                        console.error('[chat-engine] credit capture failed:', e),
                )
                // A16: post-capture trial quota milestones (80% warning).
                void processTrialQuotaAlert({ workspaceId }).catch(() => {})
        }

        // A5: canonical chat style — drop trailing periods on short Persian prose.
        reply = runAgentSkillPostprocessors(reply, skillPlan, {
                catalogProducts: providerFailed ? [] : catalogProducts,
        })

        let persistedMessageId: string | undefined
        try {
                const persisted = await persistAssistantTurn({
                        workspaceId,
                        agent,
                        conversationId,
                        model,
                        userMessage: message,
                        reply,
                        retrievedChunks,
                        extraReceipts,
                        skillPlan,
                        inboundEventId: params.inboundEventId,
                        inboundAlreadyPersisted: params.inboundAlreadyPersisted,
                })
                persistedMessageId = persisted.messageId
        } catch (e) {
                console.error('[chat-engine] persist error:', e)
                if (params.inboundEventId) throw e
        }

        return { conversationId, reply, messageId: persistedMessageId }
}
