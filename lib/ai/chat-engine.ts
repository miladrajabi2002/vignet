import { prisma } from '@/lib/prisma'
import {
        getPlatformOpenRouterKey,
        streamChatWithRetry,
        chatCompletion,
        type ChatUsage,
} from '@/lib/ai/openrouter'
import { retrieveContext, buildMessages } from '@/lib/ai/rag'
import { resolveSystemPrompt } from '@/lib/ai/prompt-builder'
import { customerPreferenceInstruction, readCustomerAgentPreferences, type CustomerAgentPreference } from '@/lib/ai/customer-agent-preferences'
import { evidenceMemoryInstruction, readEvidenceMemory, type EvidenceMemory } from '@/lib/ai/memory-evidence'
import { captureStatedFacts } from '@/lib/ai/fact-capture'
import { activeFacts } from '@/lib/ai/memory-evidence'
import { detectOrderIntent } from '@/lib/commerce/order-capture'
import { hasActiveOrderDraft, markOrderDraftSubmitted, resolveOrderCaptureTurn } from '@/lib/commerce/order-service'
import { detectRestockRequest, restockMode, restockOfferLine } from '@/lib/commerce/restock'
import { rememberRestockOffer, resolveRestockTurn, unavailableItemsFromCatalog } from '@/lib/commerce/restock-service'
import { catalogToolGate, insertBeforeTurnMarker, planCatalogSearch, type CatalogToolReason } from '@/lib/ai/catalog-tools'
import { looksLikePersonName } from '@/lib/ai/customer-identification'
import { previousSessionPlanningRows } from '@/lib/ai/conversation-memory'
import { closingReplyText } from '@/lib/ai/response-policy'
import {
        extractTurnSignal,
        groundTurnSignal,
        visibleWhileStreaming,
        type TurnSignal,
} from '@/lib/ai/turn-signal'
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
        fetchCatalogProductsByIds,
        fetchCatalogServices,
        findAssignedCatalogReference,
        historyForProductTurn,
        isHumanOwnedConversation,
        planProductRequest,
        productRequestFromCatalogReference,
        showcaseSubjectPhrase,
        isNarrowedProductRequest,
        structuredProductDetailReply,
        extractProductTerms,
        assistantCardIds,
        normalizePersianText,
        buildFamilyEnumerationReply,
        UNRESOLVED_ANAPHORA_RE,
        type ProductRequestPlan,
} from '@/lib/ai/conversation'
import { getAgentCatalogLexicon } from '@/lib/ai/catalog-lexicon'
import { analyzerGate, analyzeTurn, analyzerSearchTerms } from '@/lib/ai/turn-analyzer'
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
import { detectTurnLanguage, type TurnLanguage } from '@/lib/ai/turn-language'
import type { ChatAgent, StartChatParams } from '@/lib/ai/chat-types'
import {
        buildTurnReceipts,
        metadataWithReceipts,
        type ConversationReceipt,
} from '@/lib/conversations/activity'
import { maybeRunBookingAgentTurn } from '@/lib/bookings/chat-orchestrator'
import { maybeRunCourseAgentTurn } from '@/lib/courses/chat-orchestrator'
import { refreshConversationSalesInsight, salesGuidanceForModel } from '@/lib/ai/sales-intelligence'
import { buildOrderContext } from '@/lib/ai/order-context'
import { buildTrustedProductReply, buildVariantPickReply, buildVariantShowcaseReply, parseProductDirectives } from '@/lib/products/presentation'
import { compileAgentSkillPlan } from '@/lib/agent-kernel/registry'
import {
        agentSkillTrace,
        hasAgentSkill,
        type AgentSkillPlan,
} from '@/lib/agent-kernel/contracts'
import { createLivePreviewGuard, runAgentSkillPostprocessors } from '@/lib/agent-kernel/postprocess'
import { hasBookingIntent } from '@/lib/bookings/intent'
import { hasCourseIntent } from '@/lib/courses/intent'
import { loadWorkspaceModules } from '@/lib/verticals/workspace-capabilities'
import { getRedis } from '@/lib/redis'
import { notifyWorkspace } from '@/lib/notifications/create'
import { processTrialQuotaAlert } from '@/lib/billing/trial-quota-alert'
import type { ChannelType, Prisma } from '@prisma/client'
import {
        AGENT_MAX_RESPONSE_TOKENS,
        AGENT_RESPONSE_TEMPERATURE,
} from '@/lib/ai/agent-runtime'
import { loadCustomerChannelContext } from '@/lib/ai/customer-channel-context'
import { buildPlatformContextBlock } from '@/lib/ai/platform-context'
import { readInboundSource } from '@/lib/conversations/source'
import {
        advanceConversationWorkingState,
        buildConversationStateTrace,
        createEmptyConversationWorkingState,
        contextualizeProductRequest,
        enrichConversationStateWithCatalog,
        loadConversationWorkingState,
        observeAssistantTurn,
        persistConversationWorkingState,
        promoteConversationStateToProduct,
        startCatalogProductGoal,
        type ConversationStateTrace,
        type ConversationWorkingState,
} from '@/lib/ai/conversation-state'

const CATALOG_REFINEMENT_CUE_RE = /(?:برای|مناسب|رنگ|سایز|اندازه|قد|جنس|پارچه|متریال|سبک|بودجه|قیمت|موجود|مدرن|کلاسیک|مینیمال|مشکی|سفید|سبز|آبی|قرمز|زرد|صورتی|بنفش|طوسی|کرم|قهوه\s*ای|for|suitable|colou?r|size|material|style|budget|price|stock)/iu

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
                // Notify the owner once per window, when the streak crosses the
                // threshold; every failing thread from then on is still handed over.
                if (streak === PROVIDER_FAILURE_STREAK_THRESHOLD) {
                        await notifyWorkspace({
                                workspaceId: params.workspaceId,
                                type: 'SYSTEM',
                                title: 'خطای پیوسته در سرویس هوش مصنوعی',
                                body: `در ۳۰ دقیقه اخیر ${streak} پاسخ با خطای سرویس AI مواجه شد. مشتریان پیام «مشکل فنی» می‌گیرند و گفتگوهای اخیر به اپراتور ارجاع شده‌اند.`,
                                link: '/conversations',
                        }).catch(() => {})
                }
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
        /** Evidence-anchored long-term memory for this contact+agent (provenance, quarantine, audit). */
        evidenceMemory?: EvidenceMemory | null
        /** Language of the customer's current turn (kernel mirrors it). */
        turnLanguage?: TurnLanguage
        /** Channel the customer is currently talking on (TELEGRAM / WHATSAPP / ...). */
        channel: ChannelType
        /** Channel-native origin (DM / COMMENT / STORY_REPLY / ...) when known. */
        inboundSource?: Prisma.InputJsonValue | null
}): string {
        const { agent, customerInfoState, contactName, customerPreferences = [], turnLanguage, channel, inboundSource } = params

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
        //    The instruction script follows the customer's own turn language
        //    (the kernel's mirroring rule owns the reply language itself).
        if (customerInfoState === 'pending' && agent.requireCustomerInfo) {
                const isFa = (turnLanguage ?? agent.language) !== 'en'
                base += identificationInstruction(isFa, agent.customerInfoPrompt)
        }

        // Explicit per-customer interaction preferences are isolated in CRM
        // metadata and subordinate to business facts, tools and safety rules.
        base += customerPreferenceInstruction((turnLanguage ?? agent.language) === 'en' ? 'en' : 'fa', customerPreferences)

        // Evidence-anchored customer memory: confirmed facts, recorded
        // statements and pending conflict confirmations. Same isolation rules
        // as the preferences block above — this customer's own data only.
        base += evidenceMemoryInstruction((turnLanguage ?? agent.language) === 'en' ? 'en' : 'fa', params.evidenceMemory ?? null)

        // Platform-awareness block: tells the agent which surface it is on
        // (Telegram / WhatsApp / Instagram DM / public comment / story reply /
        // web widget / chat link / API). The block is appended last so it
        // cannot override evidence, scope or safety rules — it only shapes
        // formatting, length and CTA guidance for the active channel.
        base += '\n\n' + buildPlatformContextBlock({
                channel,
                source: readInboundSource(inboundSource ?? null),
                turnLanguage: turnLanguage ?? (agent.language === 'en' ? 'en' : 'fa') as TurnLanguage,
        })

        return base
}

/** Locale-aware default text for provider failures (no configured fallback). */
function defaultProviderFailureText(lang: TurnLanguage): string {
        if (lang === 'ar') return 'حدث خطأ تقني مؤقت، من فضلك أعد إرسال رسالتك بعد لحظات'
        if (lang === 'en') return 'A temporary technical issue occurred — please message again in a few moments'
        return 'یه مشکل فنی پیش اومده، لطفاً چند لحظه بعد دوباره پیام بده'
}

/** A catalog miss is resolved before the model can invent a product, price or
 * link. This wording is deliberately reusable across retail verticals. */
export function catalogNoMatchReply(lang: TurnLanguage): string {
        if (lang === 'ar') {
                return 'لم أجد منتجًا يطابق هذه المواصفات في الكتالوج الحالي، لذلك لا أستطيع تأكيد السعر أو التوفر أو رابط الشراء. أرسل اسم المنتج أو رمزه لأتحقق بدقة أكبر.'
        }
        if (lang === 'en') {
                return 'I could not find a product matching those details in the current catalog, so I cannot confirm a price, availability, or purchase link. Send the product name or code and I will check more precisely.'
        }
        return 'محصولی مطابق این مشخصات در کاتالوگ فعلی پیدا نکردم؛ بنابراین نمی‌توانم قیمت، موجودی یا لینک خریدی را تأیید کنم. نام یا کد محصول را بفرستید تا دقیق‌تر بررسی کنم.'
}

/**
 * Identified products whose card is guaranteed on this reply. A card the
 * customer received in the previous reply is not re-sent automatically on a
 * follow-up («رنگ‌بندیش؟», «باشه») — repeating the same card every turn is a
 * bot tell. An explicit showcase or a model-authored marker still shows it.
 */
function freshCardIds(identified: string[], recent: string[], explicitShowcase: boolean): string[] {
        if (explicitShowcase || !recent.length) return identified
        const recentParents = new Set(recent.map((id) => id.split('#')[0]))
        return identified.filter((id) => !recentParents.has(id.split('#')[0]))
}

function appendSalesGuidance(
        messages: ReturnType<typeof buildMessages>,
        guidance: string,
): void {
        const system = messages.find((item) => item.role === 'system')
        if (!system) return
        const content = system.content ?? ''
        // Sales advice changes every turn, so it must not sit in FRONT of the
        // long stable agent prompt: that defeated provider prefix caching on
        // every single reply. Insert it just before the per-turn instruction
        // block instead, which still keeps the authoritative per-turn rules
        // after the (historical) sales advice.
        const marker = content.search(/\n\n=== (?:دستور همین نوبت|Instruction for this turn) ===/u)
        system.content = marker === -1
                ? `${content}\n\n${guidance}`
                : `${content.slice(0, marker)}\n\n${guidance}${content.slice(marker)}`
}

async function buildDeterministicTurnReply(params: {
        workspaceId: string
        agent: ChatAgent
        channel: StartChatParams['channel']
        catalogProducts: CatalogProduct[]
        productRequest: ProductRequestPlan
        canBypass: boolean
        closingReply: string | null
        /** Reply locale detected from the customer's current message. */
        lang?: TurnLanguage
        /** Non-product knowledge (دانشنامه) was retrieved for this turn. */
        hasKnowledgeContext?: boolean
        /**
         * The agent's catalog lexicon (cached). Used by the family-level
         * variant enumeration so family terms that only exist in THIS
         * tenant's product names (e.g. «تلویزیون») ground like global nouns.
         */
        corpusTokens?: ReadonlySet<string>
        /** The catalog tools get a chance before any «not found» is final. */
        catalogToolsEligible?: boolean
        /** Deliverable back-in-stock offer for a sold-out vitrine. */
        restockOffer?: string | null
}): Promise<string | null> {
        if (params.closingReply) return params.closingReply
        if (!params.canBypass) return null
        const lang = params.lang ?? 'fa'
        if (
                params.agent.productAccessEnabled &&
                params.productRequest.detailField &&
                params.catalogProducts.length === 1
        ) {
                const detailReply = structuredProductDetailReply({
                        product: params.catalogProducts[0],
                        field: params.productRequest.detailField,
                        language: lang,
                })
                if (detailReply) return detailReply
        }
        if (params.channel === 'API') return null
        if (params.productRequest.requestNewTopic) {
                if (lang === 'ar') return 'حسنًا، لقد تركت الموضوع السابق جانبًا.'
                return lang === 'en'
                        ? 'Okay, I set the previous topic aside.'
                        : 'باشه؛ موضوع قبلی را کنار گذاشتم.'
        }
        if (!params.agent.productAccessEnabled) {
                if (params.productRequest.variantBrowse || params.productRequest.variantPick || params.productRequest.explicitShowcase) {
                        if (lang === 'ar') return 'وصول هذا المساعد إلى كتالوج المنتجات معطّل حاليًا.'
                        return lang === 'en'
                                ? 'This agent does not currently have access to the product catalog.'
                                : 'دسترسی این ایجنت به کاتالوگ محصولات در حال حاضر غیرفعال است.'
                }
                return null
        }
        // «طرح 07 رو میخوام» / «رنگ شکلاتی دارین؟» — the customer picked ONE
        // variant of the discussed product WITHOUT a code. Resolve it against
        // that product's variations (own photo/price/stock) instead of letting
        // the bare variant word fire a catalog-wide vitrine of random products
        // that merely mention the color/design in their names.
        if (params.productRequest.variantPick) {
                try {
                        const pickReply = await buildVariantPickReply({
                                workspaceId: params.workspaceId,
                                agentId: params.agent.id,
                                lang,
                                candidateRefs: [
                                        ...params.productRequest.variantTargetRefs,
                                        ...params.catalogProducts
                                                .filter((product) => product.fullTermMatch)
                                                .map((product) => product.id),
                                ],
                                hint: params.productRequest.variantHint ?? '',
                        })
                        if (pickReply) return pickReply
                } catch (error) {
                        console.error('[chat-engine] variant pick failed:', error)
                }
                // No matching variation — fall through: the consultation flow
                // has the target product in the model's catalog context.
        }
        // «طرحات چیه؟» — a plural variant ask whose family lives in the anchor
        // terms is a FAMILY-level enumeration: the complete design list of
        // every active catalog row in that family+size, deterministic from
        // the live catalog. A top-k chunk summary used to list whichever four
        // designs happened to win vector search (and borrowed a design from
        // knowledge docs that belongs to another product family). Rows with
        // internal variations or without «طرح …» names return null here and
        // keep the variant-vitrine / consult flow below.
        if (params.productRequest.variantBrowse) {
                try {
                        const enumReply = await buildFamilyEnumerationReply({
                                workspaceId: params.workspaceId,
                                agentId: params.agent.id,
                                lang: (params.lang ?? 'fa') as 'fa' | 'en' | 'ar',
                                searchTerms: params.productRequest.searchTerms,
                                corpusTokens: params.corpusTokens
                                        ?? (await getAgentCatalogLexicon(params.agent.id).catch(() => null))?.identityTokens,
                        })
                        if (enumReply) return enumReply
                } catch (error) {
                        console.error('[chat-engine] family enumeration failed:', error)
                }
                // Fall through to the variant showcase / consult flow below.
        }
        // «کاتالوگ طرح‌های دیگشو میفرستی» — a deterministic vitrine of the
        // discussed product's in-stock variations (each card = that variant's
        // own photo/price/stock) instead of a random vector-search dump.
        if (params.productRequest.variantBrowse) {
                try {
                        const variantReply = await buildVariantShowcaseReply({
                                workspaceId: params.workspaceId,
                                agentId: params.agent.id,
                                lang,
                                candidateRefs: [
                                        ...params.productRequest.variantTargetRefs,
                                        ...params.catalogProducts
                                                .filter((product) => product.fullTermMatch)
                                                .map((product) => product.id),
                                ],
                        })
                        if (variantReply) return variantReply
                } catch (error) {
                        console.error('[chat-engine] variant showcase failed:', error)
                }
                // No resolvable target with variations — fall through to the
                // ordinary showcase/consultation flow below.
        }
        // «0788» / «تونیک روناز ۰۷۸۸» — the code alone names the exact product
        // but no specific variation. Present that product's variant vitrine
        // directly (every available design's own photo/price/stock card)
        // instead of a consultation whose single parent card happens to show
        // only one design. The deterministic search must have identified
        // exactly one row (fullTermMatch); ambiguous multi-code or fuzzy
        // matches keep the ordinary consultation with cards, and a row with
        // no variations falls through to the parent-card flow below.
        if (params.productRequest.codeVariantVitrine) {
                const identifiedTargets = params.catalogProducts
                        .filter((product) => product.fullTermMatch)
                if (identifiedTargets.length === 1) {
                        try {
                                const variantReply = await buildVariantShowcaseReply({
                                        workspaceId: params.workspaceId,
                                        agentId: params.agent.id,
                                        lang,
                                        candidateRefs: [identifiedTargets[0].id],
                                })
                                if (variantReply) return variantReply
                        } catch (error) {
                                console.error('[chat-engine] code variant vitrine failed:', error)
                        }
                        // The identified row carries no variations — the parent
                        // card in the showcase/consultation below is the right
                        // presentation for a variation-less product.
                }
        }
        if (params.productRequest.isProductTurn && params.catalogProducts.length === 0) {
                // A strict catalog miss is only final when the knowledge base has
                // nothing relevant either. When product knowledge/specs (دانشنامه
                // محصول و مشخصات فنی) were retrieved, the model answers from them —
                // the catalog stays responsible for cards and purchase links, and
                // the anti-invention rules still apply. This keeps «میز تلویزیون
                // ۱۶۰» answerable when the lexical matcher misses but the knowledge
                // base knows the product.
                // A semantically promoted turn (catalog proven via vector recall)
                // already carries real catalog evidence, so a grounded-fetch miss
                // means presentation filtering — never a hard «not found».
                if (!params.hasKnowledgeContext && !params.productRequest.semanticTurn && !params.catalogToolsEligible) {
                        return catalogNoMatchReply(lang)
                }
                // An empty vitrine is not final while the model can still search.
                if (params.catalogToolsEligible) return null
        }
        if (!params.productRequest.explicitShowcase) return null

        return buildTrustedProductReply({
                raw: '',
                workspaceId: params.workspaceId,
                agentId: params.agent.id,
                lang,
                preferredProductIds: params.catalogProducts.map((product) => product.id),
                identifiedProductIds: params.catalogProducts
                        .filter((product) => product.fullTermMatch)
                        .map((product) => product.id),
                forceShowcase: true,
                subjectPhrase: showcaseSubjectPhrase(params.productRequest),
                narrowed: isNarrowedProductRequest(params.productRequest),
                unavailable: params.productRequest.unavailableMatch,
                restockOffer: params.restockOffer,
                identifiedVariantHint: params.productRequest.variantHint,
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
): Promise<{ created: boolean; id: string; createdAt: Date }> {
        return prisma.$transaction(async (tx) => {
                let created = true
                let id: string
                let createdAt: Date
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
                                        select: { id: true, conversationId: true, createdAt: true },
                                })
                                if (!existing || existing.conversationId !== conversationId) {
                                        throw new Error('Inbound event is linked to a different conversation')
                                }
                                id = existing.id
                                createdAt = existing.createdAt
                        } else {
                                const inserted = await tx.message.findUniqueOrThrow({
                                        where: { inboundEventId: params.inboundEventId },
                                        select: { id: true, createdAt: true },
                                })
                                id = inserted.id
                                createdAt = inserted.createdAt
                        }
                } else {
                        const inserted = await tx.message.create({
                                data: {
                                        conversationId,
                                        role: 'USER',
                                        content: params.message,
                                        metadata: params.inboundMetadata,
                                },
                                select: { id: true, createdAt: true },
                        })
                        id = inserted.id
                        createdAt = inserted.createdAt
                }

                if (created && incrementConversation) {
                        await tx.conversation.update({
                                where: { id: conversationId },
                                data: { messageCount: { increment: 1 }, lastMessageAt: new Date() },
                        })
                }
                return { created, id, createdAt }
        })
}

/**
 * Shared per-turn setup for both engines: plan gate, key lookup, conversation
 * resolution, identity extraction, prompt/history/RAG assembly and persisting
 * the inbound user message.
 */
/**
 * A commerce action resolved deterministically for this turn: a pre-order
 * step, a back-in-stock alert, or a confirmed pre-order to file.
 */
type CommerceTurn =
        | { kind: 'none' }
        | { kind: 'reply'; text: string }
        | { kind: 'submit'; text: string; draftId: string; code: string; operatorSummary: string }
        | { kind: 'instruct'; instruction: string }

/**
 * The agent's commerce switches, read with a raw query that tolerates a
 * database where the columns do not exist yet: the worker runs from source,
 * so a restart before the migration must degrade to "off", never break every
 * inbound message on an unknown-column error.
 */
type CommerceFlags = {
        orderCaptureEnabled: boolean
        restockAlertsEnabled: boolean
        orderUpdatesEnabled: boolean
        cartHoldEnabled: boolean
}

async function loadCommerceFlags(agent: ChatAgent): Promise<CommerceFlags> {
        if (
                agent.orderCaptureEnabled !== undefined && agent.restockAlertsEnabled !== undefined
                && agent.orderUpdatesEnabled !== undefined && agent.cartHoldEnabled !== undefined
        ) {
                return {
                        orderCaptureEnabled: agent.orderCaptureEnabled,
                        restockAlertsEnabled: agent.restockAlertsEnabled,
                        orderUpdatesEnabled: agent.orderUpdatesEnabled,
                        cartHoldEnabled: agent.cartHoldEnabled,
                }
        }
        try {
                const rows = await prisma.$queryRaw<Array<CommerceFlags>>`
                        SELECT "orderCaptureEnabled", "restockAlertsEnabled", "orderUpdatesEnabled", "cartHoldEnabled" FROM "Agent" WHERE id = ${agent.id}`
                return {
                        orderCaptureEnabled: rows[0]?.orderCaptureEnabled === true,
                        restockAlertsEnabled: rows[0]?.restockAlertsEnabled === true,
                        orderUpdatesEnabled: rows[0]?.orderUpdatesEnabled === true,
                        cartHoldEnabled: rows[0]?.cartHoldEnabled === true,
                }
        } catch {
                // The follow-up switches ship in a later migration than the
                // order-capture ones: without them, both are simply off.
        }
        try {
                const rows = await prisma.$queryRaw<Array<{ orderCaptureEnabled: boolean; restockAlertsEnabled: boolean }>>`
                        SELECT "orderCaptureEnabled", "restockAlertsEnabled" FROM "Agent" WHERE id = ${agent.id}`
                return {
                        orderCaptureEnabled: rows[0]?.orderCaptureEnabled === true,
                        restockAlertsEnabled: rows[0]?.restockAlertsEnabled === true,
                        orderUpdatesEnabled: false,
                        cartHoldEnabled: false,
                }
        } catch {
                return { orderCaptureEnabled: false, restockAlertsEnabled: false, orderUpdatesEnabled: false, cartHoldEnabled: false }
        }
}

/** Known customer details offered for confirmation in an order summary. */
function orderPrefill(params: {
        contactName: string | null
        contactPhone: string | null
        facts: Array<{ key: string; value: string }>
}): { name: string | null; phone: string | null; city: string | null; address: string | null } {
        const name = params.contactName?.trim() ?? ''
        const fact = (key: string) => params.facts.find((item) => item.key === key)?.value ?? null
        return {
                // Channel display names («milad_rgb», emoji handles) are not names.
                name: name && /^[\p{L}\s.'‌-]{2,40}$/u.test(name) && looksLikePersonName(name) ? name : null,
                phone: params.contactPhone ?? null,
                city: fact('شهر مقصد ارسال') ?? fact('شهر'),
                address: fact('آدرس'),
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
                  /** Reply locale detected from the customer's message. */
                  turnLang: TurnLanguage
                  /** Order-context block built for this turn — non-empty strings
                   *  other than <verified_order> are instruction-only guards. */
                  orderContext: string
                  /** Structured current-session context used by every channel. */
                  workingState: ConversationWorkingState
                  stateExpectedRevision: number | null
                  stateTrace: ConversationStateTrace
                  /** The LLM turn analyzer's rescue verdict asked for a human. */
                  analyzerHandoffSignal: boolean
                  /** Product ids carded in the agent's previous reply. */
                  recentCardIds: string[]
                  /** Deterministic pre-order / back-in-stock step for this turn. */
                  commerceTurn: CommerceTurn
                  /** The reply model may call the catalog search tools this turn. */
                  catalogToolReason: CatalogToolReason | null
                  /** Deliverable back-in-stock offer for a sold-out answer. */
                  restockOffer: string | null
                  /** The agent files in-chat pre-orders (capability guard mode). */
                  orderCaptureEnabled: boolean
          }
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
        const turnLang = detectTurnLanguage(message, planningHistory)
        const finalSystemPrompt = buildSystemPrompt({
                agent,
                customerInfoState: freshState,
                contactName: resolvedContactName,
                customerPreferences,
                evidenceMemory,
                turnLanguage: turnLang,
                channel: params.channel,
                inboundSource: params.inboundMetadata ?? null,
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
        // Persist the incoming user message (or reuse the event-anchored row
        // that the durable channel handler committed before automation).
                const inbound = await persistInboundTurnMessage(params, conversationId, false)
        // Every inbound turn (widget, chat-link, and messengers) keeps the
        // contact's denormalized last-activity fresh. Messenger inbound is also
        // bumped in upsertContact; the duplicate is harmless.
                bumpContactActivity(conversationId)

        // Retrieve context and build the prompt.
        // ── Catalog lexicon (data-driven intent) ──────────────────────────
        // The tenant's own catalog vocabulary replaces hard-coded vertical
        // nouns as the PRIMARY intent signal for new products. Loaded before
        // planning; fails open (null) so a cache hiccup degrades to legacy
        // behaviour instead of breaking the turn.
        const catalogLexicon = agent.productAccessEnabled
                ? await getAgentCatalogLexicon(agent.id).catch(() => null)
                : null
        const corpusTokens = catalogLexicon?.identityTokens ?? undefined
        const rawProductRequest = planProductRequest(message, planningHistory, corpusTokens)
                let workingState = advanceConversationWorkingState({
                        state: loadedState.state,
                        sessionStartId: loadedState.state.sessionStartId || inbound.id,
                        message,
                        messageId: inbound.id,
                        createdAt: inbound.createdAt,
                        productPlan: rawProductRequest,
                        knownServiceNames: catalogServices.map((service) => service.name),
                })
                let productRequest = contextualizeProductRequest(rawProductRequest, workingState)
                // ── Unresolved anaphora guard ──────────────────────────────
                // «این مدل آماده موجود دارید؟» when the conversation never
                // identified ANY product (no cards sent, no model named, no
                // exact entity): the turn is a clarification ask answered from
                // the knowledge base («برای بررسی موجودی، بفرمایید کدوم محصول…»),
                // never a random catalog row injected as if it were the
                // referent. Probes and product-chunk recall stay off too, or
                // they would re-promote the turn with an arbitrary product.
                const recentMarkerProductIds: string[] = []
                for (const item of history.slice(-8)) {
                        if (item.role !== 'assistant') continue
                        recentMarkerProductIds.push(...assistantCardIds(item))
                }
                let priorUserNamesProduct = false
                if (corpusTokens) {
                        let checked = 0
                        for (let index = history.length - 1; index >= 0 && checked < 3; index -= 1) {
                                const item = history[index]
                                if (item.role !== 'user') continue
                                checked += 1
                                const priorTerms = extractProductTerms(normalizePersianText(item.content ?? ''))
                                if (priorTerms.some((term) => corpusTokens?.has(term))) {
                                        priorUserNamesProduct = true
                                        break
                                }
                        }
                }
                const anaphoricWithoutProduct = productRequest.isProductTurn
                        && UNRESOLVED_ANAPHORA_RE.test(normalizePersianText(message))
                        && recentMarkerProductIds.length === 0
                        && !workingState.activeEntity?.id
                        && !priorUserNamesProduct
                if (anaphoricWithoutProduct) {
                        productRequest = {
                                ...productRequest,
                                isProductTurn: false,
                                explicitShowcase: false,
                                discoveryBrowse: false,
                                resetProductContext: false,
                                requestNewTopic: false,
                                searchTerms: [],
                                includeProductCards: false,
                                variantBrowse: false,
                                variantPick: false,
                                codeVariantVitrine: false,
                                anaphoraConsult: true,
                        }
                }
                // An order in progress or a back-in-stock request is never a
                // «مرسی/باشه» closing: «باشه» confirms a summary there.
                const lastAssistantText = [...history].reverse().find((item) => item.role === 'assistant')?.content ?? null
                const commerceCandidate = Boolean(
                        (agent.orderCaptureEnabled && (detectOrderIntent(message) || await hasActiveOrderDraft(conversationId)))
                        || (agent.restockAlertsEnabled !== false && detectRestockRequest(message, lastAssistantText)),
                )
                const closingReply = commerceCandidate ? null : closingReplyText(message, history, turnLang)
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
                                resetReason: rawProductRequest.requestNewTopic
                                        ? 'EXPLICIT_RESET'
                                        : rawProductRequest.resetProductContext ? 'NEW_PRODUCT_SUBJECT' : null,
                                retrievalQuery: '',
                        })
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
                        }
                }
                let catalogReference: Awaited<ReturnType<typeof findAssignedCatalogReference>> = null
                let catalogStartedNewGoal = false
                const stateRelation = workingState.lastTurn?.relation
                const shortBareCatalogCandidate = Boolean(
                        stateRelation && ['REFINEMENT', 'CORRECTION'].includes(stateRelation) &&
                        message.trim().split(/\s+/u).length <= 6 &&
                        !CATALOG_REFINEMENT_CUE_RE.test(message),
                )
                const shouldProbeCatalog = Boolean(
                        agent.productAccessEnabled && !anaphoricWithoutProduct && stateRelation && (
                                stateRelation === 'NEW_GOAL' ||
                                shortBareCatalogCandidate ||
                                (!productRequest.isProductTurn && workingState.lastTurn?.intent === 'GENERAL'
                                        && ['REFINEMENT', 'REFERENCE', 'ANSWER'].includes(stateRelation))
                        ),
                )
                if (shouldProbeCatalog) {
                        const probeMessages = [...new Set([
                                message,
                                workingState.activeGoal?.label ?? '',
                        ].filter(Boolean))]
                        let referenceMessage = message
                        for (const probeMessage of probeMessages) {
                                catalogReference = await findAssignedCatalogReference(agent.id, probeMessage).catch((error) => {
                                        captureError('chat-engine:catalog-reference-probe', error, {
                                                workspaceId,
                                                metadata: { agentId: agent.id, conversationId },
                                        })
                                        return null
                                })
                                if (catalogReference) {
                                        referenceMessage = probeMessage
                                        break
                                }
                        }
                        if (catalogReference) {
                                productRequest = productRequestFromCatalogReference(
                                        productRequest,
                                        referenceMessage,
                                        catalogReference,
                                )
                                // A catalog match recovered from the saved goal
                                // anchors this follow-up; it does not turn the
                                // customer's refinement into a fresh vitrine.
                                if (referenceMessage !== message) {
                                        productRequest = {
                                                ...productRequest,
                                                explicitShowcase: false,
                                                inventoryMode: 'ANY',
                                        }
                                }
                                const replacesExistingGoal = referenceMessage === message
                                        && Boolean(loadedState.state.activeGoal)
                                        && (stateRelation === 'CORRECTION' || (
                                                stateRelation === 'REFINEMENT'
                                                && catalogReference.searchTerms.length >= 2
                                                && !CATALOG_REFINEMENT_CUE_RE.test(message)
                                        ))
                                if (replacesExistingGoal) {
                                        workingState = startCatalogProductGoal(
                                                workingState,
                                                message,
                                                inbound.id,
                                                catalogReference.searchTerms,
                                                catalogReference.productIds,
                                                catalogReference.match === 'EXACT',
                                        )
                                        productRequest = { ...productRequest, resetProductContext: true }
                                        catalogStartedNewGoal = true
                                } else {
                                        workingState = promoteConversationStateToProduct(
                                                workingState,
                                                catalogReference.searchTerms,
                                                catalogReference.productIds,
                                                catalogReference.match === 'EXACT',
                                        )
                                }
                                productRequest = contextualizeProductRequest(productRequest, workingState)
                        }
                }
                // ── Semantic catalog probe ────────────────────────────────
                // When the vocabulary layer (global nouns + catalog lexicon)
                // still did not flag a product turn, the vector index gets the
                // last word: product chunks stay eligible for retrieval, and a
                // STRONG similarity hit promotes the turn to a product consult.
                // This is what makes brand-new products work on day one — the
                // embedding of the customer's phrasing meets the embedding of
                // the product's own text, with zero per-vertical code.
                const semanticProbeAllowed = Boolean(
                        agent.productAccessEnabled &&
                        !anaphoricWithoutProduct &&
                        !productRequest.isProductTurn &&
                        !productRequest.requestNewTopic &&
                        message.trim().length >= 4,
                )
                // ── LLM turn analyzer — TERM_BUILD phase ─────────────────────
                // A routed product turn that carries ZERO search terms has
                // nothing to retrieve or ground with («هموناش رو بفرست»);
                // one gated fast-model call rebuilds the terms. Fail-open by
                // construction: a null analysis leaves the turn untouched.
                if (
                        analyzerGate({
                                message,
                                plan: productRequest,
                                productAccessEnabled: agent.productAccessEnabled,
                        }) === 'TERM_BUILD'
                ) {
                        const termAnalysis = await analyzeTurn({
                                workspaceId,
                                agentId: agent.id,
                                conversationId,
                                message,
                                history: modelHistory.slice(-6),
                                corpusTokens,
                                phase: 'TERM_BUILD',
                        }).catch(() => null)
                        if (termAnalysis?.intent === 'product' && termAnalysis.productKeywords.length > 0) {
                                productRequest = {
                                        ...productRequest,
                                        searchTerms: analyzerSearchTerms(termAnalysis, message),
                                        analyzerTurn: true,
                                }
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
                                : semanticProbeAllowed ? 6 : 3,
                        includeProductCatalog: agent.productAccessEnabled && (productRequest.isProductTurn || semanticProbeAllowed),
                        excludeProductContentFromText: true,
                        contextTextLimit: 4,
                })
                bumpProductQueries(workspaceId, chunks)

                // Promote a non-product turn to a product consult when a product
                // chunk is a STRONG semantic match. 0.45 sits clearly above the
                // 0.3 relevance gate: weak look-alikes (a clock question against a
                // furniture catalog at ~0.34) must not drag random products into
                // the reply, while real paraphrases (0.45+) prove intent.
                const SEMANTIC_PRODUCT_PROMOTION_SIM = 0.45
                if (semanticProbeAllowed) {
                        const strongProductChunks = chunks.filter((chunk) => {
                                const metadata = chunk.metadata
                                return metadata && typeof metadata === 'object' && 'productId' in metadata
                                        && chunk.similarity >= SEMANTIC_PRODUCT_PROMOTION_SIM
                        })
                        if (strongProductChunks.length > 0) {
                                productRequest = {
                                        ...productRequest,
                                        isProductTurn: true,
                                        explicitShowcase: false,
                                        discoveryBrowse: false,
                                        resetProductContext: false,
                                        requestNewTopic: false,
                                        searchTerms: extractProductTerms(message),
                                        inventoryMode: 'ANY',
                                        semanticTurn: true,
                                }
                        }
                }

                // ── LLM turn analyzer — RESCUE phase ──────────────────────
                // Retrieval returned nothing trusted and no deterministic
                // layer promoted the turn: without help the reply model
                // free-wheels with zero context — the worst-quality corner of
                // the product. One gated fast-model call decides what the
                // customer meant. A product verdict seeds a lexical catalog
                // search (fetchCatalogProducts grounds on terms, not chunk
                // ids); a handoff verdict strengthens the operator escalation
                // check downstream. Honest fail-closed: if the seeded catalog
                // search finds nothing, the regular «پیدا نکردم» reply still
                // applies — the analyzer may route, never invent products.
                let analyzerHandoffSignal = false
                if (
                        analyzerGate({
                                message,
                                plan: productRequest,
                                productAccessEnabled: agent.productAccessEnabled,
                                retrievedChunkCount: chunks.length,
                        }) === 'RESCUE'
                ) {
                        const rescue = await analyzeTurn({
                                workspaceId,
                                agentId: agent.id,
                                conversationId,
                                message,
                                history: modelHistory.slice(-6),
                                corpusTokens,
                                phase: 'RESCUE',
                        }).catch(() => null)
                        if (rescue) {
                                if (rescue.intent === 'product' && rescue.productKeywords.length > 0) {
                                        productRequest = {
                                                ...productRequest,
                                                isProductTurn: true,
                                                explicitShowcase: false,
                                                discoveryBrowse: false,
                                                resetProductContext: false,
                                                requestNewTopic: false,
                                                searchTerms: analyzerSearchTerms(rescue, message),
                                                inventoryMode: 'ANY',
                                                analyzerTurn: true,
                                        }
                                } else if (rescue.handoffUrgent) {
                                        analyzerHandoffSignal = true
                                }
                        }
                }

                const productIds = [...new Set([
                        ...(catalogReference?.productIds ?? []),
                        ...chunks
                        .map((chunk) => {
                                const metadata = chunk.metadata
                                if (!(metadata && typeof metadata === 'object' && 'productId' in metadata)) return null
                                // D3 guard: a product chunk is trusted recall evidence only
                                // when it is a STRONG vector hit or carried a lexical rank —
                                // weak vector-only neighbours (similarity 0.3–0.45) routinely
                                // surfaced irrelevant products on out-of-domain questions.
                                if (chunk.similarity < 0.45 && chunk.lexicalRank == null) return null
                                return String((metadata as Record<string, unknown>).productId)
                        })
                        .filter((id): id is string => !!id),
                ])]

                // A singular detail follow-up («قیمتش؟», «پارچش چیه؟») right after
                // the agent showed exactly ONE product card is about that card.
                // Re-searching by words can land on a sibling design; the card id
                // cannot. A new product/code named in this message wins.
                const recentAssistants = history.filter((item) => item.role === 'assistant').slice(-2)
                const lastAssistant = recentAssistants.at(-1)
                const lastCardIds = lastAssistant ? assistantCardIds(lastAssistant) : []
                // Cards the customer received in the last two replies: not
                // re-sent on follow-ups, and their names need no re-introduction.
                const shownCardIds = [...new Set(recentAssistants.flatMap((item) => assistantCardIds(item)))]
                const anchorProductId = agent.productAccessEnabled
                        && productRequest.isProductTurn
                        && !productRequest.includeProductCards
                        && !productRequest.resetProductContext
                        && !productRequest.comparisonConsult
                        && (productRequest.subjectSwitchTerms?.length ?? 0) === 0
                        && lastCardIds.length === 1
                        ? lastCardIds[0]
                        : null
                // «خیلی گرونه، ارزون‌ترش چی دارید؟»: measure alternatives against the
                // item under discussion; the search itself applies the price ceiling.
                if (productRequest.cheaperAlternative && agent.productAccessEnabled) {
                        const referenceId = workingState.activeEntity?.id ?? lastCardIds[0] ?? workingState.candidateEntityIds[0]
                        const [reference] = referenceId
                                ? await fetchCatalogProductsByIds(agent.id, [referenceId]).catch(() => [])
                                : []
                        if (reference?.price != null) {
                                productRequest = {
                                        ...productRequest,
                                        explicitShowcase: false,
                                        cheaperThan: { name: reference.name, price: reference.price },
                                }
                        }
                }
                const [fetchedCatalogProducts, orderContext, catalogCategories] = await Promise.all([
                        agent.productAccessEnabled
                                ? fetchCatalogProducts(agent.id, productIds, productRequest, corpusTokens, workingState.candidateEntityIds)
                                : Promise.resolve([]),
                        buildOrderContext({
                                workspaceId,
                                message,
                                history,
                                enabled: agent.orderTrackingEnabled,
                                language: agent.language,
                                follow: agent.orderUpdatesEnabled
                                        ? { agentId: agent.id, conversationId, channel: params.channel }
                                        : null,
                        }),
                        // Category overview keeps browse-turn consulting factual.
                        agent.productAccessEnabled && productRequest.discoveryBrowse
                                ? fetchCatalogCategories(agent.id).catch(() => [] as string[])
                                : Promise.resolve([] as string[]),
                ])
                let catalogProducts = fetchedCatalogProducts
                if (anchorProductId) {
                        const anchored = await fetchCatalogProductsByIds(agent.id, [anchorProductId]).catch(() => [])
                        if (anchored.length) catalogProducts = anchored
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
                                : (await fetchCatalogProductsByIds(agent.id, [workingState.activeEntity?.id ?? lastCardIds[0] ?? '']).catch(() => []))
                                        .map((product) => ({ ...product, fullTermMatch: false }))
                }
                // Exact matches that are all sold out: a consultation says
                // «فعلاً ناموجوده» with a real next step, and an explicit catalog
                // request still gets its cards — badged «ناموجود» — instead of
                // collapsing into «پیدا نکردم».
                if (catalogProducts.length > 0 && catalogProducts.every((product) => product.unavailable)) {
                        productRequest = { ...productRequest, unavailableMatch: true }
                }
                // State anchors merged into this turn («پاف نیمکتی» carried into
                // «سایز ۱۲۰ هاش رو نشونم بده») name the family in the intro too.
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
                                activeEntityId: activeProductId,
                                cartHold: agent.cartHoldEnabled === true,
                        })
                        if (restock.kind === 'reply') {
                                commerceTurn = { kind: 'reply', text: restock.text }
                        } else if (agent.orderCaptureEnabled && agent.productAccessEnabled) {
                                const order = await resolveOrderCaptureTurn({
                                        checkout: checkoutContext,
                                        cartModel: model,
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
                // ── Function-calling catalog search ───────────────────────────
                // Budgets, superlatives and empty lexical results are where the
                // regex planner is weakest. One compact tool call turns the
                // customer's words into structured searches; the server enforces
                // the parsed budget/sort and the rows replace this turn's catalog.
                let catalogToolReason = commerceTurn.kind === 'none'
                        ? catalogToolGate({
                                message,
                                plan: productRequest,
                                catalogProducts,
                                productAccessEnabled: agent.productAccessEnabled,
                                hasActiveProduct: Boolean(activeProductId),
                        })
                        : null
                let catalogSearchInstruction = ''
                if (catalogToolReason) {
                        const searchPlan = await planCatalogSearch({
                                agentId: agent.id,
                                workspaceId,
                                conversationId,
                                model,
                                message,
                                history: modelHistory,
                                reason: catalogToolReason,
                                isFa: turnLang !== 'en',
                        }).catch((error) => {
                                captureError('chat-engine:catalog-search-plan', error, {
                                        workspaceId,
                                        metadata: { agentId: agent.id, conversationId },
                                })
                                return null
                        })
                        if (searchPlan) {
                                catalogProducts = searchPlan.products
                                catalogSearchInstruction = searchPlan.instruction
                                productRequest = {
                                        ...productRequest,
                                        isProductTurn: true,
                                        explicitShowcase: false,
                                        discoveryBrowse: false,
                                        unavailableMatch: false,
                                        includeProductCards: searchPlan.products.length > 0,
                                }
                                workingState = enrichConversationStateWithCatalog(workingState, catalogProducts)
                        } else {
                                catalogToolReason = null
                        }
                }

                const turnHistory = historyForProductTurn(modelHistory, productRequest)
                const turnPlanningHistory = historyForProductTurn(planningHistory, productRequest)
                const bookingIntent = hasBookingIntent([
                        ...planningHistory,
                        { role: 'user', content: message },
                ])
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
                        courseTurn: params.capabilityGates?.courses === true && hasCourseIntent([
                                ...planningHistory,
                                { role: 'user', content: message },
                        ]),
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

                const stateTrace = buildConversationStateTrace({
                        state: workingState,
                        historyLoaded: modelHistory.filter((item) => item.role !== 'system').length,
                        historySent: turnHistory.filter((item) => item.role !== 'system').length,
                        resetReason: rawProductRequest.requestNewTopic
                                ? 'EXPLICIT_RESET'
                                : rawProductRequest.resetProductContext || catalogStartedNewGoal
                                        ? 'NEW_PRODUCT_SUBJECT'
                                        : null,
                        retrievalQuery,
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
        /** Operator-facing detail (e.g. the confirmed pre-order card). */
        summary?: string
        kind?: 'handoff' | 'order'
}): Promise<{ messageId: string; alertId: string | null } | null> {
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
                const alertId = await notifyHandoff({
                        workspaceId: params.workspaceId,
                        conversationId: params.conversationId,
                        agentId: params.agent.id,
                        agentName: agentRow?.name ?? 'ایجنت',
                        channel: params.channel,
                        contactId: params.contactId,
                        contactName: params.contactName,
                        contactPhone: params.contactPhone,
                        reason: params.reason,
                        summary: params.summary,
                        kind: params.kind,
                })
                return { messageId: saved.messageId, alertId }
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
        /**
         * True when the reply body is the provider-failure fallback: nothing in
         * it was generated from retrieved knowledge or catalog rows, so the
         * turn must not claim "checked N sources" receipts.
         */
        serviceError?: boolean
        workingState: ConversationWorkingState
        stateExpectedRevision: number | null
        stateTrace: ConversationStateTrace
        /** Status line the reply model appended; already stripped from `reply`. */
        turnSignal?: TurnSignal | null
}): Promise<{ messageId: string }> {
        const unanswered = detectUnanswered(params.reply, params.agent.fallbackMessage)
        // A positive reading only stands when the customer's own words back it.
        const turnSignal = params.turnSignal
                ? groundTurnSignal(params.turnSignal, params.userMessage)
                : null
        const receipts = buildTurnReceipts(
                {
                        userMessage: params.userMessage,
                        assistantReply: params.reply,
                        retrievedChunks: params.serviceError ? [] : params.retrievedChunks,
                },
                { serviceError: params.serviceError },
        )
        for (const receipt of params.extraReceipts ?? []) {
                if (!receipts.some((item) => item.kind === receipt.kind)) receipts.push(receipt)
        }
        const saved = await prisma.$transaction(async (tx) => {
                const metadata = metadataWithReceipts(
                        receipts,
                        {
                                ...(unanswered ? { question: params.userMessage } : {}),
                                agentSkillTrace: agentSkillTrace(params.skillPlan) as unknown as Prisma.InputJsonObject,
                                conversationStateTrace: params.stateTrace as unknown as Prisma.InputJsonObject,
                                ...(turnSignal
                                        ? { turnSignal: turnSignal as unknown as Prisma.InputJsonObject }
                                        : {}),
                        },
                )
                let created = true
                let messageId: string
                let messageCreatedAt: Date
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
                                        select: { id: true, conversationId: true, createdAt: true },
                        })
                        if (row.conversationId !== params.conversationId) {
                                throw new Error('Inbound event result is linked to a different conversation')
                        }
                                messageId = row.id
                                messageCreatedAt = row.createdAt
                } else {
                        const row = await tx.message.create({
                                data: {
                                        conversationId: params.conversationId,
                                        role: 'ASSISTANT',
                                        content: params.reply,
                                        unanswered,
                                        metadata,
                                },
                                select: { id: true, createdAt: true },
                        })
                        messageId = row.id
                        messageCreatedAt = row.createdAt
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
                return { messageId, messageCreatedAt, created }
        })
        // Keep the contact's denormalized last-activity fresh for the CRM list.
        bumpContactActivity(params.conversationId)
        if (saved.created) await syncOnboarding(params.workspaceId)
        const completedState = observeAssistantTurn(
                params.workingState,
                params.reply,
                saved.messageId,
                saved.messageCreatedAt,
        )
        await persistConversationWorkingState({
                conversationId: params.conversationId,
                state: completedState,
                expectedRevision: params.stateExpectedRevision,
        }).catch((error) => {
                // The transcript remains authoritative; the next turn replays
                // any missed messages and heals this derived snapshot.
                captureError('chat-engine:conversation-state-persist', error, {
                        workspaceId: params.workspaceId,
                        metadata: { agentId: params.agent.id, conversationId: params.conversationId },
                })
        })
        // Fold the new status line into the stored snapshot. The pre-reply
        // handoff check already saved one for this turn, without this exchange.
        if (turnSignal && saved.created) {
                await refreshConversationSalesInsight(params.conversationId).catch((error) =>
                        console.error('[chat-engine] turn-signal insight refresh failed:', error),
                )
        }
        return { messageId: saved.messageId }
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
        const preview = createLivePreviewGuard(skillPlan, { userMessage: message, orderCaptureEnabled, hasGroundedOrder })
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
