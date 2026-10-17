import { prisma } from '@/lib/prisma'
import { attributeLaneIds } from '@/lib/search/attribute-lane'
import type { ChannelType } from '@prisma/client'
import type { ChatMessage } from '@/lib/ai/openrouter'
import type { CatalogProduct } from '@/lib/ai/rag'
import type { CatalogService } from '@/lib/ai/rag'
import type { StartChatParams } from '@/lib/ai/chat-types'
import type { Prisma } from '@prisma/client'
import { historyCardIds, isConversationMemory } from '@/lib/ai/conversation-memory'
import { isFirstPersonCityToken } from '@/lib/ai/fact-capture'
import { attributeValueText, extractTypedVariations } from '@/lib/products/description'
import { PERSIAN_DIGIT_RE, persianDigitToLatin, LATIN_DIGIT_RE, latinDigitToPersian } from '@/lib/agent/parsers/digits'

/**
 * Conversation resolution + per-turn data loading, extracted from the chat
 * engine. Rolling history and its LLM compaction live in conversation-memory.
 */

export { RECENT_HISTORY_LIMIT as HISTORY_LIMIT } from '@/lib/ai/conversation-memory'
export { loadConversationHistory as loadHistory } from '@/lib/ai/conversation-memory'

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
        /**
         * Non-attribute terms named by THIS message («میز»، «تلویزیون» from
         * «میز تلویزیون ۱۶۰ می‌خوام»). Numbers and رنگ/طرح/سایز/جنس/مدل/کد-labelled
         * values describe the CURRENT product and never prove a subject switch.
         * The durable state engine uses them to restart a stale product goal
         * (میز عسلی → میز تلویزیون) instead of accumulating anchors forever.
         */
        subjectSwitchTerms?: string[]
        /** Recommendations normally exclude stock=0. Product.stock=null means available/unlimited. */
        inventoryMode: 'AVAILABLE' | 'OUT_OF_STOCK' | 'ANY'
        /**
         * Whether this turn may render rich product cards. Focused follow-up
         * questions about one already established product (for example
         * «پارچه‌اش چیه؟») need a direct text answer, not another catalog card.
         */
        includeProductCards: boolean
        /** A focused structured fact that can be answered without an LLM. */
        detailField: 'MATERIAL' | null
        /**
         * The customer referenced an identifier-like product code (a bare
         * leading-zero SKU such as «۰۷۸۸», or a «کد 0742»-style label). When
         * the catalog search then finds a row covering every search term, that
         * row is the exact item the customer named and its product card must
         * be presented — on showcase and consultation turns alike.
         */
        codeIdentified: boolean
        /**
         * The customer asked to SEE the variants (طرح/رنگ/تنوع) of the product
         * under discussion — «کاتالوگ طرح‌های دیگشو میفرستی», «رنگ هاشو بفرست».
         * The deterministic reply is a vitrine of that product's in-stock
         * variations, each card carrying the variation's own photo and price.
         */
        variantBrowse: boolean
        /**
         * The kind of variant the customer asked about («چه رنگایی داره؟» →
         * color). A design list answers a question about designs, never one
         * about the colors or sizes of the product they pointed at.
         */
        variantAxis?: 'color' | 'size' | 'design' | null
        /**
         * A SINGULAR variant reference in the current message («0788 طرح 05»,
         * «رنگ کرم») — the noun plus the value token right after it. Attached to
         * identified product directives so the trusted card deterministically
         * carries that variation's own photo/price/stock, with no reliance on
         * the model echoing a "variant" field. Null on browse turns and when
         * no such noun+value pair exists.
         */
        variantHint: string | null
        /**
         * Most-recent-first references to the product the variant browse is
         * about: product ids extracted from [[product:]] markers in recent
         * assistant replies (may carry a «#v<id>» variation suffix) and bare
         * product codes from recent customer messages. Resolution happens in
         * the presentation layer against the agent's assigned catalog.
         */
        variantTargetRefs: string[]
        /**
         * The customer named ONE specific variant of the product under
         * discussion WITHOUT a product code («طرح 07 رو میخوام»,
         * «رنگ شکلاتی دارین؟») — hint present + an earlier product reference.
         * The deterministic reply is that variation's own card; the catalog-
         * wide vitrine must NOT fire on the variant word instead.
         */
        variantPick: boolean
        /**
         * The customer named ONE exact catalog row by its product code — a
         * bare «0788», «کد 0788» or «تونیک روناز ۰۷۸۸» — without pinning any
         * specific variation. When the catalog search's full-term match then
         * identifies exactly one variant-bearing row, the deterministic reply
         * is that product's variant vitrine: every available design's own
         * photo/price/stock card, exactly like «طرح هاشو بفرست», instead of a
         * consultation whose single parent card happens to show one design.
         * Hint («0788 طرح 05»), plural-browse («0788 طرح‌هاشو بفرست»),
         * order/service/policy/reset and non-catalog-code turns keep their
         * own routing and never fire this flag.
         */
        codeVariantVitrine: boolean
        /**
         * Terms of THIS message that hit the agent's own catalog lexicon
         * (tokens derived from assigned product names/categories/tags/SKUs —
         * see lib/ai/catalog-lexicon.ts). They prove product intent for
         * verticals outside the global PRODUCT_NOUNS list («پاف», «قابلمه»…)
         * and act as subject nouns for grounded catalog matching, without
         * any per-vertical code changes.
         */
        corpusSubjectTerms?: string[]
        /**
         * This turn was promoted to a product consult by SEMANTIC catalog
         * recall (a strong vector hit against a product chunk) rather than
         * by the global vocabulary or the catalog lexicon. Grounding stays
         * honest (no fullTermMatch) and the canned no-match reply must not
         * fire — the turn already carries real catalog evidence.
         */
        semanticTurn?: boolean
        /**
         * This turn was routed (or its search terms were rebuilt) by the
         * LLM TURN ANALYZER (lib/ai/turn-analyzer.ts) — the gated rescue
         * layer for phrasings every deterministic matcher misses. Analyzer
         * turns keep honest grounding: if the catalog search then finds no
         * rows, the fail-closed «not found» reply still applies — the
         * analyzer may route, but never invent products.
         */
        analyzerTurn?: boolean
        /**
         * Decor advice on the customer's OWN furniture ("مبل کرم دارم، چه
         * طرحی پیشنهاد میدی؟") is a knowledge-base consultation, never a
         * catalog search: grounding [مبل, کرم] only ever finds nothing and the
         * turn used to die as "کرم پیدا نکردم" even though the tenant has a
         * dedicated design-recommendation document keyed by sofa color.
         */
        advisoryConsult?: boolean
        /**
         * A comparative-choice follow-up ("کدومش ارزون‌تره؟") about the pair
         * the customer has been discussing. Grounding must cover BOTH sides
         * of the pair — a single term-set can only cover one side (or rows
         * whose design name contains both terms, e.g. "طرح نقش جهان") — so
         * the reply can compare real per-side prices instead of inventing
         * equality from whichever rows a one-sided search happened to return.
         */
        comparisonConsult?: boolean
        /**
         * The message is an anaphoric reference ("این مدل …") but the
         * conversation never identified a product (no cards sent, no model
         * named). The turn stays a knowledge-base consultation that asks the
         * customer WHICH product they mean — a random catalog row must never
         * be injected as if it were the referent.
         */
        anaphoraConsult?: boolean
        /**
         * «خیلی گرونه، ارزون‌ترش چی دارید؟» — the customer wants genuinely
         * cheaper alternatives in the SAME product family as the item under
         * discussion, not a two-sided comparison. searchTerms hold the family
         * (subject) terms only; the engine keeps rows priced below the item.
         */
        cheaperAlternative?: boolean
        /** The item the cheaper alternatives are measured against (set by the engine). */
        cheaperThan?: { name: string; price: number } | null
        /**
         * Every catalog row that exactly matches this request is out of stock
         * (see fetchCatalogProducts). The reply states that honestly instead
         * of «not found», and no vitrine is forced.
         */
        unavailableMatch?: boolean
}

// ─── Catalog intent vocabulary ───────────────────────────────────────────────
// One shared noun list feeds both the intent and the subject matcher so every
// store vertical (fashion, bags, shoes, jewelry, cosmetics, electronics, home,
// food, books, toys, sports) gets the same routing quality. Words that are
// ambiguous outside a shopping context (ساعت, پست, رژ, گل…) are intentionally
// NOT bare tokens — only their unambiguous compounds are listed.
const PRODUCT_NOUNS =
        'محصول|کالا|کاتالوگ|فروشگاه' +
        '|پیراهن|لباس|شومیز|بلوز|تونیک|دامن|شلوار|سارافون|سارافان|مانتو|کاپشن|پالتو|بافت|روسری|مقنعه' +
        '|کت|جین|شرت|هودی|سویشرت|تیشرت|تاپ|کراپ|کراوات|پاپیون|شال|چادر|شنل|جوراب|کلاه|دستکش|کمربند' +
        '|کفش|صندل|بوت|کالج|کتانی|دمپایی' +
        '|کیف|کوله|ساک|چمدان' +
        '|عینک|ساعت\\s*مچی|ساعت\\s*هوشمند|گوشواره|گردنبند|دستبند|انگشتری|زیورآل|جواهر' +
        '|عطر|آرایش|کرم|لاک|لوسیون|شامپو|ضد\\s*آفتاب' +
        '|گوشی|موبایل|لپ\\s*تاپ|تبلت|هندزفری|هدست|ایرباد|پاوربانک|شارژر' +
        '|فرش|قالی|مبل|مبلمان|پرده|روتختی|رو\\s*تختی|تشک|لحاف|پتو|بالش|لوستر|آباژور|ظروف|ست\\s*صبحانه' +
        // «میز» is the head noun of a whole furniture family (میز تلویزیون، میز
        // عسلی، میز جلو مبلی…). The lookahead keeps «میزان/میزبان/میزگرد» out.
        '|میز(?!ان|بان|گرد)' +
        '|شکلات|کیک|شیرینی|قهوه|چای|عسل|خرما|آجیل|زعفران|برنج|روغن|خشکبار' +
        '|اسباب\\s*بازی|کتاب|دفتر|مداد|خودکار' +
        '|دوچرخه|اسکوتر|گلدان|اکسسوری'

/**
 * The global retail nouns as plain words («ساعت مچی», «میز»): real words a
 * catalog spelling fix must never rewrite into a different product.
 */
export const GLOBAL_PRODUCT_WORDS: ReadonlySet<string> = new Set(
        PRODUCT_NOUNS.split('|')
                .map((word) => word.replace(/\(\?![^)]*\)/g, '').replace(/\\s\*/g, ' ').trim())
                .filter(Boolean),
)

const PRODUCT_INTENT_RE =
        new RegExp(`(?:${PRODUCT_NOUNS}|قیمت|موجود|خرید|product|catalog|price|buy|shop|in\\s*stock|available)`, 'i')
export const PRODUCT_SUBJECT_RE =
        new RegExp(`(?:${PRODUCT_NOUNS}|product|catalog|shop)`, 'i')
/** Imperative "send/show/list" — the customer commands a showcase. */
const SHOWCASE_COMMAND_RE =
        /(?:بفرست|ارسال|نشون|نشان|نمایش|لیست|فهرست|معرفی|پیشنهاد|گزینه|هرچی|هرچه|send|show|list|recommend)/i
const RESET_CONTEXT_RE =
        /(?:بی\s*خیال|فراموش\s*(?:کن|کنید|کنین)|از\s*اول\s*(?:شروع|بپرس)|درخواست\s*جدید|موضوع\s*جدید|never\s*mind|forget\s+(?:it|that|the\s+previous)|start\s*over|new\s*(?:request|topic))/i
// Match Persian «دارید/دارین/داری…» as a complete token. The previous loose
// substring also matched the negated «نداری» in sentences such as «اگر اطلاعات
// قطعی نداری حدس نزن» and, combined with the word «ارسال», misrouted shipping
// policy questions into the deterministic product-showcase fallback.
const AVAILABLE_RE = /(?:موجود|(?:^|[^\p{L}\p{N}_])دار(?:ی|ید|ین|یم|ن)(?:ش)?(?=$|[^\p{L}\p{N}_])|in\s+stock|available|have)/iu
const ORDER_ONLY_RE = /(?:سفارش|پیگیری|رهگیری|مرسوله|ارسال\s*سفارش|order|tracking|shipment)/i
// Bare «وقت» would match the greeting «وقت بخیر», so it only counts with a
// booking-ish continuation («وقت بگیرم», «وقت مشاوره», «وقت خالی»).
const SERVICE_ONLY_RE =
        /(?:خدمت|خدمات|سرویس|نوبت|رزرو|وقت\s*(?:بگیر|میخوا|می‌خوا|خالی|آزاد|مشاوره|ویزیت|بد[هی]|دهی)|service|appointment|booking)/i
/** Explicit SKU/code labels and short leading-zero codes are strong catalog evidence. */
const PRODUCT_CODE_RE =
        /(?:(?:کد|شناسه)(?:\s*(?:محصول|کالا))?|sku)\s*[:：#-]?\s*((?=[\p{L}\p{N}_-]*\d)[\p{L}\p{N}][\p{L}\p{N}_-]*)/iu
// Keep this deliberately shorter than a phone number; a bare "0742" is a
// common product reference, while an 11-digit 09… value is customer identity.
// Thousands separators are excluded from the boundaries so the "098" inside
// a formatted price such as 1,098,000 is never mistaken for a leading-zero SKU.
const BARE_PRODUCT_CODE_RE = /(?:^|[^\p{L}\p{N}_٬,،])0\d{2,7}(?=$|[^\p{L}\p{N}_٬,،])/u
/** Codes that belong to authentication, coupons, contacts or order tracking. */
const NON_CATALOG_CODE_RE =
        /(?:رمز(?:\s*(?:ورود|عبور|یک\s*بار|یکبار))?|کد\s*(?:تأیید|تایید|ورود|تخفیف|کوپن|پیگیری|سفارش|مرسوله)|شماره\s*(?:موبایل|تماس|تلفن)?|otp|verification\s*code|password|discount\s*code|coupon\s*code|tracking\s*(?:code|number))/iu
const PRICE_VALUE_RE = /(?:قیمت|تومان|تومن|ریال|هزار|میلیون|price|irr|rial)/iu
/** Product ids inside [[product:{…}]] markers of an assistant reply. */
const MARKER_PRODUCT_ID_RE = /\[\[product:\s*\{[\s\S]*?"id"\s*:\s*"([^"]+)"/g

/**
 * Product-card ids an assistant history message showed the customer — from
 * markers still in its content, or from the history loader's side channel
 * (the model-facing history has its markers stripped).
 */
export function assistantCardIds(message: ChatMessage): string[] {
        return [...new Set([...extractMarkerProductIds(message.content ?? ''), ...historyCardIds(message)])]
}

export function extractMarkerProductIds(content: string): string[] {
        const ids: string[] = []
        MARKER_PRODUCT_ID_RE.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = MARKER_PRODUCT_ID_RE.exec(content)) !== null) {
                const id = match[1]?.trim().slice(0, 100)
                if (id && !ids.includes(id)) ids.push(id)
                if (ids.length >= MAX_SHOWCASE_PRODUCTS) break
        }
        return ids
}

export const PRODUCT_STOP_WORDS = new Set([
        'سلام', 'درود', 'لطفا', 'لطفاً', 'خواهشاً', 'میشه', 'می‌شه', 'میتونی', 'می‌تونی',
        // Copulas, thinking-aloud verbs and opinion adverbs leak into carried
        // search terms ("مدل نگار به نظرم خیلی ساده‌ست" once grounded ست-پذیرایی
        // rows because "ساده‌ست" tokenized into ساده + the enclitic ست).
        'است', 'بود', 'بودن', 'فکر', 'کنم', 'کنیم', 'نظر', 'نظرم', 'خیلی', 'بین', 'باشه',
        'کدوم', 'کدام', 'کدومش', 'کدامش', 'کدومتون', 'کدامتان',
        'بهتر', 'بهتره', 'بهتری', 'بدتر', 'ساده‌تر',
        'محصول', 'محصولات', 'کالا', 'کالاها', 'کاتالوگ', 'فروشگاه', 'قیمت', 'قیمتها', 'قیمت‌ها',
        'موجود', 'موجوده', 'موجودند', 'موجودن', 'موجودی', 'ناموجود', 'خرید', 'فروش', 'بفرست', 'بفرستید', 'بفرستین', 'ارسال',
        'نشون', 'نشان', 'نمایش', 'بده', 'بدین', 'بدهید', 'معرفی', 'پیشنهاد', 'لیست', 'فهرست',
        'گزینه', 'گزینه‌ها', 'مورد', 'عدد', 'هرچی', 'هرچه', 'همه', 'تمام', 'چند', 'چندتا',
        'چنده', 'چقدر',
        'دارم', 'داری', 'دارید', 'دارین', 'دارن', 'داریدش', 'دارینش', 'هست', 'هستش', 'هستند',
        'رو', 'را', 'از', 'به', 'برای', 'با', 'و', 'یا', 'که', 'تو', 'توی', 'این', 'اون', 'آن',
        'من', 'ما', 'شما', 'یه', 'یک', 'تا', 'بدون', 'هیچ', 'سوال', 'سؤالی', 'سوالی', 'اضافی', 'فعلا',
        'فعلاً', 'دیگه', 'دیگر', 'جدید', 'خوب', 'بهترین', 'هر', 'چی', 'هایی', 'های', 'ها',
        'میخوام', 'می‌خوام', 'میخواستم', 'می‌خواستم', 'میخواهم', 'می‌خواهم', 'میخواد', 'می‌خواد',
        'خوام', 'خواستم', 'خواهم', 'خواستیم', 'ببینم', 'ببین',
        'موجودتون', 'موجودتان', 'محصولاتتون', 'محصولاتتان', 'محصولامون', 'محصولاتون', 'مشخصات',
        // Identifier labels describe the following value; they are not useful
        // catalog terms on their own ("کد 0742" must search for 0742, not کد).
        'کد', 'شناسه', 'sku',
        'بفرستی', 'بفرستم', 'بفرستن', 'بفرستیم',
        'قبلی', 'قبل', 'بیخیال', 'فراموش', 'اطلاعات',
        // Price words are carried by the sort/budget arguments, never by a
        // product name («ارزون‌ترین میز تلویزیون» must search «میز تلویزیون»).
        // Words that also name products («زیر» in «کرم زیر چشم», «ترش», «کم»)
        // stay out of this list; catalog-tools drops them only inside a
        // price phrase.
        'ارزون', 'ارزان', 'ارزونتر', 'ارزانتر', 'ارزونترین', 'ارزانترین',
        'گرون', 'گران', 'گرونتر', 'گرانتر', 'گرونترین', 'گرانترین', 'ترین',
        'میلیون', 'میلیونی', 'تومن', 'تومان',
        // Shopping scaffolding and generic attribute labels should not outrank
        // the actual requested value («بابوس», «مشکی», «۴۸», ...).
        'دنبال', 'دنبالش', 'هستم', 'هستیم', 'گردم', 'میگردم', 'نیاز', 'لازم', 'قصد', 'تهیه',
        'راهنمایی', 'کمک', 'انتخاب', 'بدونم', 'بپرسم',
        'جنس', 'پارچه', 'متریال', 'رنگ', 'سایز', 'سایزبندی', 'اندازه', 'قد', 'قدکار', 'دورسینه',
        'دور', 'سینه', 'کمر', 'باسن', 'کار', 'مدل', 'طرح', 'مناسب', 'فری',
        'چیز', 'چیزی', 'چیا', 'چه', 'می', 'فروشید', 'فروشی', 'میفروشید', 'میفروشی', 'بفروشید',
        // Greetings must never become catalog search terms («سلام وقت بخیر»).
        'وقت', 'بخیر', 'صبح', 'عصر', 'شب', 'ظهر', 'خسته', 'نباشید', 'خداقوت',
        // Colloquial motion/request verbs are never product identity, yet they
        // routinely leak into search terms («میز عسلی اومدید؟» → «اومدید» became
        // a term, full-coverage grounding then found 0 rows and the bot replied
        // «not found» even though the item exists). Verbs are vertical-agnostic,
        // so this list is safe to keep static, unlike product nouns.
        'اومدید', 'اومده', 'اومدن', 'اومدی', 'اومدین', 'اومدیون', 'اومدی',
        'میاد', 'میای', 'میام', 'میره', 'میرید', 'میرین', 'میری', 'میرم',
        'رفتین', 'رفتی', 'رفتید', 'رفتم', 'بیاید', 'بیاین', 'بییام', 'بیا',
        'داشتین', 'داشتید', 'داشتن', 'میادش', 'اومدهست',
        'دیدین', 'دیدید', 'دیدی', 'گفتین', 'گفتید', 'گفتی',
        'میدید', 'میدین', 'میدی', 'میدیون', 'بدید', 'بدین', 'بده',
        // Generic availability/arrival phrasing that is conversational, not a term.
        'موجودن', 'موجودتون', 'موجودیتون', 'موجودی',
        'hi', 'hello', 'good', 'morning', 'evening',
        // Affirmatives/acknowledgements must never become catalog search terms.
        'آره', 'اره', 'بله', 'باشه', 'اوکی', 'اکی', 'حتما', 'حتماً', 'بفرما', 'بفرمایید', 'ممنون',
        // Polite imperative endings («معرفی کنید», «نشونم بده»).
        'کن', 'کنید', 'کنین', 'بدید', 'بدین', 'نشونم',
        'yes', 'sure', 'ok', 'okay', 'yeah',
        // Verb forms and plural/possessive fragments that are never product
        // identity («AK-85 چه رنگ‌هایی داره؟», «سایز ۱۲۰ هاش رو نشونم بده»,
        // «همون میزی که دفعه قبل پرسیدم»). As required terms they made the
        // fail-closed matcher reject the exact product.
        'داره', 'نداره', 'دارند', 'ندارید', 'ندارین', 'هستن', 'هستین', 'هستید', 'چیه',
        'هاش', 'هاشو', 'هاشون', 'هاشونو', 'هارو', 'هاتون', 'هامون',
        'همون', 'همین', 'همان', 'هنوز', 'دوباره', 'دفعه', 'پرسیدم', 'پرسیده', 'گفتم', 'گفته', 'بودم', 'راستی',
        'product', 'products', 'catalog', 'shop', 'store', 'price', 'prices', 'buy', 'send', 'show',
        'list', 'recommend', 'available', 'stock', 'in', 'have', 'all', 'any', 'please', 'me', 'the',
        'a', 'an', 'some', 'without', 'question', 'questions', 'new', 'more',
        'what', 'whats', "what's", 'you', 'your', 'do', 'does', 'sell', 'selling', 'got',
        'there', 'is', 'are', 'anything', 'something', 'for',
        'looking', 'searching', 'need', 'want', 'fabric', 'material', 'color', 'colour', 'size',
        'length', 'chest', 'waist', 'fit', 'made',
])

export function normalizePersianText(value: string): string {
        return value
                .normalize('NFKC')
                .replace(/ي/g, 'ی')
                .replace(/ك/g, 'ک')
                // A ZWNJ-attached «ست» is always the copula enclitic
                // ("ساده‌ست" = "is simple"), never the set noun that STARTS
                // product names such as «ست پذیرایی». Strip it before the
                // ZWNJ→space split, or it leaks into search terms and pulls
                // set-products into single-item comparisons.
                .replace(/\u200cست(?=\s|$|[.!?؟،؛:;,])/gu, '')
                .replace(/[\u200c\u200d]/g, ' ')
                .replace(PERSIAN_DIGIT_RE, persianDigitToLatin)
                .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
                .replace(/\s+/g, ' ')
                .trim()
}

/**
 * Tokenize catalog identity text (product names, categories, tags, SKUs)
 * into the SAME normalized token space extractProductTerms produces for
 * customer messages, so lexicon lookups and search terms line up exactly.
 * Persian plural suffixes are stripped generously (both base and singular
 * forms are emitted) because catalog names arrive in both shapes.
 */
export function tokenizeCatalogText(value: string): string[] {
        const tokens: string[] = []
        for (const token of normalizePersianText(value).toLocaleLowerCase('fa').split(/[^\p{L}\p{N}_-]+/u)) {
                const clean = token.trim().replace(/^-+|-+$/g, '')
                if (clean.length < 2) continue
                tokens.push(clean)
                if (clean.length > 4) {
                        const singular = clean.replace(/(?:هایی|های|ها)$/u, '')
                        if (singular.length >= 2 && singular !== clean) tokens.push(singular)
                }
        }
        return tokens
}

export function extractProductTerms(
        value: string,
        options?: {
                sizeNumbersAllowed?: boolean
                /**
                 * The text is the product words the understanding layer read out
                 * of the message, not the message itself: counts, budgets and
                 * phone numbers are already elsewhere, so a number of three
                 * digits or more left in it names the product («مدل ۴۳۱» for
                 * BCO431, «فیلیپس ۳۵۰»). Shorter numbers keep the rules above:
                 * «آیفون ۱۶» must not find «اسپری فیکس ۱۶ ساعته».
                 */
                productWordsOnly?: boolean
        },
): string[] {
        const normalized = normalizePersianText(value)
        // Plain counts ("۵ تا محصول") are not search terms, but measurements
        // and sizes are essential catalog evidence. Product identifiers also
        // commonly arrive as "کد 0742" or just "0742 موجوده؟". The latter is
        // only treated as a code when it looks identifier-like (a leading zero,
        // or at least three digits in an availability question), so ordinary
        // counts such as "۵ تا محصول" do not become catalog terms.
        const numericAttributeContext =
                /(?:سایز|اندازه|قد|دور\s*(?:سینه|کمر|باسن)|size|length|chest|waist)\s*[:：#-]?\s*\d/iu.test(normalized)
        const explicitProductCode = normalized.match(PRODUCT_CODE_RE)?.[1]?.toLocaleLowerCase('fa')
        const bareProductCode = BARE_PRODUCT_CODE_RE.test(normalized)
        const nonCatalogCode = NON_CATALOG_CODE_RE.test(normalized)
        const priceValue = PRICE_VALUE_RE.test(normalized)
        const availabilityQuestion = AVAILABLE_RE.test(normalized)
        const subjectSizedNumberContext = PRODUCT_SUBJECT_RE.test(normalized)
        const counterNouns = new Set([
                'تا', 'عدد', 'مورد', 'کالا', 'گزینه', 'دونه', 'product', 'products', 'item', 'items',
        ])
        const rawTokens = normalized
                .toLocaleLowerCase('fa')
                .split(/[^\p{L}\p{N}_-]+/u)
                .map((token) => token.trim().replace(/^-+|-+$/g, ''))
        const tokens = rawTokens
                .filter((token, index) => {
                        if (token.length < 2) return false
                        if (!/^\d+$/.test(token)) return true
                        if (numericAttributeContext) return true
                        if (explicitProductCode === token) return true
                        if (nonCatalogCode || priceValue) return false
                        if (bareProductCode && /^0\d{2,7}$/.test(token)) return true
                        if (availabilityQuestion && /^\d{3,8}$/.test(token)) return true
                        // «میز تلویزیون ۱۶۰» — a short size-like number attached to a
                        // named product subject is essential catalog evidence, while
                        // counts («۲ تا شلوار») stay presentation-only. A counter noun
                        // right after the number keeps it a plain count.
                        if (
                                subjectSizedNumberContext
                                && /^\d{2,4}$/.test(token)
                                && !counterNouns.has(rawTokens[index + 1] ?? '')
                        ) return true
                        // A comparative follow-up («فکر کنم ۱۹۰ بهتر باشه»)
                        // carries no subject noun of its own — the subject
                        // lives in the conversation history. When the caller
                        // proved that context, a bare size-like number is
                        // essential catalog evidence, not a count.
                        if (options?.sizeNumbersAllowed && /^\d{2,4}$/.test(token)) return true
                        if (
                                options?.productWordsOnly
                                && /^\d{3,8}$/.test(token)
                                && !counterNouns.has(rawTokens[index + 1] ?? '')
                        ) return true
                        return false
                })

        // A standalone «ست» (written with a SPACE, not the ZWNJ enclitic —
        // "ساده ست") is almost always the copula. It only names the SET
        // product family when it STARTS a compound (ست پذیرایی…) or follows a
        // determiner (یه ست…). Everything else — sentence-final or followed by
        // a verb/conjunction — is "is" and must never become a search term:
        // it once steered a نقش/نگار price comparison onto set-product rows.
        const SET_DETERMINERS = new Set(['یه', 'یک', 'هر', 'این', 'اون', 'همون', 'دو', 'سه', 'چهار', 'چند'])
        const COPULA_FOLLOWERS = new Set([
                'ولی', 'اما', 'و', 'چون', 'که', 'هم', 'دیگه', 'حالا', 'را', 'رو',
                'میخوام', 'می‌خوام', 'میخواستم', 'می‌خواستم', 'هست', 'است', 'بود',
                'دارم', 'داریم', 'دارید', 'دارین', 'بودن', 'شده', 'میشه', 'می‌شه',
        ])
        const terms: string[] = []
        for (const [tokenIndex, token] of tokens.entries()) {
                if (token === 'ست') {
                        const next = tokens[tokenIndex + 1] ?? ''
                        const prev = tokens[tokenIndex - 1] ?? ''
                        const startsSetCompound = next.length >= 3
                                && !COPULA_FOLLOWERS.has(next)
                                && !PRODUCT_STOP_WORDS.has(next)
                        const afterDeterminer = SET_DETERMINERS.has(prev)
                        if (!startsSetCompound && !afterDeterminer) continue
                }
                if (PRODUCT_STOP_WORDS.has(token)) continue
                if (isFirstPersonCityToken(token)) continue
                // Persian plural suffixes are often written without a ZWNJ.
                // Strip a colloquial possessive only when the base is a known
                // product/generic term. Blindly stripping «تون» corrupts «تابستون».
                // «دامنش که عکس گذاشتین موجوده» (its skirt) must search for «دامن»:
                // the bare possessive suffixes «ش»/«م» are stripped exactly like
                // تون/مون/شون, but only when the remaining base is itself a known
                // product noun or stopword, so real words are never corrupted
                // («ستون» never becomes «س»: the base check rejects it, and the
                // singular fallback drops 1-letter bases).
                const possessiveCandidate = token.length > 3
                        ? token.replace(/(?:تون|مون|شون|ش|م)$/u, '')
                        : token
                const withoutPossessive = possessiveCandidate !== token && (
                        PRODUCT_STOP_WORDS.has(possessiveCandidate) || PRODUCT_SUBJECT_RE.test(possessiveCandidate)
                )
                        ? possessiveCandidate
                        : token
                // «طرحات / رنگات» — the colloquial possessive plural
                // (طرح + ات) of variant nouns. The generic suffix stripper
                // below only knows های/ها; without this, «طرحات چیه» kept
                // "طرحات" as an opaque term instead of the variant noun.
                const colloquialVariantPlural = /^(?:طرح|رنگ|مدل|سایز|تنوع)ات$/u.test(withoutPossessive)
                        ? withoutPossessive.replace(/ات$/u, '')
                        : null
                const singular = colloquialVariantPlural
                        ?? (withoutPossessive.length > 4
                                ? withoutPossessive.replace(/(?:هایی|های|ها)$/u, '')
                                : withoutPossessive)
                const term = singular.length >= 2 ? singular : token
                if (!PRODUCT_STOP_WORDS.has(term) && !terms.includes(term)) terms.push(term)
                if (terms.length >= 6) break
        }
        return terms
}

/**
 * Return a catalog-grounded answer for facts represented by structured product
 * attributes. Structured fields are preferred over prose/history because they
 * come directly from the store's current product attributes and are far less
 * likely to contain stale model-authored claims.
 */
export function structuredProductDetailReply(params: {
        product: Pick<CatalogProduct, 'name' | 'attributes'>
        field: ProductRequestPlan['detailField']
        language: string
}): string | null {
        if (params.field !== 'MATERIAL') return null
        if (!params.product.attributes || typeof params.product.attributes !== 'object'
                || Array.isArray(params.product.attributes)) return null
        const materialKeys = new Set(['جنس', 'جنس پارچه', 'پارچه', 'material', 'fabric'])
        const entry = Object.entries(params.product.attributes as Record<string, unknown>)
                .find(([rawKey, rawValue]) => {
                        const key = normalizePersianText(rawKey).toLocaleLowerCase('fa')
                        return materialKeys.has(key) && (
                                typeof rawValue === 'string' || typeof rawValue === 'number'
                        )
                })
        const material = entry ? String(entry[1]).trim().slice(0, 120) : ''
        if (!material) return null
        if (params.language === 'en') {
                return `According to the catalog specifications, **${params.product.name}** is made from **${material}**.`
        }
        if (params.language === 'ar') {
                return `وفقًا لمواصفات الكتالوج، خامة **${params.product.name}** هي **${material}**.`
        }
        return `طبق مشخصات ثبت‌شدهٔ کاتالوگ، جنس پارچهٔ **${params.product.name}**، **${material}** است`
}

/**
 * Catalog subject noun(s) for the showcase introduction message. Only terms
 * that are themselves product nouns are named back to the customer: modifiers
 * such as «مجلسی» or brand words are dropped because the hybrid search ranks
 * by them but does not strictly filter on them, and the intro must stay true
 * for every card that follows. Terms come back normalized/lowercase, which is
 * fine for Persian (no letter case) and keeps English subjects readable.
 */
export function showcaseSubjectPhrase(plan: ProductRequestPlan): string {
        // The tenant's own catalog nouns («پاف», «مراکشی») name the family
        // just like global retail nouns do; the caller still drops the phrase
        // when the shown cards do not carry it.
        const corpus = new Set(plan.corpusSubjectTerms ?? [])
        const nouns = plan.searchTerms
                .filter((term) => !/^\d+$/u.test(term) && (PRODUCT_SUBJECT_RE.test(term) || corpus.has(term)))
                // Three words: «ریمل ضد آب» cut at two read «ریمل ضد».
                .slice(0, 3)
        // «پاف نیمکتی 120»: a size the customer asked for belongs in the intro,
        // so a narrowed vitrine does not read like the generic one before it.
        const size = nouns.length ? plan.searchTerms.find((term) => /^[1-9]\d{1,3}$/u.test(term)) : undefined
        return [...nouns, ...(size ? [size] : [])].join(' ').slice(0, 40)
}

/** The request already pinned a size, product code or single variant. */
export function isNarrowedProductRequest(plan: ProductRequestPlan): boolean {
        return plan.codeIdentified || plan.variantHint != null
                || plan.searchTerms.some((term) => /^\d{2,4}$/.test(term))
}

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
                if (priorShowcaseBoundary) {
                        return [...history.slice(0, index).filter(isConversationMemory), ...history.slice(index)]
                }
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
                if (found) {
                        // Same resume rule as the externalId branch below: a resolved
                        // thread reopens the moment the customer writes again, while a
                        // human handoff stays sticky until the operator resets it. The
                        // web widget used to keep showing a «closed» conversation badge
                        // over an actively ongoing chat.
                        if (found.status === 'RESOLVED' && !found.handedOff) {
                                await prisma.conversation
                                        .update({ where: { id: found.id }, data: { status: 'OPEN' } })
                                        .catch(() => {})
                        }
                        return {
                                id: found.id,
                                customerInfoState: found.customerInfoState,
                                status: found.status === 'RESOLVED' && !found.handedOff ? 'OPEN' : found.status,
                                handedOff: found.handedOff,
                        }
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
        // Private/internal attribute keys (underscore-prefixed, e.g. the
        // WooCommerce `_variations` rows with their own SKUs, prices, stock
        // counts and variation ids) must NOT participate in lexical term
        // matching: a bare product code such as "0706" coincidentally occurs
        // inside unrelated numbers there (variation sku "1420170070615"),
        // which once poisoned fullTermMatch and turned the exact single-code
        // variant vitrine into a consultation with irrelevant extra cards.
        // Public facet attributes (طرح/رنگ/سایز/…) stay searchable.
        // Variation OPTION values (رنگ: کرم، سایز: L، طرح: ۰۵) are searchable
        // too — only their SKUs/ids/prices stay out (attributeValueText).
        const facetAttributes = attributeValueText(product.attributes)
        return {
                name: normalizePersianText(product.name).toLocaleLowerCase('fa'),
                description: normalizePersianText(product.description ?? '').toLocaleLowerCase('fa'),
                sku: normalizePersianText(product.sku ?? '').toLocaleLowerCase('fa'),
                tags: normalizePersianText(product.tags.join(' ')).toLocaleLowerCase('fa'),
                attributes: normalizePersianText(facetAttributes).toLocaleLowerCase('fa'),
                category: normalizePersianText(product.category?.name ?? '').toLocaleLowerCase('fa'),
        }
}

/**
 * A variable product whose EVERY variation is sold out is not available,
 * even when its parent row stock is null («untracked»). Without this, a
 * showcase told the customer «موجودن» and then carded «ناموجود» variants.
 */
export function allVariationsSoldOut(attributes: unknown): boolean {
        const variations = extractTypedVariations(attributes)
        return variations.length > 0 && variations.every((variation) =>
                variation.manageStock ? (variation.stockQuantity ?? 0) <= 0 : variation.inStock === false)
}

/**
 * A number the customer gives for a model: «۴۳۱» for «BCO431», «۶۸۵» for
 * «EC685.B», «۲۷۱» for «MTM-271». It names a row when it stands in the text as
 * a whole number, with no digit before or after it. 'word' = it stands alone,
 * 'model' = letters are attached to it. Digits inside a longer number («0706»
 * in the SKU 1070611) are never a match.
 */
export function modelNumberIn(text: string, digits: string): 'word' | 'model' | null {
        const isDigit = (char: string | undefined) => char != null && char >= '0' && char <= '9'
        const isLetter = (char: string | undefined) => char != null && /\p{L}/u.test(char)
        let found: 'model' | null = null
        for (let at = text.indexOf(digits); at !== -1; at = text.indexOf(digits, at + 1)) {
                const before = text[at - 1]
                const after = text[at + digits.length]
                if (isDigit(before) || isDigit(after)) continue
                if (!isLetter(before) && !isLetter(after)) return 'word'
                found = 'model'
        }
        return found
}

/** Words of a name or category, in order. */
function catalogWords(text: string): string[] {
        return text.replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter(Boolean)
}

/** Every two or three neighbouring words written as one («اسپرسو ساز» → «اسپرسوساز»). */
function joinedNeighbours(words: string[]): Set<string> {
        const joined = new Set<string>()
        for (let start = 0; start < words.length - 1; start++) {
                joined.add(words[start] + words[start + 1])
                if (start < words.length - 2) joined.add(words[start] + words[start + 1] + words[start + 2])
        }
        return joined
}

/**
 * The same word written in two pieces, when the catalog itself uses both
 * pieces: one store lists «اسپرسوساز دلونگی EC685» next to «اسپرسو ساز دلونگی
 * BCO431», and a search for either spelling must reach both rows.
 */
function spacedSpellings(term: string, corpusTokens: ReadonlySet<string> | undefined): string[] {
        if (!corpusTokens?.size || term.length < 5 || /\d/.test(term)) return []
        const spellings: string[] = []
        for (let cut = 2; cut <= term.length - 2 && spellings.length < 2; cut++) {
                const head = term.slice(0, cut)
                const tail = term.slice(cut)
                if (corpusTokens.has(head) && corpusTokens.has(tail)) spellings.push(`${head} ${tail}`)
        }
        return spellings
}

/** Match measurements regardless of whether the source used 48, ۴۸ or ٤٨. */
function catalogTermVariants(term: string): string[] {
        if (!/\d/.test(term)) return [term]
        const variants = [
                term,
                term.replace(LATIN_DIGIT_RE, latinDigitToPersian),
                term.replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]),
        ]
        return [...new Set(variants)]
}

/**
 * Hybrid catalog retrieval. Semantic product IDs provide fuzzy recall, while
 * a deterministic DB lexical pass guarantees that broad category/name queries
 * (for example "all available shirts") can return every requested slot rather
 * than whichever few chunks happened to win vector search.
 *
 * `corpusTokens` (the agent's catalog lexicon) extends which terms count as
 * SUBJECT terms, so tenant-specific nouns ground the same way global ones do.
 */
export async function fetchCatalogProducts(
        agentId: string,
        productIds: string[],
        plan: ProductRequestPlan,
        corpusTokens?: ReadonlySet<string>,
        /**
         * Products the conversation already grounded in earlier turns (state
         * candidateEntityIds). Comparison consults family-lock both sides of
         * the pair to the family of these rows, so «کدومش ارزون‌تره؟» between
         * two جلومبلی models can never answer with TV-table or set prices.
         */
        priorCandidateIds: string[] = [],
): Promise<CatalogProduct[]> {
        if (!plan.isProductTurn) return []
        const primary = await searchCatalogProducts(agentId, productIds, plan, corpusTokens, priorCandidateIds)
        // «پاف مراکشی دارید؟» when every Moroccan pouf is sold out: an
        // availability-filtered search finds nothing (or only a relaxed
        // neighbour family) and the customer used to hear «در کاتالوگ پیدا
        // نکردم» about a product the store plainly sells. The exact rows
        // exist — they are just unavailable — so return them flagged, and
        // let the reply say «فعلاً ناموجوده» honestly instead.
        if (plan.inventoryMode !== 'AVAILABLE' || (primary.products.length && !primary.relaxed)) {
                return primary.products
        }
        const anyStock = await searchCatalogProducts(
                agentId,
                productIds,
                { ...plan, inventoryMode: 'ANY' },
                corpusTokens,
                priorCandidateIds,
        )
        // «کرم زیر چشم» when every eye cream is sold out: the in-stock search
        // keeps only «کرم» (foundations, hair creams), the any-stock search
        // keeps «کرم» + «چشم». The rows nearer to what the customer named win,
        // flagged sold out, over in-stock rows of another product family.
        if (anyStock.products.length && anyStock.relaxed && anyStock.keptTerms > primary.keptTerms) {
                return anyStock.products.map((product) => ({ ...product, unavailable: true }))
        }
        if (!anyStock.products.length || anyStock.relaxed) return primary.products
        return anyStock.products.map((product) => ({ ...product, unavailable: true }))
}

async function searchCatalogProducts(
        agentId: string,
        productIds: string[],
        plan: ProductRequestPlan,
        corpusTokens: ReadonlySet<string> | undefined,
        priorCandidateIds: string[],
): Promise<{ products: CatalogProduct[]; relaxed: boolean; keptTerms: number }> {

        const rankedIds = [...new Set(productIds)].slice(0, 40)
        const terms = plan.searchTerms.slice(0, 6)
        // Rows whose name writes a term in two pieces («اسپرسوساز» → «اسپرسو ساز»).
        const spacedNameFilters = (term: string): Prisma.ProductWhereInput[] =>
                spacedSpellings(term, corpusTokens).map((spelling) => ({
                        name: { contains: spelling, mode: 'insensitive' as const },
                }))
        const lexicalFilters: Prisma.ProductWhereInput[] = terms.flatMap((term) => [
                ...catalogTermVariants(term).flatMap((variant) => [
                        { name: { contains: variant, mode: 'insensitive' as const } },
                        { description: { contains: variant, mode: 'insensitive' as const } },
                        { sku: { contains: variant, mode: 'insensitive' as const } },
                        { tags: { has: variant } },
                        { category: { is: { name: { contains: variant, mode: 'insensitive' as const } } } },
                ]),
                ...spacedNameFilters(term),
        ])
        // The broadest term in a multi-term request can match hundreds of
        // rows (for example «پیراهن» in a fashion catalog). A fixed
        // candidate cap ordered by popularity can then discard the exact,
        // rarer name match («شراره») before in-memory ranking even
        // sees it. Fetch semantic IDs and non-subject identity terms in a
        // small priority lane, then merge them with the broad pool.
        const identityTerms = terms.filter((term) => !PRODUCT_SUBJECT_RE.test(term))
        const identityLexicalFilters: Prisma.ProductWhereInput[] = identityTerms.flatMap((term) => [
                ...catalogTermVariants(term).flatMap((variant) => [
                        { name: { contains: variant, mode: 'insensitive' as const } },
                        { description: { contains: variant, mode: 'insensitive' as const } },
                        { sku: { contains: variant, mode: 'insensitive' as const } },
                        { tags: { has: variant } },
                        { category: { is: { name: { contains: variant, mode: 'insensitive' as const } } } },
                ]),
                ...spacedNameFilters(term),
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
        const stockFilter: Prisma.ProductWhereInput = plan.inventoryMode === 'AVAILABLE'
                ? { OR: [{ stock: null }, { stock: { gt: 0 } }] }
                : plan.inventoryMode === 'OUT_OF_STOCK'
                        ? { stock: 0 }
                        : {}
        // Cheaper alternatives: the ceiling applies before ranking/slicing, or
        // ten popular rows at the same price would hide every cheaper option.
        const availabilityFilter: Prisma.ProductWhereInput = plan.cheaperThan
                ? { AND: [stockFilter, { price: { lt: plan.cheaperThan.price } }] }
                : stockFilter

        const rowSelect = {
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
        } satisfies Prisma.ProductSelect
        const baseWhere: Prisma.ProductWhereInput = {
                active: true,
                catalogItems: { some: { agentId } },
                AND: [availabilityFilter],
        }
        const priorityFilters: Prisma.ProductWhereInput[] = [
                ...(rankedIds.length ? [{ id: { in: rankedIds } }] : []),
                ...identityLexicalFilters,
        ]
        // Strict lane: rows carrying EVERY term. The popularity-ordered pools
        // below are capped, and common tokens («میز», «نقش») can fill them
        // before the one exact row («… آپادانا – سایز ۱۹۰») is ever ranked.
        const strictFilters: Prisma.ProductWhereInput[] = terms.length > 1
                ? terms.map((term) => ({
                        OR: [
                                ...catalogTermVariants(term).flatMap((variant) => [
                                        { name: { contains: variant, mode: 'insensitive' as const } },
                                        { sku: { contains: variant, mode: 'insensitive' as const } },
                                        { tags: { has: variant } },
                                        { category: { is: { name: { contains: variant, mode: 'insensitive' as const } } } },
                                ]),
                                ...spacedNameFilters(term),
                        ],
                }))
                : []
        // Attribute lane: rows whose colour/size/design lives only in the
        // attribute or variation values («مانتو کرم» → the cream مانتو).
        const attributeRowsPromise = (async () => {
                if (!terms.length) return []
                const [allTerms, anyTerm] = await Promise.all([
                        terms.length > 1 ? attributeLaneIds({ agentId, terms, mode: 'all', limit: 40 }) : Promise.resolve([] as string[]),
                        identityTerms.length ? attributeLaneIds({ agentId, terms: identityTerms, mode: 'any', limit: 40 }) : Promise.resolve([] as string[]),
                ])
                const ids = [...new Set([...allTerms, ...anyTerm])]
                if (!ids.length) return []
                return prisma.product.findMany({
                        where: { ...baseWhere, AND: [availabilityFilter, { id: { in: ids } }] },
                        take: 80,
                        orderBy: [{ queryCount: 'desc' }, { updatedAt: 'desc' }],
                        select: rowSelect,
                })
        })().catch(() => [])
        const [strictRows, priorityRows, broadRows, attributeRows] = await Promise.all([
                strictFilters.length
                        ? prisma.product.findMany({
                                where: { ...baseWhere, AND: [availabilityFilter, ...strictFilters] },
                                take: 40,
                                orderBy: [{ queryCount: 'desc' }, { updatedAt: 'desc' }],
                                select: rowSelect,
                        })
                        : Promise.resolve([]),
                priorityFilters.length
                        ? prisma.product.findMany({
                                where: { ...baseWhere, AND: [availabilityFilter, { OR: priorityFilters }] },
                                take: 80,
                                orderBy: [{ queryCount: 'desc' }, { updatedAt: 'desc' }],
                                select: rowSelect,
                        })
                        : Promise.resolve([]),
                prisma.product.findMany({
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
                select: rowSelect,
        }),
                attributeRowsPromise,
        ])
        const seenProductIds = new Set<string>()
        const rows = [...strictRows, ...(attributeRows ?? []), ...priorityRows, ...broadRows].filter((product) => {
                if (seenProductIds.has(product.id)) return false
                seenProductIds.add(product.id)
                if (plan.inventoryMode === 'AVAILABLE' && allVariationsSoldOut(product.attributes)) return false
                return true
        })

        const semanticRank = new Map(rankedIds.map((id, index) => [id, index]))
        const phrase = terms.join(' ')
        // A code-carrying query («تونیک روناز ۰۷۸۸») that is fully covered by
        // one row has *identified* that exact catalog item: every search term
        // (including the code) is part of the row. The presentation layer
        // attaches that row's product card even on consultation turns.
        const identifyByFullCoverage = plan.codeIdentified && terms.length > 0
        // Subject terms: global retail nouns PLUS the tenant's own catalog
        // vocabulary, so «پاف» grounds exactly like «شلوار» on the tenant that
        // actually sells پاف. Without this, corpus-named products could be
        // presented without full-term grounding.
        const subjectTerms = terms.filter((term) =>
                PRODUCT_SUBJECT_RE.test(term) || (corpusTokens?.has(term) ?? false),
        )
        const canonicalTokenMatch = (field: string, term: string): boolean => {
                const spaced = (value: string) => value.replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim()
                // The term gets the same separator folding as the field: a
                // hyphenated code «ak-71» must match the name token «AK-71».
                return ` ${spaced(field)} `.includes(` ${spaced(term)} `)
        }
        // «اسپرسو» + «ساز» in the request is the «اسپرسوساز» of a row's name.
        const joinedTerms = terms.map((term, index) => /^\d+$/.test(term) ? [] : [
                terms[index - 1] && !/^\d+$/.test(terms[index - 1]) ? terms[index - 1] + term : '',
                terms[index + 1] && !/^\d+$/.test(terms[index + 1]) ? term + terms[index + 1] : '',
        ].filter(Boolean))
        const ranked = rows.map((product) => {
                const searchable = searchableProductText(product)
                const identityWords = [catalogWords(searchable.name), catalogWords(searchable.category)]
                const writtenApart = new Set(identityWords.flatMap((words) => [...joinedNeighbours(words)]))
                const writtenTogether = new Set(identityWords.flat())
                // One word here, two there: the request and the row spell the
                // same compound differently.
                const sameCompound = (termIndex: number) =>
                        writtenApart.has(terms[termIndex])
                        || joinedTerms[termIndex].some((joined) => writtenTogether.has(joined))
                let coverage = 0
                let subjectCoverage = 0
                let score = 0
                // Per-term match bookkeeping for the adaptive subset retry.
                const matchedTerms: boolean[] = terms.map(() => false)
                const subjectMatchedTerms: boolean[] = terms.map(() => false)

                terms.forEach((term, termIndex) => {
                        let matched = false
                        // Identifier-like terms (a bare product code such as
                        // "0706") may only identify a row through its NAME
                        // token or its SKU SUFFIX. Shop SKUs are prefix+code
                        // («143» + «0706» = 1430706), so a free substring test
                        // once let unrelated rows win fullTermMatch merely
                        // because their SKUs CONTAINED the digits (1070611
                        // contains «0706») and the exact single-code variant
                        // vitrine silently degraded into a consultation.
                        const digitTerm = /^\d{3,8}$/.test(term)
                        if (digitTerm) {
                                // «۴۳۱» is the model «BCO431»: the number of a
                                // model name counts whether or not letters are
                                // attached to it, never as a slice of a longer
                                // number.
                                const inName = modelNumberIn(searchable.name, term)
                                if (inName) {
                                        score += inName === 'word' ? 40 : 36
                                        matched = true
                                }
                                if (searchable.sku === term || searchable.sku.endsWith(term)) {
                                        score += 45
                                        matched = true
                                }
                                // A code mentioned in prose is weak ranking
                                // evidence only — it never counts as coverage,
                                // because mentioning ≠ being that product.
                                if (searchable.description.includes(term)) score += 4
                        } else {
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
                                if (!searchable.name.includes(term) && sameCompound(termIndex)) {
                                        score += 40
                                        matched = true
                                }
                        }
                        const isSubjectTerm = subjectTerms.includes(term)
                        if (
                                isSubjectTerm &&
                                (canonicalTokenMatch(searchable.name, term) || canonicalTokenMatch(searchable.category, term) || sameCompound(termIndex))
                        ) {
                                subjectCoverage += 1
                                subjectMatchedTerms[termIndex] = true
                        }
                        if (matched) {
                                coverage += 1
                                matchedTerms[termIndex] = true
                        }
                })

                if (phrase && searchable.name.includes(phrase)) score += 60
                const vectorRank = semanticRank.get(product.id)
                if (vectorRank != null) score += Math.max(4, 36 - vectorRank * 1.5)
                if (product.stock == null || product.stock > 0) score += 5
                score += Math.min(3, Math.log2(product.queryCount + 1))

                return { product, coverage, subjectCoverage, score, matchedTerms, subjectMatchedTerms }
        })

        ranked.sort((left, right) => {
                if (terms.length && right.coverage !== left.coverage) return right.coverage - left.coverage
                if (right.score !== left.score) return right.score - left.score
                return right.product.updatedAt.getTime() - left.product.updatedAt.getTime()
        })

        // ─── Comparison consult grounding ────────────────────────────────────
        // «کدومش ارزون‌تره؟» compares the two models the customer has been
        // discussing (searchTerms carried both sides). A single term-set can
        // only ground ONE side — or worse, rows whose design name contains
        // both terms («طرح نقش جهان») — which is how the model once claimed
        // both sides share one price. Instead: bucket rows per subject term
        // against the MODEL name (product name minus the «طرح …» design
        // tail) so design tokens never masquerade as model subjects, then
        // pick an ANCHOR side (the one the conversation already grounded) and
        // mirror every other side by the anchor's family tokens — an
        // apples-to-apples same-family pair whose prices can honestly be
        // compared. fullTermMatch stays false — consult, never identification.
        if (plan.comparisonConsult && subjectTerms.length >= 2) {
                const priorIdSet = new Set(priorCandidateIds)
                const modelName = (name: string) => {
                        const cut = name.search(/(?:^|\s)طرح\s+\S/u)
                        return cut === -1 ? name : name.slice(0, cut)
                }
                const modelTokens = (name: string) =>
                        modelName(name)
                                .replace(/[^\p{L}\p{N}]+/gu, ' ')
                                .split(/\s+/u)
                                .filter((token) => token.length > 1)
                const nonSubjectTokens = (name: string) => new Set(
                        modelTokens(name).filter((token) => !subjectTerms.includes(token)),
                )
                const overlapCount = (name: string, reference: Set<string>) => {
                        let overlap = 0
                        for (const token of nonSubjectTokens(name)) if (reference.has(token)) overlap += 1
                        return overlap
                }
                const recalled = (item: (typeof ranked)[number]) =>
                        semanticRank.has(item.product.id) || priorIdSet.has(item.product.id)
                // Bundles/sets («ست پذیرایی … (مجموعه سه عددی)») are a distinct
                // product type: when comparing two MODELS, the single-item rows
                // are the primary comparison and set rows stay secondary —
                // «کدومش ارزون‌تره؟» must quote جلومبلی singles, not set prices.
                const isSetRow = (name: string) => {
                        const tokens = modelTokens(name)
                        return tokens.includes('ست') || tokens.includes('مجموعه') || tokens.includes('پکیج')
                }
                const rankBy = (bucket: (typeof ranked)[number][], reference: Set<string> | null) =>
                        [...bucket].sort((left, right) => {
                                const recallDelta = Number(recalled(right)) - Number(recalled(left))
                                if (recallDelta !== 0) return recallDelta
                                const setDelta = Number(isSetRow(left.product.name)) - Number(isSetRow(right.product.name))
                                if (setDelta !== 0) return setDelta
                                if (reference) {
                                        const familyDelta = overlapCount(right.product.name, reference) - overlapCount(left.product.name, reference)
                                        if (familyDelta !== 0) return familyDelta
                                }
                                return right.score - left.score
                        })
                const buckets = new Map<string, (typeof ranked)[number][]>()
                for (const term of subjectTerms.slice(0, 4)) {
                        const bucket = ranked.filter((item) => modelTokens(item.product.name).includes(term))
                        if (bucket.length) buckets.set(term, bucket)
                }
                if (buckets.size >= 2) {
                        // 1) Anchor side: the subject whose bucket holds the strongest
                        // recalled/known row — the side the conversation grounded first.
                        let anchorTerm: string | null = null
                        let anchorBest: (typeof ranked)[number] | null = null
                        for (const [term, bucket] of buckets) {
                                const best = rankBy(bucket, null)[0]
                                if (!anchorBest || (recalled(best) && !recalled(anchorBest))) {
                                        anchorTerm = term
                                        anchorBest = best
                                }
                        }
                        if (anchorTerm && anchorBest) {
                                const picked: (typeof ranked)[number][] = [anchorBest]
                                // 2) Mirror sides: rows of every OTHER subject that share
                                // the anchor's family tokens (same میز/جلومبلی/آکام/چوب
                                // head nouns) — the honest comparison counterpart.
                                let mirror: (typeof ranked)[number] | null = null
                                for (const [term, bucket] of buckets) {
                                        if (term === anchorTerm) continue
                                        const anchorFamily = nonSubjectTokens(anchorBest.product.name)
                                        const rankedBucket = rankBy(bucket, anchorFamily)
                                        if (rankedBucket[0]) {
                                                if (!mirror) mirror = rankedBucket[0]
                                                picked.push(rankedBucket[0])
                                        }
                                        if (rankedBucket[1]) picked.push(rankedBucket[1])
                                }
                                // 3) One more anchor-side row, family-locked to the mirror.
                                if (mirror) {
                                        const mirrorFamily = nonSubjectTokens(mirror.product.name)
                                        const anchorExtra = rankBy(buckets.get(anchorTerm) ?? [], mirrorFamily)
                                                .find((item) => item !== anchorBest)
                                        if (anchorExtra) picked.push(anchorExtra)
                                }
                                const seenIds = new Set<string>()
                                const comparisonRows = picked.filter((item) => {
                                        if (seenIds.has(item.product.id)) return false
                                        seenIds.add(item.product.id)
                                        return true
                                }).slice(0, 4)
                                if (comparisonRows.length >= 2) {
                                        return { relaxed: false, keptTerms: terms.length, products: comparisonRows.map(({ product }) => ({
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
                                                fullTermMatch: false,
                                        })) }
                                }
                        }
                }
                // No pair grounded: fall through to the ordinary fail-closed path.
        }

        // Concrete product searches fail closed. Semantic neighbours remain
        // useful for open-ended needs («یه چیز خنک»), but they must never be
        // presented as the requested catalog item. Every requested subject
        // noun must occur in the canonical name/category and every modifier
        // must be evidenced by the same row. This prevents a set whose long
        // description mentions trousers from becoming «شلوار پلنگی».
        const requiresGroundedMatch = terms.length > 0 && (
                plan.explicitShowcase || plan.codeIdentified || subjectTerms.length > 0
        )
        const eligible = requiresGroundedMatch
                ? ranked.filter((item) =>
                        item.coverage === terms.length &&
                        item.subjectCoverage === subjectTerms.length,
                )
                : ranked
        // ─── Adaptive subset retry ──────────────────────────────────────────────
        // A grounded search that found NOTHING while a lexical/semantic
        // candidate pool exists is usually conversational noise attached to a
        // real product request («پاف بالشتی برای هدیه می‌خوام» — «هدیه» matches
        // OTHER products' descriptions but not the پاف بالشتی rows; «رومیزی میز
        // غذاخوری» — «میز» is context, not a second subject). The fix is a
        // best-consistent-subset search: find the LARGEST subset of the
        // requested terms that at least one candidate row covers COMPLETELY
        // (with canonical subject matching for subject terms). Rows covering
        // that subset are honest near-matches — presented as a consult, never
        // as the exact item (fullTermMatch stays fail-closed on the ORIGINAL
        // term set), so cards/links/prices can never claim a dropped attribute.
        // Subsets without any subject/corpus anchor are rejected, so a lone
        // description word can never stand in for the requested product.
        let relaxedRows: typeof ranked | null = null
        let keptTerms = terms.length
        if (requiresGroundedMatch && eligible.length === 0 && ranked.length > 0 && terms.length > 1) {
                const subjectCount = (subset: number[]) =>
                        subset.filter((i) => subjectTerms.includes(terms[i])).length
                const corpusCount = (subset: number[]) =>
                        subset.filter((i) => corpusTokens?.has(terms[i])).length
                // A model number or code the customer gave («۴۳۱», «۰۷۸۸») names
                // a row as surely as a catalog word does: «بی سی او ۴۳۱» keeps
                // the «BCO431» row although nothing else of it is spelled alike.
                const numberCount = (subset: number[]) =>
                        subset.filter((i) => /^\d{3,8}$/.test(terms[i])).length
                const rowCoversSubset = (item: (typeof ranked)[number], subset: number[]) =>
                        subset.every((i) => item.matchedTerms[i]) &&
                        subset.every((i) => !subjectTerms.includes(terms[i]) || item.subjectMatchedTerms[i])
                const headIndex = terms.findIndex((term) => !/^\d+$/.test(term))
                const headUnknown = headIndex >= 0
                        && !(corpusTokens?.has(terms[headIndex]) ?? false)
                        && !ranked.some((item) => item.matchedTerms[headIndex])
                const anchorTokens = new Map<string, Set<string>>()
                const rowIsAnchoredBy = (item: (typeof ranked)[number], subset: number[]) => {
                        let anchors = anchorTokens.get(item.product.id)
                        if (!anchors) {
                                anchors = new Set([
                                        ...tokenizeCatalogText(item.product.name).filter((token) => !PRODUCT_STOP_WORDS.has(token)).slice(0, 3),
                                        ...tokenizeCatalogText(item.product.category?.name ?? ''),
                                ])
                                anchorTokens.set(item.product.id, anchors)
                        }
                        return subset.some((i) => anchors!.has(terms[i]))
                }
                function keyComparison(a: number[], b: number[]): number {
                        for (let i = 0; i < Math.max(a.length, b.length); i++) {
                                const av = a[i] ?? 0
                                const bv = b[i] ?? 0
                                if (av !== bv) return av - bv
                        }
                        return 0
                }
                // Pick the covering subset that keeps the strongest anchors:
                // subject terms first, then a model number (a typed code
                // comes before the subject), then corpus terms, then the
                // best row evidence (row
                // score already blends name-match weight, vector rank and
                // popularity), then sheer subset size. This keeps semantic
                // recall pointing at the RIGHT product family («رومیزی میز
                // غذاخوری» must answer with رومیزی rows, not dining sets that
                // merely mention میز+غذاخوری in their category/description).
                let bestSubset: { rows: typeof ranked; key: number[]; size: number } | null = null
                const total = 1 << terms.length
                for (let mask = 1; mask < total - 1; mask++) {
                        const subset: number[] = []
                        for (let i = 0; i < terms.length; i++) if (mask & (1 << i)) subset.push(i)
                        if (subjectCount(subset) === 0 && corpusCount(subset) === 0 && numberCount(subset) === 0) continue
                        // The customer named something this catalog does not
                        // carry at all («آیفون ۱۶ پرو» in a cosmetics store):
                        // rows that only share a trailing word with the request
                        // («… ایر فلو پرو») are not near matches, and the reply
                        // once read «۲ مدل پرو موجود داریم». With the head of
                        // the request unknown, the kept words must name what the
                        // row IS: its category or the start of its name
                        // («میبلین رژ لب» still relaxes to the رژ لب rows).
                        const covering = ranked.filter((item) => rowCoversSubset(item, subset) && (!headUnknown || rowIsAnchoredBy(item, subset)))
                        if (covering.length === 0) continue
                        // Semantic endorsement: relaxation is only honest when
                        // the turn's own recall evidence (vector chunks / the
                        // lexical catalog reference) points at the rows we are
                        // about to keep. Without it, dropping a real catalog
                        // attribute («شلوار پلنگی» → showing plain شلوار rows)
                        // would present a variant the customer never asked for.
                        // A model number found in the row's own name is that
                        // evidence already.
                        if (rankedIds.length > 0 && numberCount(subset) === 0 && !covering.some((item) => semanticRank.has(item.product.id))) continue
                        // A number the reader took for a product code leads:
                        // «۶۸۵ مشکی» is the EC685 rows, not whatever is black.
                        const key = [
                                ...(plan.codeIdentified
                                        ? [numberCount(subset), subjectCount(subset)]
                                        : [subjectCount(subset), numberCount(subset)]),
                                corpusCount(subset),
                                Math.max(...covering.map((item) => item.score)),
                                subset.length,
                        ]
                        if (!bestSubset || keyComparison(key, bestSubset.key) > 0) {
                                bestSubset = { rows: covering, key, size: subset.length }
                        }
                }
                if (bestSubset) {
                        relaxedRows = bestSubset.rows
                        keptTerms = bestSubset.size
                }
        }
        const relaxed = relaxedRows != null
        const finalEligible = relaxedRows ?? eligible
        const selected = finalEligible.slice(0, Math.min(MAX_SHOWCASE_PRODUCTS, plan.requestedCount))
        // A unique, fully grounded multi-term match identifies the exact row
        // even without a SKU. Price/size/link follow-ups can therefore attach
        // its canonical card and URL, while broad one-word category searches
        // remain ordinary multi-product browsing. A relaxed (adaptive) match
        // NEVER counts as unique identification — some requested term was
        // dropped, so the row is a close alternative, not the named item.
        // Uniqueness is a property of the whole grounded result, never of the
        // requested slice: «قیمتش؟» asks for one row, and picking the most
        // popular of 24 «میز تلویزیون نقش ۱۶۰» designs must not be presented
        // as the exact product the customer meant.
        const uniquelyIdentified = !relaxed && finalEligible.length === 1 && terms.length > 1

        return { relaxed, keptTerms, products: selected.map(({ product, coverage, subjectCoverage }) => ({
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
                fullTermMatch: !relaxed &&
                        coverage === terms.length &&
                        subjectCoverage === subjectTerms.length &&
                        (identifyByFullCoverage || uniquelyIdentified),
                ...(relaxed ? { nearMatch: true } : {}),
        })) }
}

/**
 * Load exact assigned catalog rows by id (active, agent-scoped) as trusted
 * catalog products — used to anchor a singular follow-up («قیمتش؟») to the
 * one product card the agent just showed.
 */
export async function fetchCatalogProductsByIds(agentId: string, ids: string[]): Promise<CatalogProduct[]> {
        const parentIds = [...new Set(ids.map((id) => id.split('#')[0]).filter(Boolean))].slice(0, 10)
        if (!parentIds.length) return []
        const rows = await prisma.product.findMany({
                where: { id: { in: parentIds }, active: true, catalogItems: { some: { agentId } } },
                select: {
                        id: true, name: true, description: true, price: true, stock: true, images: true,
                        externalUrl: true, attributes: true, tags: true, category: { select: { name: true } },
                },
        })
        const byId = new Map(rows.map((row) => [row.id, row]))
        return parentIds.flatMap((id) => {
                const product = byId.get(id)
                if (!product) return []
                return [{
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
                        fullTermMatch: true,
                }]
        })
}

/**
 * Deterministic family-level variant enumeration («طرحات چیه؟»).
 *
 * When the customer asks which designs a product FAMILY comes in, the answer
 * must be COMPLETE: every active catalog row matching the family's anchor
 * terms (family nouns + size), not a summary of whichever rows won vector
 * search — «طرحات میز تلویزیون ۱۹۰ چیه؟» once listed four designs (three of
 * the wrong size, one borrowed from a knowledge doc) although eleven rows
 * exist. Rows whose names carry no «طرح …» pattern, or which carry internal
 * `_variations` (a single variable product), return null so the existing
 * variant-vitrine / consult flow stays in charge.
 */
export async function buildFamilyEnumerationReply(params: {
        workspaceId: string
        agentId: string
        lang: 'fa' | 'en' | 'ar'
        searchTerms: string[]
        corpusTokens?: ReadonlySet<string>
}): Promise<string | null> {
        const familyTerms = params.searchTerms
                .map((term) => term.trim())
                .filter((term) => term.length >= 2 && (
                        PRODUCT_SUBJECT_RE.test(term)
                        || /^\d{2,4}$/.test(term)
                        || (params.corpusTokens?.has(term) ?? false)
                ))
                .slice(0, 4)
        if (familyTerms.length === 0) return null
        const rows = await prisma.product.findMany({
                where: {
                        active: true,
                        catalogItems: { some: { agentId: params.agentId } },
                        AND: familyTerms.map((term) => ({
                                OR: catalogTermVariants(term).map((variant) => ({
                                        name: { contains: variant, mode: 'insensitive' as const },
                                })),
                        })),
                },
                select: { name: true, price: true, stock: true, attributes: true },
                orderBy: [{ queryCount: 'desc' }, { updatedAt: 'desc' }],
                take: 80,
        })
        if (rows.length < 2) return null
        // Note: rows may still carry internal `_variations` — in catalogs like
        // آکام چوب those are the WOOD-COLOR dimension while the designs live in
        // the sibling rows' names («طرح ایوان», «طرح سلین», …). A single
        // variation-bearing product (designs inside one row) yields <2 rows or
        // <2 name-level designs and falls through to its own variant vitrine.
        // Distinct design values from the family rows' names («طرح ایوان –
        // سایز ۱۹۰» → «ایوان»). Boundary words never join the captured value.
        const DESIGN_NAME_RE =
                /(?:^|\s)طرح\s+([\p{L}\p{N}]+(?:\s+(?!سایز|اندازه|کد|مدل|رنگ|مجموعه|عددی|تومن|تومان)[\p{L}\p{N}]+)?)/gu
        const designs: string[] = []
        const seenDesigns = new Set<string>()
        const prices: number[] = []
        for (const row of rows) {
                DESIGN_NAME_RE.lastIndex = 0
                const match = DESIGN_NAME_RE.exec(row.name)
                const design = match?.[1]?.trim()
                if (design && !seenDesigns.has(design)) {
                        seenDesigns.add(design)
                        designs.push(design)
                }
                if (typeof row.price === 'number' && row.price > 0) prices.push(row.price)
        }
        if (designs.length < 2) return null
        // Shared wood/color options, when the family rows carry them.
        const colors = new Set<string>()
        const decodeKey = (key: string) => {
                try { return decodeURIComponent(key) } catch { return key }
        }
        for (const row of rows) {
                const attrs = row.attributes as Record<string, unknown> | null
                if (!attrs || typeof attrs !== 'object') continue
                for (const [key, value] of Object.entries(attrs)) {
                        if (key === '_variations' || !decodeKey(key).includes('رنگ')) continue
                        const values = Array.isArray(value) ? value : [value]
                        for (const item of values) {
                                if (typeof item !== 'string' || !item.trim()) continue
                                // WooCommerce option lists arrive both as arrays and as one
                                // comma-joined string («افرا, بلوط, گردویی»).
                                for (const part of item.split(/[،,]/u)) {
                                        const color = part.trim()
                                        if (color) colors.add(color)
                                }
                        }
                }
        }
        const subjectPhrase = [
                ...familyTerms.filter((term) => !/^\d{2,4}$/.test(term)),
                ...familyTerms.filter((term) => /^\d{2,4}$/.test(term)).map((term) => `سایز ${term}`),
        ].join(' ')
        const formatToman = (price: number) =>
                price.toLocaleString('en-US')
                        .replace(LATIN_DIGIT_RE, latinDigitToPersian)
                        .replace(/,/g, '\u066C')
        const distinctPrices = [...new Set(prices)]
        const priceLine = distinctPrices.length === 1
                ? `قیمت هر کدوم ${formatToman(distinctPrices[0])} تومان است`
                : distinctPrices.length > 1
                        ? `قیمت‌ها از ${formatToman(Math.min(...distinctPrices))} تا ${formatToman(Math.max(...distinctPrices))} تومان متغیر است`
                        : ''
        const colorLine = colors.size >= 2
                ? ` و در رنگ‌های ${[...colors].join('، ')} قابل سفارش`
                : ''
        if (params.lang === 'en') {
                const designList = designs.join(', ')
                const enPrice = distinctPrices.length === 1
                        ? `each priced at ${distinctPrices[0].toLocaleString('en-US')} toman`
                        : distinctPrices.length > 1
                                ? `prices range from ${Math.min(...distinctPrices).toLocaleString('en-US')} to ${Math.max(...distinctPrices).toLocaleString('en-US')} toman`
                                : ''
                return `Available designs for ${subjectPhrase}: ${designList} (${designs.length} designs)${enPrice ? `, ${enPrice}` : ''}. Which design would you like?`
        }
        return `طرح‌های موجود ${subjectPhrase}: ${designs.join('، ')} (${designs.length} طرح). ${priceLine}${colorLine}. کدام طرح را می‌پسندید؟`
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
                select: { name: true, description: true, durationMinutes: true, location: true, price: true },
        })
}
