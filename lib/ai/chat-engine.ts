/**
 * The chat engine: orchestrates one customer turn end-to-end for every
 * surface (web stream and messengers).
 *
 *   gates (ownership, plan, credit) → identity → history/state →
 *   UNDERSTAND (lib/agent/turn/understand-stage.ts) → decide per domain
 *   (the verified model reading; a turn without one is a plain conversation turn) →
 *   retrieve/execute (catalog, order flow, restock, tracking, booking/course)
 *   → compose (prompt + turn brief) → reply → guards → persist (+ turn cost,
 *   product memory, pending offer).
 *
 * Stage helpers live in lib/agent/turn/; conversation/data loading in
 * lib/ai/conversation.ts and escalation policy in lib/ai/handoff.ts.
 */
import { prisma } from '@/lib/prisma'
import {
        getPlatformOpenRouterKey,
        streamChatWithRetry,
        chatCompletion,
        type ChatMessage,
        type ChatUsage,
} from '@/lib/ai/openrouter'
import { retrieveContext, buildMessages, type CatalogProduct } from '@/lib/ai/rag'
import { readCustomerAgentPreferences } from '@/lib/ai/customer-agent-preferences'
import { readEvidenceMemory, activeFacts } from '@/lib/ai/memory-evidence'
import { captureStatedFacts } from '@/lib/ai/fact-capture'
import { emptyOrderSignals } from '@/lib/commerce/order-signals'
import { hasActiveOrderDraft, markOrderDraftSubmitted, resolveOrderCaptureTurn } from '@/lib/commerce/order-service'
import { restockMode, restockOfferLine } from '@/lib/commerce/restock'
import { rememberRestockOffer, resolveRestockTurn, unavailableItemsFromCatalog } from '@/lib/commerce/restock-service'
import { insertBeforeTurnMarker, runCatalogSearches, type CatalogToolReason } from '@/lib/ai/catalog-tools'
import { previousSessionPlanningRows } from '@/lib/ai/conversation-memory'
import { extractTurnSignal, visibleWhileStreaming, type TurnSignal } from '@/lib/ai/turn-signal'
import { extractIdentity, applyExtractedIdentity } from '@/lib/ai/customer-identification'
import { extractIdentityWithAi } from '@/lib/ai/ai-identity-extractor'
import {
  resolveConversation,
  loadHistory,
  fetchCatalogCategories,
  fetchCatalogProducts,
  fetchCatalogProductsByIds,
  fetchCatalogServices,
  historyForProductTurn,
  isHumanOwnedConversation,
  showcaseSubjectPhrase,
  isNarrowedProductRequest,
  assistantCardIds,
  GLOBAL_PRODUCT_WORDS,
  normalizePersianText,
  type ProductRequestPlan,
} from '@/lib/ai/conversation'
import { catalogSearchVocabulary, getAgentCatalogLexicon } from '@/lib/ai/catalog-lexicon'
import { correctSearchTerms } from '@/lib/search/fuzzy-terms'
import { shouldHandoff, handoffReplyText } from '@/lib/ai/handoff'
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
import { detectTurnLanguage, type TurnLanguage } from '@/lib/ai/turn-language'
import type { ChatAgent, StartChatParams } from '@/lib/ai/chat-types'
import type { ConversationReceipt } from '@/lib/conversations/activity'
import { maybeRunBookingAgentTurn } from '@/lib/bookings/chat-orchestrator'
import { maybeRunCourseAgentTurn } from '@/lib/courses/chat-orchestrator'
import { refreshConversationSalesInsight, salesGuidanceForModel } from '@/lib/ai/sales-intelligence'
import { buildOrderContext } from '@/lib/ai/order-context'
import { buildTrustedProductReply, parseProductDirectives } from '@/lib/products/presentation'
import { compileAgentSkillPlan } from '@/lib/agent-kernel/registry'
import { hasAgentSkill, type AgentSkillPlan } from '@/lib/agent-kernel/contracts'
import { createLivePreviewGuard, runAgentSkillPostprocessors } from '@/lib/agent-kernel/postprocess'
import { linkEvidenceForTurn, resolveLinkGuardMode } from '@/lib/agent-kernel/skills/link-grounding'
import { repairUngroundedLinkReply } from '@/lib/agent/turn/link-repair'
import { loadWorkspaceModules } from '@/lib/verticals/workspace-capabilities'
import { processTrialQuotaAlert } from '@/lib/billing/trial-quota-alert'
import {
        AGENT_MAX_RESPONSE_TOKENS,
        AGENT_RESPONSE_TEMPERATURE,
} from '@/lib/ai/agent-runtime'
import { loadCustomerChannelContext } from '@/lib/ai/customer-channel-context'
import {
  advanceConversationWorkingState,
  buildConversationStateTrace,
  createEmptyConversationWorkingState,
  enrichConversationStateWithCatalog,
  loadConversationWorkingState,
  promoteConversationStateToProduct,
  type ConversationStateTrace,
  type ConversationWorkingState,
  type PendingStateKind,
} from '@/lib/ai/conversation-state'
import { TurnLedger } from '@/lib/ai/llm/aux'
import { UNDERSTANDING_DOMAINS } from '@/lib/agent/understand/domains'
import { runUnderstandingStage } from '@/lib/agent/turn/understand-stage'
import { emptyProductPlan } from '@/lib/agent/turn/route'
import { closingReplyFor, composeSpellingNote, composeTurnBrief } from '@/lib/agent/turn/brief'
import { recordCustomerReading } from '@/lib/agent/turn/customer-reading'
import { buildSystemPrompt, defaultProviderFailureText, appendSalesGuidance } from '@/lib/agent/turn/prompt'
import { buildDeterministicTurnReply, freshCardIds } from '@/lib/agent/turn/deterministic'
import { loadCommerceFlags, orderPrefill, type CommerceTurn } from '@/lib/agent/turn/commerce'
import { resetProviderFailureStreak, trackProviderFailureStreak } from '@/lib/agent/turn/provider-failure'
import {
        persistAssistantTurn,
        persistHandoff,
        persistInboundTurnMessage,
        type AssistantTurnObservation,
} from '@/lib/agent/turn/persist'

// Re-exported so existing imports (routes, channel handler) keep working.
export type { ChatAgent, StartChatParams } from '@/lib/ai/chat-types'
export { catalogNoMatchReply } from '@/lib/agent/turn/deterministic'

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
 * Apply the owner's capability switches before anything else reads the
 * agent: with products off the catalog and pre-orders go quiet, and the
 * booking/course workflows only run while their capability is on.
 */
async function withCapabilityGates(params: StartChatParams): Promise<StartChatParams> {
        if (params.capabilityGates) return params
        let modules: Set<string>
        try {
                modules = await loadWorkspaceModules(params.workspaceId)
        } catch (error) {
                // Fail open to the agent's own switches rather than breaking a turn.
                console.error('[chat-engine] capability read failed:', error)
                return { ...params, capabilityGates: { products: true, bookings: true, courses: true } }
        }
        const capabilityGates = {
                products: modules.has('products'),
                bookings: modules.has('appointments'),
                courses: modules.has('courses'),
        }
        return {
                ...params,
                capabilityGates,
                agent: {
                        ...params.agent,
                        productAccessEnabled: params.agent.productAccessEnabled && capabilityGates.products,
                },
        }
}

/** Everything completeTurn needs from the preparation stage. */
export interface PreparedTurnData {
        model: string
        modelAlias: string
        reservation: CreditReservation
        conversationId: string
        contactId: string | null
        contactName: string | null
        contactPhone: string | null
        messages: ChatMessage[]
        retrievedChunks: Array<{ metadata: unknown }>
        catalogProducts: CatalogProduct[]
        productRequest: ProductRequestPlan
        skillPlan: AgentSkillPlan
        canBypassDeterministicReply: boolean
        closingReply: string | null
        /** Reply locale detected from the customer's message. */
        turnLang: TurnLanguage
        /** Order-context block built for this turn — non-empty strings
         *  other than <verified_order> are instruction-only guards. */
        orderContext: string
        /** Structured current-session context used by every channel. */
        workingState: ConversationWorkingState
        stateExpectedRevision: number | null
        stateTrace: ConversationStateTrace
        /** A human is needed (verified reading, or the legacy analyzer's rescue verdict). */
        analyzerHandoffSignal: boolean
        /** Product ids carded in the agent's previous reply. */
        recentCardIds: string[]
        /** Deterministic pre-order / back-in-stock step for this turn. */
        commerceTurn: CommerceTurn
        /** The catalog search tools ran (or may run) this turn. */
        catalogToolReason: CatalogToolReason | null
        /** Deliverable back-in-stock offer for a sold-out answer. */
        restockOffer: string | null
        /** The agent files in-chat pre-orders (capability guard mode). */
        orderCaptureEnabled: boolean
        /** Every model call of this turn (understanding, planners, reply). */
        ledger?: TurnLedger
        /** Domains that routed from the understanding layer on this turn. */
        understoodDomains?: string[]
        /** The reading found a request to order in chat that this agent cannot take. */
        orderAsked?: boolean
        bookingHint?: string
        bookingConfirmed?: boolean
        bookingIntentKnown?: boolean
        courseHint?: string
        /** Products identified on this turn (product memory). */
        discussedProducts?: Array<{ id: string; name: string }>
}

async function prepareTurn(params: StartChatParams): Promise<
        | { error: 'AI_UNAVAILABLE' }
        | { error: 'NO_CREDIT' }
        | { error: 'OPERATOR_ACTIVE'; conversationId: string }
        | { error: 'PLAN_BLOCKED'; reason: BlockReason }
        | PreparedTurnData
> {
        const { workspaceId, message } = params
        const commerceFlags = await loadCommerceFlags(params.agent)
        const agent: ChatAgent = {
                ...params.agent,
                ...commerceFlags,
                // Pre-orders sell from the catalog: off with the products capability.
                orderCaptureEnabled: commerceFlags.orderCaptureEnabled && params.capabilityGates?.products !== false,
        }

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

        // Plan gate: every channel requires an active trial/subscription.
        // Deterministic Instagram automations bypass this AI path and consume no
        // reply credit, but their runtime is gated separately by the channel handler.
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

        // F3 v2: identity extraction from the inbound user message, merged with
        // structured identity from the widget's pre-chat lead form.
        //
        // Gating (production audit): v1 mined names out of ordinary prose on
        // EVERY turn («من دیروز درخواست دادم» → contact «دیروز درخو») even when
        // customer identification was disabled for the agent. Free-text NAME
        // extraction now only runs while the conversation is actually in the
        // identification flow — customerInfoState 'pending' (the agent is
        // actively asking) or the lead form supplied structured identity. Phone
        // extraction stays always-on: the digit pattern is precise and a
        // volunteered number is valuable in every configuration.
        const identificationActive =
                conversation.customerInfoState === 'pending' ||
                Boolean(params.contactName?.trim() || params.contactPhone?.trim())
        const extracted = extractIdentity(message)
        if (!identificationActive) extracted.name = null
        // The structured lead-form name is trusted input; it outranks the
        // heuristic (v1 let junk override the real form name).
        if (params.contactName?.trim()) {
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

        // F3 v2 — LLM rescue layer: the conservative regex only trusts
        // unambiguous self-introductions; prose like «من علی هستم» or
        // «مینا هستم، شماره‌ام ۰۹۱۲…» falls through to a cheap extraction call
        // while the identification flow is active. Fire-and-forget — the
        // customer's reply never waits on it, and the extractor applies what it
        // finds through the same locked find-or-create path, so concurrent
        // regex/AI outcomes converge on one merged contact row.
        if (identificationActive && !extracted.name && message.trim().length >= 3) {
                void extractIdentityWithAi({
                        workspaceId,
                        conversationId,
                        agentId: agent.id,
                        message,
                }).catch(() => {})
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

        // Capture durable facts the customer states on THIS channel into the
        // contact-level evidence memory, so every other channel of the same
        // contact knows them ("من تهرانم" on Telegram must reach Instagram
        // too). Deterministic + zero-LLM, and a no-op without a first-person
        // statement; awaited (one locked row update) so this turn's prompt and
        // the next turn never race on a stale snapshot.
        const capturedMetadata = contactId && message.trim().length >= 4
                ? await captureStatedFacts({
                        workspaceId,
                        conversationId,
                        contactId,
                        agentId: agent.id,
                        channel: params.channel,
                        text: message,
                        messageId: params.inboundEventId ?? undefined,
                })
                : null
        const contactMetadata = capturedMetadata ?? contact?.metadata ?? null
        const customerPreferences = contact
                ? readCustomerAgentPreferences(contactMetadata, agent.id)
                : []
        const evidenceMemory = contact
                ? readEvidenceMemory(contactMetadata, agent.id)
                : null
        // History must load before the prompt is built so the reply language
        // can inherit the customer's last lettered message when the current
        // one is digits-only («0788»). Loading here (before the credit
        // reservation) keeps the same error semantics: a history failure
        // surfaces without ever holding a reservation.
        const [history, catalogServices, loadedState] = await Promise.all([
                loadHistory(conversationId, params.inboundEventId),
                fetchCatalogServices(workspaceId),
                loadConversationWorkingState(conversationId, params.inboundEventId).catch((error) => {
                        // State is a reconstructable transcript cache. A missing
                        // migration/transient read must never suppress a reply.
                        captureError('chat-engine:conversation-state-load', error, {
                                workspaceId,
                                metadata: { agentId: agent.id, conversationId },
                        })
                        return {
                                state: createEmptyConversationWorkingState(),
                                expectedRevision: null,
                        }
                }),
        ])
        const crossChannelContext = await loadCustomerChannelContext({
                        workspaceId,
                        agentId: agent.id,
                        contactId,
                        conversationId,
                        currentChannel: params.channel,
                        userMessage: message,
                        hasLocalHistory: history.some((item) => item.role === 'user' || item.role === 'assistant'),
                }).catch((error) => {
                        // Omnichannel recall is an enhancement, never a reason to
                        // drop the customer's current turn during a transient DB
                        // failure. The active conversation history still loads.
                        captureError('chat-engine:cross-channel-context', error, {
                                workspaceId,
                                metadata: { agentId: agent.id, conversationId, contactId },
                        })
                        return { modelHistory: [], planningHistory: [] }
                })
        // A returning customer's previous session (behind the idle boundary)
        // is planning context too: «همون میزی که دفعه قبل پرسیدم» must ground
        // that product again instead of a random catalog row.
        const planningHistory = [
                ...crossChannelContext.planningHistory,
                ...previousSessionPlanningRows(history),
                ...history,
        ]
        const modelHistory = [...crossChannelContext.modelHistory, ...history]
        // Language mirroring: the reply locale comes from what the customer
        // actually wrote THIS turn — never from a pinned agent locale.
        let turnLang = detectTurnLanguage(message, planningHistory)
        const systemPromptFor = (language: TurnLanguage) => buildSystemPrompt({
                agent,
                customerInfoState: freshState,
                contactName: resolvedContactName,
                customerPreferences,
                evidenceMemory,
                turnLanguage: language,
                channel: params.channel,
                inboundSource: params.inboundMetadata ?? null,
        })
        let finalSystemPrompt = systemPromptFor(turnLang)

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
        // Persist the incoming user message (or reuse the event-anchored row
        // that the durable channel handler committed before automation).
                const inbound = await persistInboundTurnMessage(params, conversationId, false)
        // Every inbound turn (widget, chat-link, and messengers) keeps the
        // contact's denormalized last-activity fresh. Messenger inbound is also
        // bumped in upsertContact; the duplicate is harmless.
                bumpContactActivity(conversationId)
                // Every model call of this turn (understanding, planners, reply)
                // is collected here and stored on the assistant message.
                const ledger = new TurnLedger(params.inboundEventId ?? inbound.id)

        // ── Catalog lexicon (data-driven intent) ──────────────────────────
        // The tenant's own catalog vocabulary: spelling anchors for the
        // understanding layer and subject terms for grounded search. Fails
        // open (null) so a cache hiccup never breaks the turn.
        const catalogLexicon = agent.productAccessEnabled
                ? await getAgentCatalogLexicon(agent.id).catch(() => null)
                : null
        const corpusTokens = catalogLexicon?.identityTokens ?? undefined
        // Identity plus attribute/variation words (رنگ، سایز، طرح…) for spelling
        // fixes and for verifying the understanding layer's search terms.
        const searchVocabulary = catalogSearchVocabulary(catalogLexicon)
                const lastAssistantText = [...history].reverse().find((item) => item.role === 'assistant')?.content ?? null
                // An order in progress or a back-in-stock request is never a
                // «مرسی/باشه» closing: «باشه» confirms a summary there.
                const hasDraft = agent.orderCaptureEnabled ? await hasActiveOrderDraft(conversationId) : false
                // ── Understand ─────────────────────────────────────────────
                const understanding = await runUnderstandingStage({
                        workspaceId,
                        agent,
                        modelAlias,
                        conversationId,
                        inboundMessageId: inbound.id,
                        message,
                        history: modelHistory,
                        state: loadedState.state,
                        capabilityGates: params.capabilityGates,
                        serviceNames: catalogServices.map((service) => service.name),
                        corpusTokens: corpusTokens ?? null,
                        searchVocabulary,
                        ledger,
                        turnLang,
                })
                const route = understanding.route
                // «salam rimel zed ab darid?» is Persian typed in Latin letters.
                // The letter count reads it as English; the reading knows better.
                if (turnLang === 'en' && understanding.outcome?.ok && understanding.outcome.verified.language === 'fa') {
                        turnLang = 'fa'
                        finalSystemPrompt = systemPromptFor(turnLang)
                }
                // Every routing decision below comes from the verified reading.
                // A turn whose reading could not be obtained has no route: nothing
                // is read into the message, and the model answers it as a plain
                // conversation turn with the retrieved knowledge in front of it.
                const routedDomains = route ? [...UNDERSTANDING_DOMAINS] : []
                if (understanding.outcome?.ok) {
                        recordCustomerReading(inbound.id, understanding.outcome.verified)
                }

                let workingState = advanceConversationWorkingState({
                        state: loadedState.state,
                        sessionStartId: loadedState.state.sessionStartId || inbound.id,
                        message,
                        messageId: inbound.id,
                        createdAt: inbound.createdAt,
                        understood: route ? route.stateTurn : null,
                })
                const productsRouted = route !== null
                // The verified reading decides whether this is a product turn and
                // which rows it is about.
                const routedPlan = route?.productPlan ?? emptyProductPlan()
                let productRequest: ProductRequestPlan = agent.productAccessEnabled
                        ? routedPlan
                        : { ...routedPlan, isProductTurn: false }

                const closingReply = route?.closing && !hasDraft
                        ? closingReplyFor(route.closing, turnLang === 'en' ? 'en' : 'fa')
                        : null
                if (closingReply) {
                        const skillPlan = compileAgentSkillPlan({
                                language: turnLang,
                                userMessage: message,
                                history: modelHistory,
                                deterministicClosing: true,
                                identificationPending: freshState === 'pending' && agent.requireCustomerInfo,
                                hasCustomerPreferences: customerPreferences.length > 0,
                                handoffEnabled: agent.handoffEnabled,
                                hasConversationState: Boolean(workingState.activeGoal || workingState.lastAnswer),
                        })
                        const stateTrace = buildConversationStateTrace({
                                state: workingState,
                                historyLoaded: modelHistory.filter((item) => item.role !== 'system').length,
                                historySent: modelHistory.filter((item) => item.role !== 'system').length,
                                resetReason: productRequest.requestNewTopic
                                        ? 'EXPLICIT_RESET'
                                        : productRequest.resetProductContext ? 'NEW_PRODUCT_SUBJECT' : null,
                                retrievalQuery: '',
                        })
                        understanding.finalize(routedDomains)
                        // A pure closing needs neither embedding/catalog retrieval
                        // nor an LLM call. The normal ownership, handoff, persistence
                        // and credit-release paths still apply on every channel.
                        return {
                                model, modelAlias, reservation, conversationId, contactId,
                                contactName: resolvedContactName, contactPhone: resolvedContactPhone,
                                messages: [], retrievedChunks: [], catalogProducts: [], productRequest, skillPlan,
                                canBypassDeterministicReply: freshState !== 'pending', closingReply,
                                turnLang,
                                orderContext: '',
                                workingState,
                                stateExpectedRevision: loadedState.expectedRevision,
                                stateTrace,
                                analyzerHandoffSignal: false,
                                recentCardIds: [],
                                commerceTurn: { kind: 'none' },
                                catalogToolReason: null,
                                restockOffer: null,
                                orderCaptureEnabled: agent.orderCaptureEnabled === true,
                                ledger,
                                understoodDomains: routedDomains,
                        }
                }

                // Rows the customer referred to by ref (card / active / seen /
                // cart) are loaded by id; only a description search goes to
                // vector + lexical retrieval.
                const referencedIds = productsRouted ? route.productIds : []
                // Misspelled search words («شلوا», «آپادنا») become the catalog
                // word they mean before vector and lexical search see them.
                let spellingNote = ''
                if (agent.productAccessEnabled && productRequest.isProductTurn && referencedIds.length === 0 && productRequest.searchTerms.length) {
                        const spelled = correctSearchTerms(productRequest.searchTerms, searchVocabulary, { protect: GLOBAL_PRODUCT_WORDS })
                        if (spelled.corrections.length) {
                                productRequest = {
                                        ...productRequest,
                                        searchTerms: spelled.terms,
                                        corpusSubjectTerms: [...new Set([
                                                ...(productRequest.corpusSubjectTerms ?? []),
                                                ...spelled.terms.filter((term) => corpusTokens?.has(term)),
                                        ])],
                                }
                                spellingNote = composeSpellingNote(spelled.corrections, turnLang === 'en' ? 'en' : 'fa')
                        }
                }
                // Two requests in one message («ریمل ضد آب دارید؟ ارسال به مشهد چند
                // روزه؟»): a vitrine built without the model answers only the
                // first. The model writes this reply and the cards follow it.
                if (route?.multiIntent && productRequest.explicitShowcase) {
                        productRequest = { ...productRequest, explicitShowcase: false, includeProductCards: true }
                }
                const searchingCatalog = agent.productAccessEnabled && productRequest.isProductTurn && referencedIds.length === 0
                const retrievalQuery = productRequest.isProductTurn && productRequest.searchTerms.length && referencedIds.length === 0
                        ? productRequest.searchTerms.join(' ')
                        : message
                // What the knowledge base is asked: the verified question with its
                // subject named («ابعادش؟» → «ابعاد میز تلویزیون آپادانا ۱۶۰»), next to
                // the customer's own words.
                const knowledgeQuery = route?.knowledgeQuery
                        ? `${route.knowledgeQuery} ${message.length <= 200 ? message : ''}`.trim()
                        : ''
                const [primaryContext, knowledgeContext] = await Promise.all([
                        retrieveContext({
                                workspaceId,
                                agentId: agent.id,
                                query: searchingCatalog || !knowledgeQuery ? retrievalQuery : knowledgeQuery,
                                limit: searchingCatalog
                                        ? Math.min(24, Math.max(12, productRequest.requestedCount * 2))
                                        : 5,
                                includeProductCatalog: searchingCatalog,
                                excludeProductContentFromText: true,
                                contextTextLimit: searchingCatalog ? 4 : 5,
                        }),
                        // «قیمت آپادانا ۱۶۰ چنده، ارسال به تبریز چند روزه و قسطی هم
                        // می‌دید؟»: the product words find the product, not the
                        // shipping and instalment rules. Those are looked up on their own.
                        searchingCatalog && knowledgeQuery
                                ? retrieveContext({
                                        workspaceId,
                                        agentId: agent.id,
                                        query: knowledgeQuery,
                                        limit: 5,
                                        includeProductCatalog: false,
                                        excludeProductContentFromText: true,
                                        contextTextLimit: 5,
                                })
                                : Promise.resolve(null),
                ])
                const chunks = primaryContext.chunks
                const contextText = knowledgeContext?.contextText || primaryContext.contextText
                bumpProductQueries(workspaceId, chunks)

                // An explicit human request or a high-severity complaint in the
                // verified reading escalates to a person.
                const analyzerHandoffSignal = route ? route.handoff.human || route.handoff.complaintHigh : false

                const productIds = [...new Set([
                        ...chunks
                        .map((chunk) => {
                                const metadata = chunk.metadata
                                if (!(metadata && typeof metadata === 'object' && 'productId' in metadata)) return null
                                // D3 guard: a product chunk is trusted recall evidence only
                                // when it is a STRONG vector hit or carried a lexical rank.
                                if (chunk.similarity < 0.45 && chunk.lexicalRank == null) return null
                                return String((metadata as Record<string, unknown>).productId)
                        })
                        .filter((id): id is string => !!id),
                ])]

                const recentAssistants = history.filter((item) => item.role === 'assistant').slice(-2)
                // Cards the customer received in the last two replies: not
                // re-sent on follow-ups, and their names need no re-introduction.
                const shownCardIds = [...new Set(recentAssistants.flatMap((item) => assistantCardIds(item)))]
                // «خیلی گرونه، ارزون‌ترش چی دارید؟»: measure alternatives against the
                // item under discussion; the search itself applies the price ceiling.
                const cheaperReferenceId = route?.cheaperReferenceId ?? null
                if (productRequest.cheaperAlternative && agent.productAccessEnabled) {
                        const [reference] = cheaperReferenceId
                                ? await fetchCatalogProductsByIds(agent.id, [cheaperReferenceId]).catch(() => [])
                                : []
                        if (reference?.price != null) {
                                productRequest = {
                                        ...productRequest,
                                        explicitShowcase: false,
                                        cheaperThan: { name: reference.name, price: reference.price },
                                }
                        }
                }
                let catalogSearchInstruction = ''
                let catalogToolReason: CatalogToolReason | null = null
                const loadCatalog = async (): Promise<CatalogProduct[]> => {
                        if (!agent.productAccessEnabled) return []
                        if (productsRouted && referencedIds.length) {
                                const rows = await fetchCatalogProductsByIds(agent.id, referencedIds)
                                // A reference resolved to ONE catalog row identifies it:
                                // its card/link/price follow it like an exact match.
                                return route.productsIdentified && rows.length === 1
                                        ? rows.map((row) => ({ ...row, fullTermMatch: true }))
                                        : rows
                        }
                        if (productsRouted && route.catalogSearch && productRequest.isProductTurn) {
                                // Budgets and superlatives: the verified numbers run
                                // server-side, no separate planner call.
                                const search = await runCatalogSearches({
                                        vocabulary: searchVocabulary,
                                        agentId: agent.id,
                                        message,
                                        calls: route.catalogSearch.calls,
                                        reason: route.catalogSearch.reason,
                                        isFa: turnLang !== 'en',
                                        budget: route.catalogSearch.budget,
                                        sort: route.catalogSearch.sort,
                                })
                                catalogToolReason = route.catalogSearch.reason
                                catalogSearchInstruction = search?.instruction ?? ''
                                return search?.products ?? []
                        }
                        // «X با Y چه فرقی داره؟»: one search per named product. A
                        // single search for both names finds neither, or one of them,
                        // and the reply then denies a product the store sells.
                        if (productsRouted && route.productSearches.length > 1) {
                                const sides = await Promise.all(route.productSearches.map((terms) => fetchCatalogProducts(agent.id, [], {
                                        ...productRequest,
                                        searchTerms: terms,
                                        corpusSubjectTerms: corpusTokens ? terms.filter((term) => corpusTokens.has(term)) : [],
                                        explicitShowcase: false,
                                        comparisonConsult: false,
                                        inventoryMode: 'ANY',
                                        requestedCount: 3,
                                }, corpusTokens).catch(() => [] as CatalogProduct[])))
                                const isFaTurn = turnLang !== 'en'
                                const found = sides.map((rows) => {
                                        const exact = rows.filter((row) => row.fullTermMatch)
                                        return (exact.length ? exact : rows.filter((row) => !row.nearMatch)).slice(0, 2)
                                })
                                const lines = found.map((rows, index) => {
                                        const asked = route.productSearches[index].join(' ')
                                        if (isFaTurn) return rows.length ? `«${asked}» ← ${rows.map((row) => `«${row.name}»`).join('، ')}` : `«${asked}» ← در کاتالوگ پیدا نشد`
                                        return rows.length ? `“${asked}” → ${rows.map((row) => `“${row.name}”`).join(', ')}` : `“${asked}” → not found in the catalog`
                                })
                                catalogSearchInstruction = isFaTurn
                                        ? `\n\n=== نتیجهٔ جست‌وجوی دقیق کاتالوگ ===\nمشتری چند محصول را نام برده و هر کدام جدا جست‌وجو شد:\n${lines.join('\n')}\nدربارهٔ هر محصول فقط از ردیف خودش در کاتالوگ همین نوبت جواب بده. تفاوت‌ها را فقط از نام، دسته، توضیحات و قیمت همین ردیف‌ها بگو؛ اگر مشخصه‌ای ثبت نشده، بگو ثبت نشده. فقط دربارهٔ محصولی که «پیدا نشد» بگو در کاتالوگ نیست.`
                                        : `\n\n=== Exact catalog search ===\nThe customer named several products; each was searched on its own:\n${lines.join('\n')}\nAnswer about each product only from its own row in this turn's catalog. State differences only from the name, category, description and price of these rows; say so when a spec is not recorded. Only a product marked not found may be called missing.`
                                const seen = new Set<string>()
                                return found.flat().filter((row) => !seen.has(row.id) && seen.add(row.id)).slice(0, 6)
                        }
                        // The words of a need narrow the search only when product
                        // NAMES carry them: «ریمل» + «ضد آب» is the waterproof mascaras,
                        // «ضد آفتاب» + «پوست چرب» stays every sunscreen and the reply
                        // picks from their descriptions.
                        if (productsRouted && route.needTerms.length && productRequest.searchTerms.length) {
                                const narrowed = await fetchCatalogProducts(agent.id, productIds, {
                                        ...productRequest,
                                        searchTerms: [...new Set([...productRequest.searchTerms, ...route.needTerms])].slice(0, 8),
                                        inventoryMode: 'ANY',
                                        requestedCount: Math.max(productRequest.requestedCount, 6),
                                }, corpusTokens, workingState.candidateEntityIds).catch(() => [] as CatalogProduct[])
                                const named = narrowed.filter((row) => {
                                        const name = normalizePersianText(row.name).toLocaleLowerCase('fa')
                                        return !row.nearMatch && route.needTerms.every((term) => name.includes(term))
                                })
                                const buyable = named.filter((row) => row.stock !== 0 && !row.unavailable)
                                if (buyable.length) return buyable
                                if (named.length) return named.map((row) => ({ ...row, unavailable: true }))
                        }
                        return fetchCatalogProducts(agent.id, productIds, productRequest, corpusTokens, workingState.candidateEntityIds)
                }
                const [fetchedCatalogProducts, orderContext, catalogCategories] = await Promise.all([
                        loadCatalog(),
                        buildOrderContext({
                                workspaceId,
                                message,
                                history,
                                enabled: agent.orderTrackingEnabled,
                                language: agent.language,
                                follow: agent.orderUpdatesEnabled
                                        ? { agentId: agent.id, conversationId, channel: params.channel }
                                        : null,
                                understood: { tracking: route?.orderTracking ?? null },
                        }),
                        // Category overview keeps browse-turn consulting factual.
                        agent.productAccessEnabled && productRequest.discoveryBrowse
                                ? fetchCatalogCategories(agent.id).catch(() => [] as string[])
                                : Promise.resolve([] as string[]),
                ])
                let catalogProducts = fetchedCatalogProducts
                // A described product the strict search did not find: one broader
                // deterministic search (synonyms are already in the terms) before
                // any «not found» — no planner call on the understanding path.
                if (
                        productsRouted && agent.productAccessEnabled && productRequest.isProductTurn
                        && !referencedIds.length && !route.catalogSearch && !productRequest.cheaperAlternative
                        && catalogProducts.length === 0 && productRequest.searchTerms.length > 0
                ) {
                        const broader = await runCatalogSearches({
                                vocabulary: searchVocabulary,
                                agentId: agent.id,
                                message,
                                calls: [{ query: productRequest.searchTerms.join(' '), in_stock_only: false }],
                                reason: 'EMPTY_RESULT',
                                isFa: turnLang !== 'en',
                                budget: { maxPrice: null, minPrice: null },
                                sort: null,
                        }).catch(() => null)
                        if (broader?.products.length) {
                                catalogProducts = broader.products
                                catalogSearchInstruction = broader.instruction
                                catalogToolReason = 'EMPTY_RESULT'
                                productRequest = { ...productRequest, includeProductCards: true, explicitShowcase: false }
                        }
                }
                // Cheaper alternatives: closest price first (a similar product one
                // step down), a handful only; none at all means the item already
                // is the most affordable of its family, which the reply says.
                const cheaperThan = productRequest.cheaperThan
                if (cheaperThan) {
                        const cheaper = catalogProducts
                                .filter((product) => product.price != null && product.price < cheaperThan.price)
                                .sort((left, right) => right.price! - left.price!)
                                .slice(0, 4)
                                .map((product) => ({ ...product, fullTermMatch: false }))
                        catalogProducts = cheaper.length
                                ? cheaper
                                : (await fetchCatalogProductsByIds(agent.id, [cheaperReferenceId ?? '']).catch(() => []))
                                        .map((product) => ({ ...product, fullTermMatch: false }))
                }
                // Exact matches that are all sold out: a consultation says
                // «فعلاً ناموجوده» with a real next step.
                if (catalogProducts.length > 0 && catalogProducts.every((product) => product.unavailable)) {
                        productRequest = { ...productRequest, unavailableMatch: true }
                }
                // State anchors merged into this turn name the family in the intro too.
                if (corpusTokens) {
                        productRequest = {
                                ...productRequest,
                                corpusSubjectTerms: [...new Set([
                                        ...(productRequest.corpusSubjectTerms ?? []),
                                        ...productRequest.searchTerms.filter((term) => corpusTokens.has(term)),
                                ])],
                        }
                }
                workingState = enrichConversationStateWithCatalog(workingState, catalogProducts)
                // «اولی و سومی رو مقایسه کن»: the turn is about the rows the
                // customer pointed at. The product discussed before them must not
                // stand in the state as «the» subject, or the reply answers about it.
                if (productsRouted && referencedIds.length > 1 && workingState.activeEntity) {
                        workingState = { ...workingState, activeEntity: null }
                }
                if (productsRouted && route.productsIdentified && catalogProducts.length === 1) {
                        // The referenced product is the active entity from now on.
                        workingState = promoteConversationStateToProduct(
                                workingState,
                                productRequest.searchTerms,
                                [catalogProducts[0].id],
                                true,
                        )
                }

                // ── Commerce actions: back-in-stock alerts and pre-orders ──────
                // Deterministic and data-built; they run after catalog grounding
                // so «همینو می‌خوام» / «موجود شد خبرم کن» resolve to real rows.
                const commerceLang = turnLang === 'en' ? 'en' : 'fa'
                const restockEnabled = agent.restockAlertsEnabled !== false && agent.productAccessEnabled
                const channelRestockMode = restockEnabled ? restockMode(params.channel, Boolean(resolvedContactPhone)) : null
                const activeProductId = workingState.activeEntity?.type === 'PRODUCT' ? workingState.activeEntity.id : null
                let commerceTurn: CommerceTurn = { kind: 'none' }
                // Payment links on the store (plugin 5.0+) when the agent sells
                // in chat; otherwise the classic operator pre-order.
                const checkoutContext = agent.orderCaptureEnabled && agent.productAccessEnabled
                        ? await import('@/lib/commerce/checkout-service')
                                .then((service) => service.loadCheckoutContext(workspaceId, agent.id))
                                .catch((error) => {
                                        captureError('chat-engine:checkout-context', error, { workspaceId, metadata: { agentId: agent.id } })
                                        return null
                                })
                        : null
                try {
                        const restock = await resolveRestockTurn({
                                enabled: restockEnabled,
                                workspaceId,
                                agentId: agent.id,
                                conversationId,
                                contactId,
                                contactPhone: resolvedContactPhone,
                                channel: params.channel,
                                message,
                                lang: commerceLang,
                                lastAssistantText,
                                catalogProducts,
                                activeEntityId: route?.restock?.targetId ?? activeProductId,
                                cartHold: agent.cartHoldEnabled === true,
                                request: route?.restock?.request ?? null,
                        })
                        if (restock.kind === 'reply') {
                                commerceTurn = { kind: 'reply', text: restock.text }
                        } else if (agent.orderCaptureEnabled && agent.productAccessEnabled) {
                                const order = await resolveOrderCaptureTurn({
                                        checkout: checkoutContext,
                                        enabled: true,
                                        workspaceId,
                                        agentId: agent.id,
                                        conversationId,
                                        contactId,
                                        channel: params.channel,
                                        message,
                                        lang: commerceLang,
                                        catalogProducts,
                                        recentCardIds: shownCardIds,
                                        activeEntityId: activeProductId,
                                        variantHint: productRequest.variantHint,
                                        lastAssistantText,
                                        prefill: orderPrefill({
                                                contactName: resolvedContactName,
                                                contactPhone: resolvedContactPhone,
                                                facts: activeFacts(evidenceMemory),
                                        }),
                                        restockEnabled,
                                        cartHold: agent.cartHoldEnabled === true,
                                        signals: route?.orderSignals ?? emptyOrderSignals(),
                                        searched: productRequest.isProductTurn && productRequest.searchTerms.length > 0 && referencedIds.length === 0,
                                })
                                if (order.kind === 'reply') commerceTurn = { kind: 'reply', text: order.text }
                                else if (order.kind === 'submit') commerceTurn = order
                                else if (order.kind === 'instruct') commerceTurn = { kind: 'instruct', instruction: order.instruction }
                        }
                } catch (error) {
                        // A commerce-store hiccup degrades to an ordinary reply.
                        captureError('chat-engine:commerce-turn', error, {
                                workspaceId,
                                metadata: { agentId: agent.id, conversationId },
                        })
                }
                // Rows that cover only part of the request are close alternatives.
                // A forced vitrine would announce them as the requested product
                // («۱۰ مدل کرم زیر موجود داریم» over foundations), so the model
                // presents them, told plainly what they are.
                if (!catalogToolReason && catalogProducts.some((product) => product.nearMatch)) {
                        productRequest = { ...productRequest, explicitShowcase: false, includeProductCards: true }
                        const soldOut = catalogProducts.every((product) => product.unavailable)
                        catalogSearchInstruction = turnLang !== 'en'
                                ? `\n\n=== نتیجهٔ جست‌وجوی کاتالوگ ===\nهیچ محصولی همهٔ مشخصاتی را که مشتری گفت ندارد؛ ردیف‌های کاتالوگ این نوبت فقط نزدیک‌ترین موارد هستند. اگر یکی از آن‌ها همان چیزی است که مشتری با نام دیگری گفته (مثل «زیر چشم» و «دور چشم») همان را معرفی کن؛ وگرنه صادقانه بگو دقیقاً همین را نداریم و حداکثر دو مورد نزدیک را پیشنهاد بده. تعداد اعلام نکن و محصولی که ربطی به خواستهٔ مشتری ندارد معرفی نکن.${soldOut ? ' این ردیف‌ها الان ناموجودند؛ همین را صریح بگو.' : ''}`
                                : `\n\n=== Catalog search ===\nNo product carries everything the customer named; this turn's catalog rows are only the closest ones. If one of them is what the customer means under another name, present it; otherwise say honestly we do not have exactly that and suggest at most two close options. Announce no count and present nothing unrelated to the request.${soldOut ? ' These rows are out of stock right now; say so plainly.' : ''}`
                }
                // A sold-out answer may offer a back-in-stock alert only where the
                // channel can really deliver it; the offered items are remembered
                // so a later «آره خبرم کن» resolves to exactly them.
                const restockOffer = commerceTurn.kind === 'none' && productRequest.unavailableMatch && channelRestockMode
                        ? restockOfferLine(channelRestockMode, commerceLang)
                        : null
                if (restockOffer) {
                        await rememberRestockOffer(conversationId, unavailableItemsFromCatalog(catalogProducts))
                                .catch((error) => captureError('chat-engine:restock-offer', error, { workspaceId }))
                }
                if (productsRouted && catalogToolReason && catalogProducts.length) {
                        productRequest = {
                                ...productRequest,
                                isProductTurn: true,
                                explicitShowcase: false,
                                discoveryBrowse: false,
                                unavailableMatch: false,
                                includeProductCards: true,
                        }
                        workingState = enrichConversationStateWithCatalog(workingState, catalogProducts)
                } else if (productsRouted && catalogToolReason && catalogSearchInstruction) {
                        // Nothing fits the stated budget. The search instruction
                        // carries the honest answer (nothing in this range, the
                        // real entry price, one question); a forced empty vitrine
                        // used to replace it with «پیدا نکردم».
                        productRequest = { ...productRequest, explicitShowcase: false, includeProductCards: false }
                }

                const turnHistory = historyForProductTurn(modelHistory, productRequest)
                const turnPlanningHistory = historyForProductTurn(planningHistory, productRequest)
                // A booking/course dialog continues on short answers («شنبه ساعت ۵»)
                // to the agent's own question, even when the answer alone reads
                // as nothing in particular.
                const continuesTask = (intent: 'BOOKING' | 'SERVICE') => loadedState.state.activeGoal?.intent === intent
                        && ['ANSWER', 'REFINEMENT', 'CORRECTION', 'REFERENCE'].includes(workingState.lastTurn?.relation ?? '')
                const bookingIntent = Boolean(route?.booking) || continuesTask('BOOKING')
                const courseIntent = Boolean(route?.course) || continuesTask('SERVICE')
                const skillPlan = compileAgentSkillPlan({
                        language: turnLang,
                        userMessage: message,
                        history: turnPlanningHistory,
                        // Verified channel media on this turn (never inferred from prose).
                        inboundMediaKind: params.inboundMediaKind,
                        hasKnowledgeContext: Boolean(contextText),
                        productTurn: productRequest.isProductTurn,
                        catalogAccessEnabled: agent.productAccessEnabled,
                        orderTurn: Boolean(orderContext),
                        bookingTurn: bookingIntent && params.capabilityGates?.bookings !== false,
                        bookingUnavailable: bookingIntent && params.capabilityGates?.bookings === false,
                        courseTurn: params.capabilityGates?.courses === true && courseIntent,
                        identificationPending: freshState === 'pending' && agent.requireCustomerInfo,
                        hasCustomerPreferences: customerPreferences.length > 0,
                        handoffEnabled: agent.handoffEnabled,
                        salesIntelligenceEnabled: true,
                        richProductCards:
                                agent.productAccessEnabled &&
                                params.channel !== 'API' &&
                                productRequest.includeProductCards,
                        hasConversationState: Boolean(workingState.activeGoal || workingState.lastAnswer),
                        returningCustomer: previousSessionPlanningRows(history).length > 0
                                && !history.some((item) => item.role === 'user' || item.role === 'assistant'),
                        orderCaptureEnabled: agent.orderCaptureEnabled === true,
                        payLinkEnabled: Boolean(checkoutContext),
                })

                const messages = buildMessages({
                        systemPrompt: finalSystemPrompt,
                        language: turnLang,
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
                        richCards:
                                agent.productAccessEnabled &&
                                params.channel !== 'API' &&
                                productRequest.includeProductCards,
                        skillPlan,
                        conversationState: workingState,
                        restockOfferLine: restockOffer,
                        turnSignal: true,
                })
                if (commerceTurn.kind === 'instruct' && messages[0]?.role === 'system') {
                        messages[0].content = insertBeforeTurnMarker(messages[0].content ?? '', `\n\n${commerceTurn.instruction}`)
                }
                if (catalogSearchInstruction && messages[0]?.role === 'system') {
                        messages[0].content = insertBeforeTurnMarker(messages[0].content ?? '', catalogSearchInstruction)
                }
                if (spellingNote && messages[0]?.role === 'system') {
                        messages[0].content = insertBeforeTurnMarker(messages[0].content ?? '', spellingNote)
                }
                // ── Turn brief: what the customer asked and what is resolved ──
                if (route && understanding.outcome?.ok && messages[0]?.role === 'system') {
                        const brief = composeTurnBrief({
                                route,
                                refs: understanding.outcome.verified.refs,
                                lang: turnLang === 'en' ? 'en' : 'fa',
                                showRefs: productsRouted,
                        })
                        if (brief) messages[0].content = insertBeforeTurnMarker(messages[0].content ?? '', brief)
                }

                const stateTrace = buildConversationStateTrace({
                        state: workingState,
                        historyLoaded: modelHistory.filter((item) => item.role !== 'system').length,
                        historySent: turnHistory.filter((item) => item.role !== 'system').length,
                        resetReason: productRequest.requestNewTopic
                                ? 'EXPLICIT_RESET'
                                : productRequest.resetProductContext ? 'NEW_PRODUCT_SUBJECT' : null,
                        retrievalQuery,
                })
                understanding.finalize(routedDomains)

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
                        turnLang,
                        orderContext,
                        workingState,
                        stateExpectedRevision: loadedState.expectedRevision,
                        stateTrace,
                        analyzerHandoffSignal,
                        recentCardIds: shownCardIds,
                        commerceTurn,
                        catalogToolReason,
                        restockOffer,
                        orderCaptureEnabled: agent.orderCaptureEnabled === true,
                        ledger,
                        understoodDomains: routedDomains,
                        orderAsked: route?.unavailable.includes('order_capture') ?? false,
                        bookingHint: route?.booking ? route.booking.hint : undefined,
                        bookingConfirmed: route?.booking
                                ? understanding.outcome?.ok === true && understanding.outcome.verified.answersPending
                                        && understanding.candidates?.pending?.kind === 'booking_confirm'
                                : undefined,
                        bookingIntentKnown: bookingIntent,
                        courseHint: route?.course ? [route.course.action, route.course.hint].filter(Boolean).join(' ') : undefined,
                        discussedProducts: catalogProducts
                                .filter((product) => product.fullTermMatch)
                                .map((product) => ({ id: product.id, name: product.name })),
                }
        } catch (error) {
                await releaseChatCredit(reservation, 'Turn preparation failed').catch(() => {})
                throw error
        }
}

export type StartChatResult =
        | { error: 'AI_UNAVAILABLE' }
        | { error: 'NO_CREDIT' }
        | { error: 'OPERATOR_ACTIVE'; conversationId: string }
        | { error: 'PLAN_BLOCKED'; reason: BlockReason }
        | { conversationId: string; stream: ReadableStream<Uint8Array> }

export type GenerateReplyResult =
        | { error: 'AI_UNAVAILABLE' }
        | { error: 'NO_CREDIT' }
        | { error: 'OPERATOR_ACTIVE'; conversationId: string }
        | { error: 'PLAN_BLOCKED'; reason: BlockReason }
        | { conversationId: string; reply: string; messageId?: string; replayed?: boolean }

export interface GenerateReplyOptions {
        /** Runs only after ownership and handoff gates confirm that AI will generate. */
        onGenerationStart?: () => void | Promise<void>
        /** Receives the complete text-so-far that is safe to show in a live draft. */
        onTextUpdate?: (text: string) => void
}

export type PreparedTurn = Exclude<Awaited<ReturnType<typeof prepareTurn>>, { error: unknown }>

/** The handoff policy read failed before any reply existed; credit is already released. */
export class TurnPreparationError extends Error {
        constructor(readonly original: unknown) {
                super('TURN_PREPARATION_FAILED')
                this.name = 'TurnPreparationError'
        }
}

type ProviderStatus = 'STREAM_FAILED' | 'EMPTY_RESPONSE'

const OFFER_PENDING: Record<NonNullable<TurnSignal['offer']>, PendingStateKind> = {
        order: 'order_offer',
        restock: 'restock_offer',
        showcase: 'showcase_offer',
        booking: 'booking_confirm',
}

/**
 * What this reply establishes for later turns: the cards it showed (in order,
 * so «دومی» resolves), the products it identified (product memory) and the
 * offer it ends with (from the trusted restock line or the status line).
 */
function turnObservation(prep: PreparedTurnData, reply: string, signal: TurnSignal | null): AssistantTurnObservation {
        const shown = parseProductDirectives(reply).directives
                .filter((directive): directive is typeof directive & { id: string } => Boolean(directive.id))
                .map((directive) => {
                        const parent = directive.id.split('#')[0]
                        const row = prep.catalogProducts.find((product) => product.id === directive.id || product.id === parent)
                        return { id: directive.id, name: directive.name || row?.name || '' }
                })
                .filter((card) => card.name)
        const offer = prep.restockOffer ? 'restock' : signal?.offer ?? null
        return {
                showcase: shown,
                discussed: prep.discussedProducts ?? [],
                discussedVia: 'named',
                pending: offer ? { kind: OFFER_PENDING[offer] } : null,
        }
}

/** How one surface (web stream, messenger) observes a turn. */
export interface TurnIO {
        /** Stream provider deltas (live surfaces) instead of one completion call. */
        stream: boolean
        /** Fires once the turn will really answer; typing indicators start here. */
        onGenerationStart?: () => void | Promise<void>
        /**
         * Text the customer may see right now. Model output arrives here only
         * through the live preview guard, so it is a growing prefix of safe text.
         */
        show?: (text: string) => void
        /** Model-path reply after guards and card hydration, before persistence. */
        onFinal?: (text: string) => void
        /** Provider trouble, reported after onFinal so the fallback text is already on screen. */
        onProviderStatus?: (status: ProviderStatus) => void
}

/**
 * One customer turn after preparation, shared by the web stream and the
 * messenger channels: handoff gate → deterministic answers → model call →
 * guards → credit settlement → persistence. Every path settles the credit
 * reservation; the surfaces differ only in how they observe the turn (TurnIO).
 */
export async function completeTurn(
        params: StartChatParams,
        prep: PreparedTurn,
        io: TurnIO,
): Promise<{ reply: string; messageId?: string }> {
        const { workspaceId, agent, message } = params
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
                turnLang,
                orderContext,
                workingState,
                stateExpectedRevision,
                stateTrace,
                analyzerHandoffSignal,
                recentCardIds,
                commerceTurn,
                catalogToolReason,
                restockOffer,
                orderCaptureEnabled,
        } = prep
        // The understanding layer read this turn (see AgentSkillPostprocessContext).
        const turnWasRead = (prep.understoodDomains?.length ?? 0) > 0

        // Smart handoff: check before calling AI. A database/policy failure
        // here must not leave wallet credit reserved forever.
        let handoffCheck: Awaited<ReturnType<typeof shouldHandoff>>
        try {
                handoffCheck = await shouldHandoff(agent, conversationId, message)
        } catch (error) {
                await releaseChatCredit(reservation, 'Handoff policy check failed').catch(() => {})
                throw new TurnPreparationError(error)
        }
        // The turn analyzer's rescue verdict escalates to a human even when
        // the keyword/policy layers saw nothing.
        if (!handoffCheck.handoff && analyzerHandoffSignal && agent.handoffEnabled) {
                handoffCheck = {
                        ...handoffCheck,
                        handoff: true,
                        recommended: true,
                        code: 'MANUAL',
                        reasonCodes: [...handoffCheck.reasonCodes, 'MANUAL'],
                        reason: handoffCheck.reason || 'مشتری به پیگیری انسانی نیاز دارد',
                        priority: 'high',
                }
        }
        if (handoffCheck.handoff) {
                await releaseChatCredit(reservation, 'Human handoff before AI call').catch(() => {})
                const reply = handoffReplyText(handoffCheck, agent)
                io.show?.(reply)
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
                        turnCost: prep.ledger?.summary() ?? null,
                })
                return { reply, messageId: persisted?.messageId }
        }

        // The customer confirmed the pre-order summary: file it and hand the
        // thread to a human for payment and shipping.
        if (commerceTurn.kind === 'submit') {
                await releaseChatCredit(reservation, 'Pre-order filed without AI').catch(() => {})
                await io.onGenerationStart?.()
                io.show?.(commerceTurn.text)
                const persisted = await persistHandoff({
                        workspaceId,
                        agent,
                        conversationId,
                        channel: params.channel,
                        contactId,
                        contactName,
                        contactPhone,
                        reason: `پیش‌سفارش درون‌چت #${commerceTurn.code}`,
                        replyText: commerceTurn.text,
                        skillPlan,
                        inboundEventId: params.inboundEventId,
                        inboundAlreadyPersisted: params.inboundAlreadyPersisted,
                        summary: commerceTurn.operatorSummary,
                        kind: 'order',
                        turnCost: prep.ledger?.summary() ?? null,
                })
                await markOrderDraftSubmitted(commerceTurn.draftId, persisted?.alertId ?? null)
                        .catch((error) => captureError('chat-engine:order-submit', error, { workspaceId }))
                return { reply: commerceTurn.text, messageId: persisted?.messageId }
        }

        let deterministicReply: string | null = null
        try {
                deterministicReply = commerceTurn.kind === 'reply' ? commerceTurn.text : await buildDeterministicTurnReply({
                        workspaceId,
                        agent,
                        channel: params.channel,
                        catalogProducts,
                        productRequest,
                        canBypass: canBypassDeterministicReply,
                        closingReply,
                        catalogToolsEligible: Boolean(catalogToolReason),
                        restockOffer,
                        lang: turnLang,
                        hasKnowledgeContext: retrievedChunks.some((chunk) => {
                                const metadata = chunk.metadata
                                return !(metadata && typeof metadata === 'object' && 'productId' in metadata)
                        }),
                })
        } catch (error) {
                // DB hydration failure falls back to the regular model path; the
                // reservation remains valid and no customer turn is lost.
                console.error('[chat-engine] deterministic reply failed:', error)
        }
        if (deterministicReply) {
                // No model call and therefore no AI charge. The DB result itself
                // is the trusted response and marker source.
                await io.onGenerationStart?.()
                io.show?.(deterministicReply)
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
                                workingState,
                                stateExpectedRevision,
                                stateTrace,
                                inboundEventId: params.inboundEventId,
                                inboundAlreadyPersisted: params.inboundAlreadyPersisted,
                                turnCost: prep.ledger?.summary() ?? null,
                                observation: turnObservation(prep, deterministicReply, null),
                        })
                        return { reply: deterministicReply, messageId: persisted.messageId }
                } catch (error) {
                        console.error('[chat-engine] deterministic persist failed:', error)
                        // A durable inbound event must be retried, never answered twice.
                        if (params.inboundEventId) throw error
                        return { reply: deterministicReply }
                }
        }
        if (!handoffCheck.recommended && handoffCheck.salesInsight) {
                appendSalesGuidance(
                        messages,
                        salesGuidanceForModel(handoffCheck.salesInsight, agent.language),
                )
        }

        // Typing indicators must not run before this point: prepareTurn detects
        // operator-owned conversations and shouldHandoff can transfer this turn
        // without calling a model.
        await io.onGenerationStart?.()

        const hasGroundedOrder = orderContext.includes('<verified_order>')
        // The model may only copy a link it was shown on this turn.
        const linkGuard = {
                evidence: linkEvidenceForTurn(messages, catalogProducts, [agent.fallbackMessage, agent.handoffMessage]),
                mode: resolveLinkGuardMode(),
                handoffEnabled: agent.handoffEnabled,
        }
        const preview = createLivePreviewGuard(skillPlan, { userMessage: message, orderCaptureEnabled, hasGroundedOrder, linkGuard, turnWasRead })
        const providerStatus: ProviderStatus[] = []
        let reply = ''
        let usage: ChatUsage | null = null
        let extraReceipts: ConversationReceipt[] = []
        let providerFailed = false
        let turnSignal: TurnSignal | null = null
        try {
                const courseTurn = hasAgentSkill(skillPlan, 'course-enrollment')
                        ? await maybeRunCourseAgentTurn({
                                workspaceId,
                                conversationId,
                                contactId,
                                model,
                                messages,
                                temperature: AGENT_RESPONSE_TEMPERATURE,
                                maxTokens: AGENT_MAX_RESPONSE_TOKENS,
                                hint: prep.courseHint,
                        })
                        : null
                const bookingTurn = courseTurn ?? (hasAgentSkill(skillPlan, 'appointment-booking')
                        ? await maybeRunBookingAgentTurn({
                                workspaceId,
                                conversationId,
                                contactId,
                                model,
                                messages,
                                temperature: AGENT_RESPONSE_TEMPERATURE,
                                maxTokens: AGENT_MAX_RESPONSE_TOKENS,
                                intentKnown: prep.bookingIntentKnown,
                                hint: prep.bookingHint,
                                confirmed: prep.bookingConfirmed,
                        })
                        : null)
                if (bookingTurn) {
                        const extracted = extractTurnSignal(bookingTurn.content)
                        reply = extracted.text
                        turnSignal = extracted.signal
                        usage = bookingTurn.usage
                        extraReceipts = bookingTurn.receipts
                        if (io.show) io.show(preview(reply))
                } else if (io.stream) {
                        for await (const delta of streamChatWithRetry({
                                model,
                                messages,
                                temperature: AGENT_RESPONSE_TEMPERATURE,
                                maxTokens: AGENT_MAX_RESPONSE_TOKENS,
                                onUsage: (value) => {
                                        usage = value
                                },
                        })) {
                                reply += delta
                                // Live drafts never show the hidden status line or text
                                // the final guards would remove.
                                if (io.show) io.show(preview(visibleWhileStreaming(reply)))
                        }
                } else {
                        const result = await chatCompletion({
                                model,
                                messages,
                                temperature: AGENT_RESPONSE_TEMPERATURE,
                                maxTokens: AGENT_MAX_RESPONSE_TOKENS,
                        })
                        reply = result.content
                        usage = result.usage
                }
        } catch (e) {
                providerFailed = true
                providerStatus.push('STREAM_FAILED')
                captureError(io.stream ? 'chat-engine:stream' : 'chat-engine:completion', e, {
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
        // Take the status line off before any guard reads the reply: a reply
        // that was nothing but the line counts as empty.
        {
                const extracted = extractTurnSignal(reply)
                reply = extracted.text.trim()
                turnSignal = providerFailed ? null : extracted.signal ?? turnSignal
        }
        if (!reply) {
                // A 2xx provider response with no content is not a successful
                // reply and must not consume reply credit.
                if (!providerFailed) providerStatus.push('EMPTY_RESPONSE')
                providerFailed = true
                reply = agent.fallbackMessage || defaultProviderFailureText(turnLang)
        }

        const identifiedProductIds = catalogProducts
                .filter((product) => product.fullTermMatch)
                .map((product) => product.id)
        const groundedPostprocessProducts = providerFailed
                ? []
                : identifiedProductIds.length === 1
                        ? catalogProducts.filter((product) => product.id === identifiedProductIds[0])
                        : catalogProducts

        // Safety and continuity run before presentation so a deterministic
        // rewrite cannot remove the trusted card/button appended below.
        const continuityGuardCodes: string[] = []
        // An invented link gets one rewrite so the wording stays natural; the
        // postprocessors strip whatever a failed rewrite leaves behind.
        if (!providerFailed && linkGuard.mode === 'enforce') {
                const repaired = await repairUngroundedLinkReply({
                        reply,
                        evidence: linkGuard.evidence,
                        userMessage: message,
                        handoffEnabled: agent.handoffEnabled,
                        workspaceId,
                        agentId: agent.id,
                        conversationId,
                        maxTokens: AGENT_MAX_RESPONSE_TOKENS,
                        ledger: prep.ledger,
                })
                if (repaired) {
                        reply = repaired
                        continuityGuardCodes.push('UNGROUNDED_LINK_REPAIRED')
                }
        }
        reply = runAgentSkillPostprocessors(reply, skillPlan, {
                catalogProducts: groundedPostprocessProducts,
                userMessage: message,
                isFa: turnLang !== 'en',
                inboundMediaKind: params.inboundMediaKind,
                hasGroundedOrder,
                preferStructuredProductLink:
                        params.channel !== 'API' &&
                        productRequest.includeProductCards &&
                        identifiedProductIds.length === 1,
                conversationState: workingState,
                continuityGuardCodes,
                establishedProductIds: recentCardIds,
                orderCaptureEnabled,
                linkGuard,
                turnWasRead,
                orderAsked: prep.orderAsked ?? false,
        })

        // Canonicalize markers for every surface before persistence and return.
        // Text, carousel and conversation UIs share the exact same trusted DB
        // result-set; model-authored ids/prices never leak.
        if (
                hasAgentSkill(skillPlan, 'product-card-hydration') &&
                agent.productAccessEnabled &&
                params.channel !== 'API' &&
                productRequest.includeProductCards &&
                (!providerFailed || productRequest.explicitShowcase)
        ) {
                try {
                        reply = await buildTrustedProductReply({
                                raw: reply,
                                workspaceId,
                                agentId: agent.id,
                                lang: turnLang,
                                preferredProductIds: catalogProducts.map((product) => product.id),
                                identifiedProductIds: freshCardIds(identifiedProductIds, recentCardIds, productRequest.explicitShowcase),
                                forceShowcase: productRequest.explicitShowcase,
                                subjectPhrase: showcaseSubjectPhrase(productRequest),
                                narrowed: isNarrowedProductRequest(productRequest),
                                recentlyShownIds: recentCardIds,
                                unavailable: productRequest.unavailableMatch,
                                identifiedVariantHint: productRequest.variantHint,
                        })
                } catch (error) {
                        console.error('[chat-engine] product-card hydration failed:', error)
                        reply = parseProductDirectives(reply).text
                }
        } else if (!productRequest.includeProductCards) {
                // A focused detail follow-up should stay a concise text answer even
                // if the provider copied a stale marker from history. Never expose
                // model-authored product directives.
                reply = parseProductDirectives(reply).text
        }
        io.onFinal?.(reply)
        for (const status of providerStatus) io.onProviderStatus?.(status)

        if (providerFailed) {
                await releaseChatCredit(reservation, 'Provider reply failed').catch(() => {})
        } else {
                prep.ledger?.setReply(model, usage)
                // A4: a successful reply resets the consecutive-failure streak.
                await resetProviderFailureStreak(workspaceId)
                await captureChatCredit(reservation, usage).catch((e) =>
                        console.error('[chat-engine] credit capture failed:', e),
                )
                // A16: post-capture trial quota milestones (80% warning).
                void processTrialQuotaAlert({ workspaceId }).catch(() => {})
        }

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
                        workingState,
                        stateExpectedRevision,
                        stateTrace: { ...stateTrace, guardCodes: continuityGuardCodes },
                        inboundEventId: params.inboundEventId,
                        inboundAlreadyPersisted: params.inboundAlreadyPersisted,
                        serviceError: providerFailed,
                        turnSignal: providerFailed ? null : turnSignal,
                        turnCost: prep.ledger?.summary() ?? null,
                        observation: turnObservation(prep, reply, providerFailed ? null : turnSignal),
                })
                return { reply, messageId: persisted.messageId }
        } catch (e) {
                console.error('[chat-engine] persist error:', e)
                if (params.inboundEventId) throw e
                return { reply }
        }
}

/** Web surfaces (widget, chat link, dashboard preview): the turn as an SSE stream. */
export async function startChat(input: StartChatParams): Promise<StartChatResult> {
        const params = await withCapabilityGates(input)
        const prep = await prepareTurn(params)
        if ('error' in prep) return prep
        const { reservation, conversationId } = prep
        const { workspaceId, agent } = params

        const encoder = new TextEncoder()
        const stream = new ReadableStream<Uint8Array>({
                async start(controller) {
                        // Once the consumer cancels (visitor closed the tab, lost network),
                        // every enqueue throws per the Streams spec. Swallow that: the turn
                        // must still finish so the generated reply is persisted for the
                        // inbox and the credit is settled correctly.
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
                        // Clients append deltas, so only the growth of the visible text is sent.
                        let shownLength = 0
                        try {
                                const result = await completeTurn(params, prep, {
                                        stream: true,
                                        show: (text) => {
                                                if (text.length <= shownLength) return
                                                send({ type: 'delta', text: text.slice(shownLength) })
                                                shownLength = text.length
                                        },
                                        onFinal: (text) => send({ type: 'replace', text }),
                                        onProviderStatus: (error) => send({ type: 'error', error }),
                                })
                                send(result.messageId ? { type: 'done', messageId: result.messageId } : { type: 'done' })
                        } catch (error) {
                                // Every path in completeTurn settles the reservation; an
                                // unexpected throw must not strand it either, because its key
                                // is random per request and nothing would reuse or refund it.
                                await releaseChatCredit(reservation, 'Turn failed unexpectedly').catch(() => {})
                                const preparation = error instanceof TurnPreparationError
                                captureError(preparation ? 'chat-engine:handoff-check' : 'chat-engine:stream-turn', preparation ? error.original : error, {
                                        workspaceId,
                                        metadata: { agentId: agent.id, conversationId },
                                })
                                send({ type: 'error', error: preparation ? 'PREPARATION_FAILED' : 'STREAM_FAILED' })
                        }
                        closeStream()
                },
                cancel() {
                        // Nothing to do: start() keeps running after a disconnect, so the
                        // reply is still generated, persisted for the inbox and readable
                        // through the conversation endpoint. Releasing the reservation
                        // here used to make every abandoned stream a free reply.
                },
        })

        return { conversationId, stream }
}

/**
 * Messenger channels (Telegram/Bale/Rubika/Instagram/WhatsApp): the full reply
 * text to send back in one shot, with an optional live draft while it is written.
 */
export async function generateReply(
        input: StartChatParams,
        options: GenerateReplyOptions = {},
): Promise<GenerateReplyResult> {
        const params = await withCapabilityGates(input)

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
        try {
                const result = await completeTurn(params, prep, {
                        stream: Boolean(options.onTextUpdate),
                        onGenerationStart: options.onGenerationStart,
                        show: options.onTextUpdate,
                })
                return { conversationId: prep.conversationId, ...result }
        } catch (error) {
                // Releasing is always safe here: a redelivered inbound event reserves
                // again under the same key, and a captured reservation is untouched.
                await releaseChatCredit(prep.reservation, 'Turn failed unexpectedly').catch(() => {})
                throw error instanceof TurnPreparationError ? error.original : error
        }
}
