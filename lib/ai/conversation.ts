import { prisma } from '@/lib/prisma'
import type { ChannelType } from '@prisma/client'
import type { ChatMessage } from '@/lib/ai/openrouter'
import type { CatalogProduct } from '@/lib/ai/rag'
import type { CatalogService } from '@/lib/ai/rag'
import type { StartChatParams } from '@/lib/ai/chat-types'
import type { Prisma } from '@prisma/client'

/**
 * Conversation resolution + per-turn data loading, extracted from the chat
 * engine. Everything here is pure persistence logic — no LLM calls.
 */

export const HISTORY_LIMIT = 12

const MAX_SHOWCASE_PRODUCTS = 10

export interface ProductRequestPlan {
        /** The current turn is about discovering, comparing or showing products. */
        isProductTurn: boolean
        /** The customer explicitly asked to see/list/send products. */
        explicitShowcase: boolean
        /**
         * A broad "what do you have?" browse with no specific product, count or
         * prior context. The agent should consult like a skilled salesperson
         * (brief overview + one narrowing question) instead of dumping a list.
         */
        discoveryBrowse: boolean
        /** A fresh request must not inherit old assistant product claims. */
        resetProductContext: boolean
        /** The customer explicitly rejected/reset the old topic and expects a fresh prompt. */
        requestNewTopic: boolean
        /** 1..10; the actual result can be smaller when the catalog has fewer matches. */
        requestedCount: number
        /** Product terms normalized for deterministic lexical search. */
        searchTerms: string[]
        /** Recommendations normally exclude stock=0. Product.stock=null means available/unlimited. */
        inventoryMode: 'AVAILABLE' | 'OUT_OF_STOCK' | 'ANY'
}

const PRODUCT_INTENT_RE =
        /(?:محصول|کالا|کاتالوگ|فروشگاه|قیمت|موجود|خرید|پیراهن|لباس|کفش|کیف|product|catalog|price|buy|shop|in\s*stock|available)/i
const PRODUCT_SUBJECT_RE =
        /(?:محصول|کالا|کاتالوگ|فروشگاه|پیراهن|لباس|کفش|کیف|product|catalog|shop)/i
/** Imperative "send/show/list" — the customer commands a showcase. */
const SHOWCASE_COMMAND_RE =
        /(?:بفرست|ارسال|نشون|نشان|نمایش|لیست|فهرست|معرفی|پیشنهاد|گزینه|هرچی|هرچه|send|show|list|recommend)/i
/** Interrogative browsing — "what do you have / sell?" without a command. */
const BROWSE_QUERY_RE =
        /(?:چی\s*(?:دار|موجود|هست|می\s*فروش)|چیا\s*(?:دار|موجود)|چه\s*(?:محصول|کالا|جنس|چیز|مدل)|محصولات(?:تون|تان|تو)?\s*چی|what\s+do\s+you\s+(?:have|sell)|what(?:'s|\s+is)\s+available)/i
/** A short bare "yes / show me" reply to the agent's own narrowing question. */
const AFFIRMATIVE_SHOW_RE =
        /^(?:آره|اره|بله|باشه|اوکی|اکی|حتما|حتماً|بفرما|ببینم|نشون\s*بده|نشان\s*بده|بفرست|همه|همش|ok(?:ay)?|yes|sure|show\s*me)[\s.!؟?]*$/i

// A genuine first-person offer to show products, in one clause. Loose word
// co-occurrence is not enough: polite fillers such as «ببینید،» and «در مورد»
// appear in almost every Persian assistant sentence and must not count.
const ASSISTANT_OFFER_VERB =
        '(?:نشون(?:تون|تان)?\\s*(?:بدم|می\\s*دم|میدم)|نشان(?:تان)?\\s*(?:بدهم|می\\s*دهم|دهم)|بفرستم|معرفی\\s*کنم|لیست\\s*کنم|نمایش\\s*(?:بدم|بدهم|می\\s*دهم)|show|send|list)'
const ASSISTANT_OFFER_NOUN =
        '(?:محصول|گزینه|مدل|کاتالوگ|ویترین|پرفروش|پرطرفدار|همه|بیشتر|لیست|موارد|products?|options?|items?|catalog|all|more|popular)'
const ASSISTANT_OFFER_RE = new RegExp(
        `${ASSISTANT_OFFER_NOUN}[^.!؟?\\n]{0,60}${ASSISTANT_OFFER_VERB}|${ASSISTANT_OFFER_VERB}[^.!؟?\\n]{0,60}${ASSISTANT_OFFER_NOUN}`,
        'i',
)
const RESET_CONTEXT_RE =
        /(?:بیخیال|بی‌خیال|فراموش|از\s*اول|درخواست\s*جدید|موضوع\s*جدید|ربطی\s*ندار|اشتباه|بدرد\s*نمی|به\s*درد\s*نمی|never\s*mind|forget|start\s*over|new\s*(?:request|topic))/i
const OUT_OF_STOCK_RE = /(?:ناموجود|تمام\s*شده|اتمام\s*موجودی|out\s+of\s+stock|sold\s+out)/i
const AVAILABLE_RE = /(?:موجود|دار(?:ی|ید|ین|یم|ن)|in\s+stock|available|have)/i
const ORDER_ONLY_RE = /(?:سفارش|پیگیری|رهگیری|مرسوله|ارسال\s*سفارش|order|tracking|shipment)/i
// Bare «وقت» would match the greeting «وقت بخیر», so it only counts with a
// booking-ish continuation («وقت بگیرم», «وقت مشاوره», «وقت خالی»).
const SERVICE_ONLY_RE =
        /(?:خدمت|خدمات|سرویس|نوبت|رزرو|وقت\s*(?:بگیر|میخوا|می‌خوا|خالی|آزاد|مشاوره|ویزیت|بد[هی]|دهی)|service|appointment|booking)/i

const PRODUCT_STOP_WORDS = new Set([
        'سلام', 'درود', 'لطفا', 'لطفاً', 'خواهشاً', 'میشه', 'می‌شه', 'میتونی', 'می‌تونی',
        'محصول', 'محصولات', 'کالا', 'کالاها', 'کاتالوگ', 'فروشگاه', 'قیمت', 'قیمتها', 'قیمت‌ها',
        'موجود', 'موجودی', 'ناموجود', 'خرید', 'فروش', 'بفرست', 'بفرستید', 'بفرستین', 'ارسال',
        'نشون', 'نشان', 'نمایش', 'بده', 'بدین', 'بدهید', 'معرفی', 'پیشنهاد', 'لیست', 'فهرست',
        'گزینه', 'گزینه‌ها', 'مورد', 'عدد', 'هرچی', 'هرچه', 'همه', 'تمام', 'چند', 'چندتا',
        'دارم', 'داری', 'دارید', 'دارین', 'دارن', 'داریدش', 'دارینش', 'هست', 'هستش', 'هستند',
        'رو', 'را', 'از', 'به', 'برای', 'با', 'و', 'یا', 'که', 'تو', 'توی', 'این', 'اون', 'آن',
        'من', 'ما', 'شما', 'یه', 'یک', 'تا', 'بدون', 'هیچ', 'سوال', 'سؤالی', 'سوالی', 'اضافی', 'فعلا',
        'فعلاً', 'دیگه', 'دیگر', 'جدید', 'خوب', 'بهترین', 'هر', 'چی', 'هایی', 'های', 'ها',
        'میخوام', 'می‌خوام', 'میخواهم', 'می‌خواهم', 'میخواد', 'می‌خواد', 'ببینم', 'ببین',
        'موجودتون', 'موجودتان', 'محصولاتتون', 'محصولاتتان', 'محصولامون', 'محصولاتون', 'مشخصات',
        'بفرستی', 'بفرستم', 'بفرستن', 'بفرستیم',
        'قبلی', 'قبل', 'بیخیال', 'فراموش', 'اطلاعات',
        'چیزی', 'چیا', 'چه', 'می', 'فروشید', 'فروشی', 'میفروشید', 'میفروشی', 'بفروشید',
        // Greetings must never become catalog search terms («سلام وقت بخیر»).
        'وقت', 'بخیر', 'صبح', 'عصر', 'شب', 'ظهر', 'خسته', 'نباشید', 'خداقوت',
        'hi', 'hello', 'good', 'morning', 'evening',
        // Affirmatives/acknowledgements must never become catalog search terms.
        'آره', 'اره', 'بله', 'باشه', 'اوکی', 'اکی', 'حتما', 'حتماً', 'بفرما', 'بفرمایید', 'ممنون',
        // Polite imperative endings («معرفی کنید», «نشونم بده»).
        'کن', 'کنید', 'کنین', 'بدید', 'بدین', 'نشونم',
        'yes', 'sure', 'ok', 'okay', 'yeah',
        'product', 'products', 'catalog', 'shop', 'store', 'price', 'prices', 'buy', 'send', 'show',
        'list', 'recommend', 'available', 'stock', 'in', 'have', 'all', 'any', 'please', 'me', 'the',
        'a', 'an', 'some', 'without', 'question', 'questions', 'new', 'more',
        'what', 'whats', "what's", 'you', 'your', 'do', 'does', 'sell', 'selling', 'got',
        'there', 'is', 'are', 'anything', 'something',
])

function normalizePersianText(value: string): string {
        return value
                .normalize('NFKC')
                .replace(/ي/g, 'ی')
                .replace(/ك/g, 'ک')
                .replace(/[\u200c\u200d]/g, ' ')
                .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
                .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
                .replace(/\s+/g, ' ')
                .trim()
}

function extractProductTerms(value: string): string[] {
        const tokens = normalizePersianText(value)
                .toLocaleLowerCase('fa')
                .split(/[^\p{L}\p{N}_-]+/u)
                .map((token) => token.trim())
                .filter((token) => token.length >= 2 && !/^\d+$/.test(token))

        const terms: string[] = []
        for (const token of tokens) {
                if (PRODUCT_STOP_WORDS.has(token)) continue
                // Persian plural suffixes are often written without a ZWNJ.
                const withoutPossessive = token.length > 4
                        ? token.replace(/(?:تون|تان|مون|مان|شون|شان)$/u, '')
                        : token
                const singular = withoutPossessive.length > 4
                        ? withoutPossessive.replace(/(?:هایی|های|ها)$/u, '')
                        : withoutPossessive
                const term = singular.length >= 2 ? singular : token
                if (!PRODUCT_STOP_WORDS.has(term) && !terms.includes(term)) terms.push(term)
                if (terms.length >= 6) break
        }
        return terms
}

/** An explicit number/word count in the message, or null when none was given. */
function explicitRequestedCount(normalized: string): number | null {
        const tokens = normalized.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
        const contextualNumber = normalized.match(
                /(?:^|\s)(\d+)\s*(?:تا|عدد|مورد|محصول|کالا|گزینه|products?|items?)(?:\s|$)/iu,
        )?.[1] ?? normalized.match(/(?:تعداد|حداکثر|max(?:imum)?)\s*[:=]?\s*(\d+)/iu)?.[1]
        if (contextualNumber) {
                return Math.min(MAX_SHOWCASE_PRODUCTS, Math.max(1, Number(contextualNumber)))
        }
        const numeric = tokens
                .map((token) => Number(token))
                .find((value) => Number.isInteger(value) && value >= 1 && value <= MAX_SHOWCASE_PRODUCTS)
        if (numeric) return numeric

        const words = new Map<string, number>([
                ['یک', 1], ['یه', 1], ['اول', 1], ['دو', 2], ['سه', 3], ['چهار', 4], ['پنج', 5],
                ['شش', 6], ['هفت', 7], ['هشت', 8], ['نه', 9], ['ده', 10],
                ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5],
                ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
        ])
        // «یه سوال» and the negation «نه» are not counts: a word-number only
        // counts when a counting noun follows it («سه تا», «یه محصول», 'two items').
        const counterNouns = new Set([
                'تا', 'عدد', 'مورد', 'محصول', 'کالا', 'گزینه', 'مدل', 'دونه',
                'product', 'products', 'item', 'items', 'option', 'options',
        ])
        for (let index = 0; index < tokens.length; index += 1) {
                const value = words.get(tokens[index])
                if (value && counterNouns.has(tokens[index + 1] ?? '')) return value
        }
        if (/(?:هرچی|هرچه|همه|تمام|all|everything)/i.test(normalized)) return MAX_SHOWCASE_PRODUCTS
        return null
}

/**
 * Build a deterministic product-search plan from the current message. When a
 * follow-up only says "send five", the closest earlier user product terms are
 * carried forward; assistant claims are never used as search input.
 */
export function planProductRequest(message: string, history: ChatMessage[]): ProductRequestPlan {
        const normalized = normalizePersianText(message)
        const resetRequested = RESET_CONTEXT_RE.test(normalized)
        const orderOnly = ORDER_ONLY_RE.test(normalized)
        const showcaseCommand = SHOWCASE_COMMAND_RE.test(normalized)
        const browseQuery = BROWSE_QUERY_RE.test(normalized)
        const productKeywordSignal = PRODUCT_INTENT_RE.test(normalized)
        // Availability verbs such as «دارید» are useful for named-product
        // queries, but are not product intent when the user explicitly asks
        // about services, appointments or bookings.
        const serviceOnly = SERVICE_ONLY_RE.test(normalized) && !PRODUCT_SUBJECT_RE.test(normalized)
        const directProductSignal = productKeywordSignal || (!serviceOnly && AVAILABLE_RE.test(normalized))

        let priorProductTerms: string[] = []
        // A prior browse turn ("what do you have?") counts as product context
        // even when it produced no search terms — it lets a follow-up such as
        // "show all" or a bare "yes" complete the browse into a showcase.
        let priorProductSignal = false
        if (!resetRequested) {
                for (let index = history.length - 1; index >= 0; index -= 1) {
                        const previous = history[index]
                        if (previous.role !== 'user') continue
                        // Normalize like the current turn: ZWNJ («چی می‌فروشید»)
                        // must not hide a prior browse signal from the regexes.
                        const previousContent = normalizePersianText(previous.content ?? '')
                        if (RESET_CONTEXT_RE.test(previousContent)) break
                        const previousProductKeyword = PRODUCT_INTENT_RE.test(previousContent)
                        const previousIsNonProduct =
                                ORDER_ONLY_RE.test(previousContent) ||
                                (SERVICE_ONLY_RE.test(previousContent) && !PRODUCT_SUBJECT_RE.test(previousContent))
                        if (previousIsNonProduct) continue
                        const previousHasProductSignal =
                                previousProductKeyword ||
                                AVAILABLE_RE.test(previousContent) ||
                                BROWSE_QUERY_RE.test(previousContent)
                        if (!previousHasProductSignal) continue
                        priorProductSignal = true
                        priorProductTerms = extractProductTerms(previousContent)
                        if (priorProductTerms.length) break
                }
        }

        // A bare "yes / show me" is only a showcase acceptance when the agent
        // itself just offered to show products — a bare "بله" answering "shall I
        // register your order?" must never dump a product list.
        const lastAssistant = [...history].reverse().find((item) => item.role === 'assistant')
        const assistantOfferedShowcase =
                !!lastAssistant && ASSISTANT_OFFER_RE.test(normalizePersianText(lastAssistant.content ?? ''))
        const affirmativeFollowUp =
                AFFIRMATIVE_SHOW_RE.test(normalized.trim()) && priorProductSignal && assistantOfferedShowcase

        const currentTerms = extractProductTerms(normalized)

        // A generic verb such as "send/show/list" is not enough by itself:
        // "send this message" and "show my orders" must never become a catalog
        // showcase. A product/commercial cue or a recent product context is
        // required; the latter supports follow-ups such as "send five" and
        // "show all" right after a browse question.
        const showcaseFromContext =
                showcaseCommand &&
                (priorProductTerms.length > 0 || (priorProductSignal && currentTerms.length === 0))
        const explicitShowcase =
                !orderOnly && !serviceOnly && (
                        (showcaseCommand && directProductSignal) ||
                        showcaseFromContext ||
                        affirmativeFollowUp
                )
        // «بیخیال، چی دارین؟» resets AND states the new request in one message;
        // only a reset with no product/browse content asks for a fresh prompt.
        const requestNewTopic =
                resetRequested && !explicitShowcase && !browseQuery && !directProductSignal
        const isProductTurn =
                !requestNewTopic && !orderOnly && !serviceOnly &&
                (directProductSignal || browseQuery || explicitShowcase)
        // An accepted offer refers to what was discussed before, never to the
        // affirmative word itself.
        let searchTerms = isProductTurn ? (affirmativeFollowUp ? [] : currentTerms) : []

        if (isProductTurn && searchTerms.length === 0 && !resetRequested) searchTerms = priorProductTerms

        const explicitCount = explicitRequestedCount(normalized.toLocaleLowerCase('fa'))

        // "What do you have?" with no specific product, no count and no prior
        // product context is a browse — the professional move is a short
        // consult (overview + one narrowing question), not a 10-card dump.
        const discoveryBrowse =
                isProductTurn && !explicitShowcase &&
                browseQuery && explicitCount == null && searchTerms.length === 0

        const inventoryMode = OUT_OF_STOCK_RE.test(normalized)
                ? 'OUT_OF_STOCK'
                : explicitShowcase || AVAILABLE_RE.test(normalized)
                        ? 'AVAILABLE'
                        : 'ANY'

        return {
                isProductTurn,
                explicitShowcase,
                discoveryBrowse,
                resetProductContext: resetRequested || explicitShowcase,
                requestNewTopic,
                requestedCount:
                        explicitCount ?? (explicitShowcase ? MAX_SHOWCASE_PRODUCTS : discoveryBrowse ? 6 : 5),
                searchTerms,
                inventoryMode,
        }
}

/** Remove stale product claims when the customer starts a fresh catalog request. */
export function historyForProductTurn(
        history: ChatMessage[],
        plan: ProductRequestPlan,
): ChatMessage[] {
        // The current turn itself is a hard boundary. It is appended separately
        // by buildMessages, so no earlier messages are needed here.
        if (plan.resetProductContext) return []

        // Persist the boundary across later turns. Otherwise HISTORY_LIMIT would
        // bring messages from before "forget that / start over" back into the
        // model on the very next message.
        for (let index = history.length - 1; index >= 0; index -= 1) {
                const item = history[index]
                if (item.role !== 'user') continue
                const content = normalizePersianText(item.content ?? '')
                if (RESET_CONTEXT_RE.test(content)) return history.slice(index + 1)

                const priorShowcaseBoundary =
                        !ORDER_ONLY_RE.test(content) &&
                        !(SERVICE_ONLY_RE.test(content) && !PRODUCT_SUBJECT_RE.test(content)) &&
                        SHOWCASE_COMMAND_RE.test(content) &&
                        (PRODUCT_INTENT_RE.test(content) || AVAILABLE_RE.test(content))
                if (priorShowcaseBoundary) return history.slice(index)
        }
        return history
}

export function isHumanOwnedConversation(conversation: {
        status: 'OPEN' | 'RESOLVED' | 'HANDED_OFF'
        handedOff: boolean
}): boolean {
        return conversation.handedOff || conversation.status === 'HANDED_OFF'
}

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
export async function resolveConversation(
        params: StartChatParams,
): Promise<{
        id: string
        customerInfoState: string
        status: 'OPEN' | 'RESOLVED' | 'HANDED_OFF'
        handedOff: boolean
}> {
        const { workspaceId, agent } = params

        if (params.conversationId) {
                const found = await prisma.conversation.findFirst({
                        where: { id: params.conversationId, workspaceId, agentId: agent.id },
                        select: { id: true, customerInfoState: true, status: true, handedOff: true },
                })
                if (found)
                        return {
                                id: found.id,
                                customerInfoState: found.customerInfoState,
                                status: found.status,
                                handedOff: found.handedOff,
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
                        select: { id: true, status: true, handedOff: true, customerInfoState: true },
                })
                if (found) {
                        // A resolved thread may resume when the customer returns. A human
                        // handoff is intentionally sticky: only the operator-facing reset
                        // action is allowed to give control back to the AI.
                        if (found.status === 'RESOLVED' && !found.handedOff) {
                                await prisma.conversation.update({
                                        where: { id: found.id },
                                        data: { status: 'OPEN' },
                                })
                        }
                        return {
                                id: found.id,
                                customerInfoState: found.customerInfoState,
                                status: found.status === 'RESOLVED' && !found.handedOff ? 'OPEN' : found.status,
                                handedOff: found.handedOff,
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

        try {
                const created = await prisma.conversation.create({
                        data: {
                                workspaceId,
                                agentId: agent.id,
                                channel: params.channel,
                                contactId: params.contactId,
                                externalId: params.externalId,
                                customerInfoState: initialState,
                        },
                        select: { id: true },
                })
                return {
                        id: created.id,
                        customerInfoState: initialState,
                        status: 'OPEN',
                        handedOff: false,
                }
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
                                select: { id: true, customerInfoState: true, status: true, handedOff: true },
                        })
                        if (winner)
                                return {
                                        id: winner.id,
                                        customerInfoState: winner.customerInfoState,
                                        status: winner.status,
                                        handedOff: winner.handedOff,
                                }
                }
                throw e
        }
}

/** Load recent conversation history as model-ready chat messages. */
export async function loadHistory(
        conversationId: string,
        excludeInboundEventId?: string,
): Promise<ChatMessage[]> {
        const past = await prisma.message.findMany({
                where: {
                        conversationId,
                        // On a crash retry the durable channel handler may already have
                        // stored this USER row. It is appended below as the current turn,
                        // so exclude the event anchor from history to avoid prompting the
                        // model with the same customer message twice.
                        ...(excludeInboundEventId
                                ? { NOT: { inboundEventId: excludeInboundEventId } }
                                : {}),
                },
                orderBy: { createdAt: 'desc' },
                take: HISTORY_LIMIT,
                select: { role: true, content: true },
        })
        return past
                .reverse()
                .filter((m) => m.role === 'USER' || m.role === 'ASSISTANT')
                .map((m) => ({
                        role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
                        // Product markers are presentation metadata, not useful
                        // conversational context; excluding them saves tokens and
                        // prevents the model from copying stale cards forward.
                        content: m.content
                                .replace(/\[\[product:\{[\s\S]*?\}\]\]/g, '')
                                .replace(/\n{3,}/g, '\n\n')
                                .trim(),
                }))
}

function searchableProductText(product: {
        name: string
        description: string | null
        sku: string | null
        tags: string[]
        attributes: Prisma.JsonValue | null
        category: { name: string } | null
}): {
        name: string
        description: string
        sku: string
        tags: string
        attributes: string
        category: string
} {
        return {
                name: normalizePersianText(product.name).toLocaleLowerCase('fa'),
                description: normalizePersianText(product.description ?? '').toLocaleLowerCase('fa'),
                sku: normalizePersianText(product.sku ?? '').toLocaleLowerCase('fa'),
                tags: normalizePersianText(product.tags.join(' ')).toLocaleLowerCase('fa'),
                attributes: normalizePersianText(product.attributes ? JSON.stringify(product.attributes) : '').toLocaleLowerCase('fa'),
                category: normalizePersianText(product.category?.name ?? '').toLocaleLowerCase('fa'),
        }
}

/**
 * Hybrid catalog retrieval. Semantic product IDs provide fuzzy recall, while
 * a deterministic DB lexical pass guarantees that broad category/name queries
 * (for example "all available shirts") can return every requested slot rather
 * than whichever few chunks happened to win vector search.
 */
export async function fetchCatalogProducts(
        agentId: string,
        productIds: string[],
        plan: ProductRequestPlan,
): Promise<CatalogProduct[]> {
        if (!plan.isProductTurn) return []

        const rankedIds = [...new Set(productIds)].slice(0, 40)
        const terms = plan.searchTerms.slice(0, 6)
        const lexicalFilters: Prisma.ProductWhereInput[] = terms.flatMap((term) => [
                { name: { contains: term, mode: 'insensitive' as const } },
                { description: { contains: term, mode: 'insensitive' as const } },
                { sku: { contains: term, mode: 'insensitive' as const } },
                { tags: { has: term } },
                { category: { is: { name: { contains: term, mode: 'insensitive' as const } } } },
        ])
        // A broad request with no meaningful term must search the whole active
        // assigned catalog. Restricting it to the handful of semantic chunks
        // would recreate the "only one product" failure.
        const matchFilters: Prisma.ProductWhereInput[] = terms.length
                ? [
                        ...(rankedIds.length ? [{ id: { in: rankedIds } }] : []),
                        ...lexicalFilters,
                ]
                : []
        const availabilityFilter: Prisma.ProductWhereInput = plan.inventoryMode === 'AVAILABLE'
                ? { OR: [{ stock: null }, { stock: { gt: 0 } }] }
                : plan.inventoryMode === 'OUT_OF_STOCK'
                        ? { stock: 0 }
                        : {}

        const rows = await prisma.product.findMany({
                where: {
                        active: true,
                        catalogItems: { some: { agentId } },
                        AND: [
                                availabilityFilter,
                                ...(matchFilters.length ? [{ OR: matchFilters }] : []),
                        ],
                },
                // The prompt still receives at most ten rows. This wider DB-only
                // candidate pool makes ranking reliable even for 500+ products.
                take: 160,
                orderBy: [{ queryCount: 'desc' }, { updatedAt: 'desc' }],
                select: {
                        id: true,
                        name: true,
                        description: true,
                        price: true,
                        stock: true,
                        images: true,
                        externalUrl: true,
                        sku: true,
                        tags: true,
                        attributes: true,
                        queryCount: true,
                        updatedAt: true,
                        category: { select: { name: true } },
                },
        })

        const semanticRank = new Map(rankedIds.map((id, index) => [id, index]))
        const phrase = terms.join(' ')
        const ranked = rows.map((product) => {
                const searchable = searchableProductText(product)
                let coverage = 0
                let score = 0

                for (const term of terms) {
                        let matched = false
                        if (searchable.name.includes(term)) {
                                score += searchable.name === term ? 70 : 40
                                matched = true
                        }
                        if (searchable.category.includes(term)) {
                                score += searchable.category === term ? 45 : 30
                                matched = true
                        }
                        if (searchable.sku.includes(term)) {
                                score += 45
                                matched = true
                        }
                        if (searchable.tags.includes(term)) {
                                score += 18
                                matched = true
                        }
                        if (searchable.attributes.includes(term)) {
                                score += 12
                                matched = true
                        }
                        if (searchable.description.includes(term)) {
                                score += 7
                                matched = true
                        }
                        if (matched) coverage += 1
                }

                if (phrase && searchable.name.includes(phrase)) score += 60
                const vectorRank = semanticRank.get(product.id)
                if (vectorRank != null) score += Math.max(4, 36 - vectorRank * 1.5)
                if (product.stock == null || product.stock > 0) score += 5
                score += Math.min(3, Math.log2(product.queryCount + 1))

                return { product, coverage, score }
        })

        ranked.sort((left, right) => {
                if (terms.length && right.coverage !== left.coverage) return right.coverage - left.coverage
                if (right.score !== left.score) return right.score - left.score
                return right.product.updatedAt.getTime() - left.product.updatedAt.getTime()
        })

        return ranked.slice(0, Math.min(MAX_SHOWCASE_PRODUCTS, plan.requestedCount)).map(({ product }) => ({
                id: product.id,
                name: product.name,
                description: product.description,
                price: product.price,
                stock: product.stock,
                category: product.category?.name ?? null,
                image: product.images[0] ?? null,
                url: product.externalUrl,
                attributes: product.attributes,
                tags: product.tags,
        }))
}

/**
 * Compact category overview for browse/discovery turns, so the agent can say
 * what the store actually sells ("پیراهن، ست، شلوار…") before narrowing down.
 */
export async function fetchCatalogCategories(agentId: string): Promise<string[]> {
        const rows = await prisma.product.findMany({
                where: {
                        active: true,
                        catalogItems: { some: { agentId } },
                        category: { isNot: null },
                        // The overview must reflect what can actually be bought.
                        OR: [{ stock: null }, { stock: { gt: 0 } }],
                },
                select: { category: { select: { name: true } } },
                // Deterministic sample: the most-asked-about products first, so
                // the top-12 category list is stable even for huge catalogs.
                orderBy: [{ queryCount: 'desc' }, { updatedAt: 'desc' }],
                take: 400,
        })
        const counts = new Map<string, number>()
        for (const row of rows) {
                const name = row.category?.name?.trim()
                if (!name) continue
                counts.set(name, (counts.get(name) ?? 0) + 1)
        }
        return [...counts.entries()]
                .sort((left, right) => right[1] - left[1])
                .slice(0, 12)
                .map(([name]) => name)
}

/** Active services are a shared operational catalog for chat and booking tools. */
export async function fetchCatalogServices(workspaceId: string): Promise<CatalogService[]> {
        return prisma.service.findMany({
                where: { workspaceId, active: true },
                orderBy: { createdAt: 'asc' },
                take: 30,
                select: { name: true, description: true, durationMinutes: true, location: true },
        })
}
