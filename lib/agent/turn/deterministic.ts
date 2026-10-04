/**
 * Replies built from trusted data without a model call (moved from
 * chat-engine.ts): closings, structured product facts, variant vitrines,
 * family enumerations, honest catalog misses and explicit showcases.
 */
import type { StartChatParams, ChatAgent } from '@/lib/ai/chat-types'
import type { CatalogProduct } from '@/lib/ai/rag'
import type { TurnLanguage } from '@/lib/ai/turn-language'
import {
        buildFamilyEnumerationReply,
        isNarrowedProductRequest,
        showcaseSubjectPhrase,
        structuredProductDetailReply,
        type ProductRequestPlan,
} from '@/lib/ai/conversation'
import { getAgentCatalogLexicon } from '@/lib/ai/catalog-lexicon'
import { buildTrustedProductReply, buildVariantPickReply, buildVariantShowcaseReply } from '@/lib/products/presentation'

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
export function freshCardIds(identified: string[], recent: string[], explicitShowcase: boolean): string[] {
        if (explicitShowcase || !recent.length) return identified
        const recentParents = new Set(recent.map((id) => id.split('#')[0]))
        return identified.filter((id) => !recentParents.has(id.split('#')[0]))
}

export async function buildDeterministicTurnReply(params: {
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
