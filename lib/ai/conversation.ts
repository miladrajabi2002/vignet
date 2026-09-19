import { prisma } from '@/lib/prisma'
import type { ChannelType } from '@prisma/client'
import type { ChatMessage } from '@/lib/ai/openrouter'
import type { CatalogProduct } from '@/lib/ai/rag'
import type { CatalogService } from '@/lib/ai/rag'
import type { StartChatParams } from '@/lib/ai/chat-types'
import type { Prisma } from '@prisma/client'
import { isConversationMemory } from '@/lib/ai/conversation-memory'

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

const PRODUCT_INTENT_RE =
        new RegExp(`(?:${PRODUCT_NOUNS}|قیمت|موجود|خرید|product|catalog|price|buy|shop|in\\s*stock|available)`, 'i')
export const PRODUCT_SUBJECT_RE =
        new RegExp(`(?:${PRODUCT_NOUNS}|product|catalog|shop)`, 'i')
// Used only to decide whether a history-dependent follow-up explicitly names a
// fresh product. Unlike PRODUCT_SUBJECT_RE, boundaries keep «کیف» from matching
// inside the attribute «کیفیتشون».
const EXPLICIT_PRODUCT_SUBJECT_RE = new RegExp(
        `(?:^|[^\\p{L}\\p{N}_])(?:${PRODUCT_NOUNS}|product|catalog|shop)(?=$|[^\\p{L}\\p{N}_])`,
        'iu',
)
/**
 * Natural shopping language often contains no catalog noun at all:
 * «دنبال جنس بابوس هستم», «یه چیز خنک می‌خوام», or "looking for linen".
 * This is deliberately separate from PRODUCT_INTENT_RE so policy, order and
 * service exclusions below can still win before catalog retrieval starts.
 */
const SHOPPING_NEED_RE =
        /(?:دنبال(?:ش|شون|شان)?|می\s*(?:خوام|خواهم|گردم|پسندم)|نیاز\s*(?:دارم|داریم|داره|هست)|لازم\s*(?:دارم|داریم|داره)|قصد\s*(?:خرید|تهیه)|می\s*(?:خرم|خریم)|looking\s+for|searching\s+for|i\s+(?:need|want)|need\s+something|want\s+something)/iu
/** Attribute-only messages are common replies to product ads and DMs. */
const PRODUCT_ATTRIBUTE_RE =
        /(?:(?:جنس(?:\s+کار)?|پارچه|متریال|رنگ|سایز(?:بندی)?|اندازه|قد(?:\s*کار)?|دور\s*(?:سینه|کمر|باسن)|فری\s*سایز|برند|مدل|طرح)|(?<![a-z])(?:fabric|material|colou?r|size|length|chest|waist|fit)(?![a-z]))\s*[:：-]?\s*[\p{L}\p{N}]/iu
/** Obvious non-shopping needs must not pull arbitrary semantic product hits.
 *  «لینک» belongs here: link/payment requests («لینک پرداخت رو بفرست»)
 *  are follow-ups about the product under discussion, never a fresh catalog
 *  browse — without this gate SHOWCASE_COMMAND_RE's «ارسال» + prior product
 *  terms fired the deterministic vitrine with random «related» items. */
const NON_PRODUCT_NEED_RE =
        /(?:پشتیبانی|اپراتور|آدرس|نشانی|شماره\s*(?:تماس|تلفن|موبایل|کارت)|کارت\s*به\s*کارت|استخدام|شغل|همکاری|نمایندگی|کسی|شخص|پیج|اینستاگرام|ورود|حساب|رمز|خطا|مشکل\s*(?:فنی|سیستم)|لینک|support|operator|address|phone|job|career|person|login|account|password|payment\s+link)/iu
const GENERIC_HELP_RE = /(?:راهنمایی|کمک|guidance|help)/iu
const INFORMATION_SEEKING_RE =
        /(?:می\s*خوام\s*(?:بدونم|بپرسم)|می\s*خواستم\s*بدونم|سوال\s*دارم|i\s+want\s+to\s+(?:know|ask))/iu
/** Imperative "send/show/list" — the customer commands a showcase. */
const SHOWCASE_COMMAND_RE =
        /(?:بفرست|ارسال|نشون|نشان|نمایش|لیست|فهرست|معرفی|پیشنهاد|گزینه|هرچی|هرچه|send|show|list|recommend)/i
/** Interrogative browsing — "what do you have / sell?" without a command. */
const BROWSE_QUERY_RE =
        /(?:^|[^\p{L}])(?:چی\s*(?:دار|موجود|هست|می\s*فروش)|چیا\s*(?:دار|موجود)|چه\s*(?:محصول|کالا|جنس|چیز|مدل)|محصولات(?:تون|تان|تو)?\s*چی(?=$|[^\p{L}]))|what\s+do\s+you\s+(?:have|sell)|what(?:'s|\s+is)\s+available/iu
// The leading (?:^|[^\p{L}]) keeps «چی» a standalone word: without it,
// «ساعت مچی دارین؟» matched «چی دار» inside «مچی دارین» and was misrouted
// from a product vitrin to a generic browse turn.
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
        /(?:بی\s*خیال|فراموش\s*(?:کن|کنید|کنین)|از\s*اول\s*(?:شروع|بپرس)|درخواست\s*جدید|موضوع\s*جدید|never\s*mind|forget\s+(?:it|that|the\s+previous)|start\s*over|new\s*(?:request|topic))/i
const PRODUCT_CONTEXT_FOLLOWUP_RE =
        /(?:کدومش|کدامش|کدوم‌ش|کدام‌ش|این\s*(?:دو|دوتا|مدل|محصول|کالا|قطعه|یکی)|اون\s*(?:یکی|دوتا|مدل|محصول|کالا|قطعه)?|آن\s*(?:یکی|دوتا|مدل|محصول|کالا)?|همین|همون|همان|قبلی|اولی|دومی|هر\s*دو|جفتشون|جفتشان|(?:قیمت|کیفیت|جنس|رنگ|سایز|مزیت|عیب|مدل)ش(?:ون|ان)?|ارزون\s*تر|ارزان\s*تر|گرون\s*تر|گران\s*تر|بهتر(?:ه|\s+است|\s*باشه|\s*بشه)|لینک(?:\s*(?:پرداخت|خرید|سفارش))?(?:ش|شو|اش)?|پرداخت(?:ش|شو)?\s*(?:رو|را)|which\s+one|these\s+two|the\s+other|same\s+one|previous\s+one|both\s+of\s+them|cheaper|better\s+quality|this\s+(?:model|item|product)|the\s+link|payment\s+link)/iu
/**
 * Comparative-choice questions ("کدومش ارزون‌تره؟", "بین نقش و نگار کدوم
 * بهتره؟"). The pair being compared lives in recent user messages — including
 * "بین X و Y" statements that carry no shopping verb at all and therefore
 * never qualified as product context for the term-carry loop.
 */
const COMPARISON_QUESTION_RE =
        /(?:کدوم(?:ش|م|ون|ن)?|کدام(?:ش|م|ن)?)[^\n]{0,40}(?:ارزون|ارزان|گران|گرون|بهتر|مناسب|فرق)|(?:ارزون|ارزان|گران|گرون)\s*تر|فرقش(?:ون)?|مقایسه|(?:کدوم|کدام)\s*(?:ارزون|ارزان|گران|گرون|بهتر)/iu
/** "بین X و Y" / "از X یا Y" statements name both sides of a comparison. */
const COMPARISON_PAIR_RE = /(?:بین|از)\s+[\p{L}\p{N}]+\s*(?:[\p{L}\p{N}]+\s*)?و\s+[\p{L}\p{N}]+/iu
/**
 * First-person possession of an item the customer ALREADY owns ("مبل کرم
 * دارم" — "دارم", not the store-facing "دارید") combined with an advice
 * request ("چه طرحی پیشنهاد میدی؟") is decor consultation. The store does not
 * sell the customer's own sofa; routing it to catalog search can only ever
 * produce "چیزی پیدا نکردم".
 */
const POSSESSION_RE = /(?:^|[^\p{L}\p{N}_])دار(?:م|یم)(?=$|[^\p{L}\p{N}_])/iu
const ADVICE_REQUEST_RE =
        /(?:پیشنهاد(?:ی|هایی)?\s*(?:میدی|می\s*دی|بدی|بده|دارید|دارین|چیه|ای|هست)|(?:چه|کدام|کدوم)\s*(?:طرح|رنگ|مدل|سبک|گزینه)(?:ی)?\s*(?:بهتره|مناسب(?:تر)?|پیشنهاد|میدی|می\s*دی|باید|بگیرم)|کمک(?:م)?\s*(?:می\s*)?کن|راهنمای(?:یم)?\s*(?:می\s*)?کن|مشاوره(?:ی)?\s*(?:میدی|می\s*دی|بده|می\s*خوام)|recommend|suggest)/iu
/** Any buying/lookup intent keeps the turn on the product path. */
const BUY_INTENT_RE =
        /(?:قیمت|چنده|چقدر|موجود|ناموجود|می\s*خوام|میخوام|بخرم|بخریم|سفارش|لینک|عکس|بفرست|نشون|سایز|اندازه|تعداد|دارین|دارید|هستین)/iu
/**
 * Lead-time / fulfilment-duration questions ("آماده‌سازی و ارسالش چقدر طول
 * می‌کشه؟") are shipping-policy knowledge — even mid-order, when the message
 * also carries the city and the payment method the operator asked for. A
 * product goal must never turn this answer into a catalog search.
 */
const LEAD_TIME_QUESTION_RE =
        /(?:آ?ماده\s*سازی|زمان\s*(?:آماده|ارسال|تحویل|تولید|سفارش)|چقدر\s*طول|طول\s*(?:می\s*)?کشه|میکشه|چند\s*(?:روز|هفته|ماه)|کی\s*(?:میره|می\s*ره|میرسه|می\s*رسه|تحویل)|lead\s*time|how\s+long|delivery\s+time)/iu
/**
 * Anaphoric references that need a product referent ("این مدل …؟"). When no
 * product was ever identified in the conversation, the turn is a
 * clarification ask, never a random catalog hit.
 */
export const UNRESOLVED_ANAPHORA_RE =
        /(?:^|[\s،,])(?:این|اون|آن|همین|همون)\s*(?:مدل|محصول|کالا|قطعه|یکی|دوتا|دو\s*تا)|(?:^|[\s،,])(?:مدل|محصول|کالا|قطعه)(?:ش|شون|مون)(?=$|[\s،,.؟?])/iu
// A singular detail question points back to the product already under
// discussion. Keep common colloquial spellings too: customers routinely type
// «پارچش» for «پارچه‌اش», and treating that typo as a fresh
// catalog keyword can surface a semantically similar but unrelated item.
const SINGULAR_PRODUCT_DETAIL_FOLLOWUP_RE =
        /(?:پارچش|پارچه\s*(?:ا)?ش|(?:قیمت|کیفیت|جنس|رنگ|سایز|مدل)\s*(?:ا)?ش(?!ون|ان)|(?:از\s+)?چه\s+(?:نوع\s+)?پارچه\s*ای)/iu
const MATERIAL_DETAIL_FOLLOWUP_RE =
        /(?:پارچش|پارچه\s*(?:ا)?ش|جنس\s*(?:ا)?ش(?!ون|ان)|(?:از\s+)?چه\s+(?:نوع\s+)?پارچه\s*ای)/iu
const OUT_OF_STOCK_RE = /(?:ناموجود|تمام\s*شده|اتمام\s*موجودی|out\s+of\s+stock|sold\s+out)/i
// Match Persian «دارید/دارین/داری…» as a complete token. The previous loose
// substring also matched the negated «نداری» in sentences such as «اگر اطلاعات
// قطعی نداری حدس نزن» and, combined with the word «ارسال», misrouted shipping
// policy questions into the deterministic product-showcase fallback.
const AVAILABLE_RE = /(?:موجود|(?:^|[^\p{L}\p{N}_])دار(?:ی|ید|ین|یم|ن)(?:ش)?(?=$|[^\p{L}\p{N}_])|in\s+stock|available|have)/iu
const ORDER_ONLY_RE = /(?:سفارش|پیگیری|رهگیری|مرسوله|ارسال\s*سفارش|order|tracking|shipment)/i
// Shipping/payment/warranty questions belong to policy knowledge, not the
// product showcase planner. In particular «ارسال رایگان دارید؟» previously
// combined SHOWCASE_COMMAND_RE's «ارسال» with AVAILABLE_RE's «دارید» and
// returned the deterministic "catalog disabled" reply instead of answering
// the customer's policy question.
const BUSINESS_POLICY_RE =
        /(?:ارسال\s*رایگان|هزینه\s*ارسال|شرایط\s*ارسال|محدوده\s*ارسال|شهر(?:های)?\s*تحت\s*پوشش|زمان\s*تحویل|گارانتی|ضمانت|مرجوعی|بازگشت\s*وجه|روش\s*پرداخت|پرداخت\s*قسط|فاکتور|ساعت\s*کاری|free\s*shipping|shipping\s*(?:cost|policy|coverage)|delivery\s*time|warranty|returns?\s*policy|refund|payment\s*method|invoice|business\s*hours)/i
/**
 * Unambiguous business-policy phrases that must stay policy answers even when
 * the same sentence names a product («هزینه ارسال کتاب چقدره؟», «ارسال رایگان
 * برای کفش دارین؟»). The weak BUSINESS_POLICY_RE above yields whenever a
 * product subject noun is present, which stayed safe while the noun list was
 * fashion-only — now that PRODUCT_NOUNS covers every store vertical, these
 * phrases need their own strong signal.
 */
const STRONG_BUSINESS_POLICY_RE =
        /(?:ارسال\s*رایگان|پست\s*رایگان|هزینه\s*(?:ارسال|پست|باربری|پیک)|باربری)/iu
// ─── Courier / shipping-method questions are business policy, never a product
// showcase. «فروشگاه قبول می‌کنه با اسنپ هم ارسال کنه؟» previously matched
// SHOWCASE_COMMAND_RE («ارسال») + PRODUCT_INTENT_RE («فروشگاه»), produced an
// explicit showcase and dumped a 10-card catalog. A strong shipping signal
// must win even when the same sentence names the shop or a garment, so these
// are kept separate from BUSINESS_POLICY_RE (whose policyOnly guard yields
// whenever a product subject noun is present).
const UNAMBIGUOUS_CARRIER_RE = /(?:اسنپ|تی\s*پاکس|چاپار|باربری)/iu
const CARRIER_WORD_RE = /(?:اسنپ|تی\s*پاکس|پست|پیک|چاپار|باربری)/iu
const SEND_VERB_RE = /(?:ارسال|بفرست|می\s*فرست|میفرست|تحویل|برسون)/iu
// «ماشین» only counts together with a send verb ("با ماشین برام ارسال کنن").
const SHIPPING_METHOD_RE =
        /(?:نحوه|روش|شرایط|محدوده)\s*ارسال|چطور\s*(?:می\s*)?ارسال|چجوری\s*(?:می\s*)?ارسال|(?:با|از)\s*(?:اسنپ|تی\s*پاکس|پست|پیک|ماشین|باربری|چاپار)[^.!؟?\n]{0,40}(?:ارسال|بفرست|می\s*فرست|میفرست)|(?:ارسال|بفرست|می\s*فرست|میفرست)[^.!؟?\n]{0,40}(?:با|از)\s*(?:اسنپ|تی\s*پاکس|پست|پیک|ماشین|باربری|چاپار)/iu
/** Objects that make a send-verb a showcase demand rather than a shipping one. */
const SHOWCASE_OBJECT_RE =
        /(?:کاتالوگ|لیست|فهرست|عکس|تصاویر|تصویر|قیمت[ها]?|مدل[ها]?|گزینه[ها]?|محصولات|product|catalog|photo|image|price|list)/i
/**
 * «[چیز] رو بفرست» with no carrier word in sight. For an order/merchandise
 * object («سفارشم رو بفرست») this is a fulfilment request and stays policy;
 * for a product subject or code («تونیک روناز ۰۷۸۸ رو بفرست», «کفش رو
 * بفرست») the same words are a showcase demand — the customer wants to SEE
 * the item they just named. The guard inside isShippingPolicyQuestion tells
 * the two apart.
 */
const BARE_SEND_OBJECT_RE =
        /(?<!همه)(?<!تا)(?<!های)(?:^|\s)(?:رو|را)\s+(?:هم\s+)?(?:ارسال|بفرست|می\s*فرست|میفرست)/iu
/**
 * Interrogative shipping verbs («ارسال میکنید؟», «می‌فرستین؟») ask whether the
 * store ships at all — a fulfilment/policy question even when the object is a
 * product («قسط‌ها تموم شد، لباس رو ارسال میکنید؟»). Only the imperative forms
 * («بفرست», «ارسال کن») stay potential showcase demands, because there the
 * customer commands the agent to show/send a named item («کفش رو بفرست»).
 */
const INTERROGATIVE_SHIP_RE =
        /(?:ارسال\s*می|می\s*(?:کنی[دن]?|فرستی[دن]?)|do\s+you\s+(?:ship|send)|are\s+you\s+(?:shipping|sending))/iu
/**
 * A courier or shipping-method question that must be answered from business
 * policy knowledge instead of triggering catalog retrieval/showcase. Bare
 * «پست» (an Instagram post) only counts together with a send verb, so
 * «پستتون قشنگ بود» keeps its normal non-policy handling.
 */
function isShippingPolicyQuestion(normalized: string): boolean {
        if (UNAMBIGUOUS_CARRIER_RE.test(normalized)) return true
        if (CARRIER_WORD_RE.test(normalized) && SEND_VERB_RE.test(normalized)) return true
        if (SHIPPING_METHOD_RE.test(normalized) && !SHOWCASE_OBJECT_RE.test(normalized)) return true
        // «X رو بفرست» is only a fulfilment/policy request when X is NOT a product
        // the customer just named: a product subject noun or an identifier-like
        // code turns the same words into a showcase demand instead — but an
        // interrogative verb («لباس رو ارسال میکنید؟») asks about fulfilment
        // regardless of the object, so it always stays policy.
        return BARE_SEND_OBJECT_RE.test(normalized)
                && !SHOWCASE_OBJECT_RE.test(normalized)
                && !PRODUCT_CODE_RE.test(normalized)
                && !BARE_PRODUCT_CODE_RE.test(normalized)
                && (INTERROGATIVE_SHIP_RE.test(normalized) || !PRODUCT_SUBJECT_RE.test(normalized))
}
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

// ─── Variant browse: «کاتالوگ طرح‌های دیگشو میفرستی» ──────────────────────────
// A pluralized variant noun (طرح‌ها / رنگ‌ها / تنوع‌ها…) plus a browse cue means
// the customer wants to SEE the variety of the product already under
// discussion — not a fresh catalog search (which used to return random
// products because «طرح» alone matches every variation-bearing row). The
// singular «طرح 05» stays a consultation: it names ONE variant, it does not
// ask to browse them. «مدل» is intentionally excluded — «مدل‌های دیگه» usually
// means OTHER products, not other variants of this one. «سایز» is excluded
// because sizes answer in prose; a size vitrine would show identical photos.
const VARIANT_PLURAL_RE = /(?:طرح|تنوع|رنگ\s*بندی|رنگبندی|رنگ)\s*(?:ها(?:ی|یی|م|ش|تون|مون|شون)?|ات|اش|اتو)/iu
const VARIANT_BROWSE_CUE_RE =
        /(?:دیگه|دیگر|دیگش|بقیه|همه|کاتالوگ|عکس|عکسا|لیست|فهرست|بفرست|می\s*فرست|میفرست|ببینم|نشون|نشان|نمایش|بده|دارین|دارید|ندارین|ندارید|چیه|چی\s*هست|موجود(?:ه|ین)?|هست(?:ن)?|داره|are\s+there|available)/iu
const VARIANT_PLURAL_EN_RE = /\b(?:designs|colors|colours|variants|variations|patterns)\b/iu
const VARIANT_BROWSE_CUE_EN_RE =
        /(?:other|more|all|rest|show|send|list|catalog|photos|see|view)/iu
/** Product ids inside [[product:{…}]] markers of an assistant reply. */
const MARKER_PRODUCT_ID_RE = /\[\[product:\s*\{[\s\S]*?"id"\s*:\s*"([^"]+)"/g

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

// ─── Singular variant reference: «0788 طرح 05» / «رنگ کرم» / «مدل 05» ───────
const VARIANT_HINT_NOUNS = new Set([
        'طرح', 'رنگ', 'تنوع', 'سایز', 'اندازه', 'مدل',
        'design', 'color', 'colour', 'variant', 'size',
])
/** Tokens that may sit between the noun and its value («طرح شماره ۵»). */
const VARIANT_HINT_FILLERS = new Set(['شماره', 'number', 'no'])

function extractVariantHint(normalized: string): string | null {
        const tokens = normalized
                .toLocaleLowerCase('fa')
                .split(/[^\p{L}\p{N}]+/u)
                .filter(Boolean)
        for (let index = 0; index < tokens.length - 1; index += 1) {
                if (!VARIANT_HINT_NOUNS.has(tokens[index])) continue
                let valueIndex = index + 1
                // «طرح شماره ۵» — skip the filler, take what follows it.
                while (valueIndex < tokens.length && VARIANT_HINT_FILLERS.has(tokens[valueIndex])) valueIndex += 1
                const value = tokens[valueIndex]
                if (!value || value.length < 1 || value.length > 24) continue
                // «طرح‌ها / رنگ‌های …» are browse turns, not a singular pick — the
                // plural suffixes themselves must never become the hint value.
                if (/^(?:های|هایی|ها|هام|هاش|هاتون|هامون|هاشون|دیگه|دیگر|بقیه|همه|موجود|نداریم|ندارین|دارین|دارید|چیه|چی)$/u.test(value)) continue
                return value
        }
        return null
}

export const PRODUCT_STOP_WORDS = new Set([
        'سلام', 'درود', 'لطفا', 'لطفاً', 'خواهشاً', 'میشه', 'می‌شه', 'میتونی', 'می‌تونی',
        // Copulas, thinking-aloud verbs and opinion adverbs leak into carried
        // search terms ("مدل نگار به نظرم خیلی ساده‌ست" once grounded ست-پذیرایی
        // rows because "ساده‌ست" tokenized into ساده + the enclitic ست).
        'است', 'بود', 'بودن', 'فکر', 'کنم', 'کنیم', 'نظر', 'نظرم', 'خیلی', 'بین', 'باشه',
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
                .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
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

/** Alias kept for callers that prefer the identity-text wording. */
export { tokenizeCatalogText as tokenizeCatalogIdentityText }

export function extractProductTerms(
        value: string,
        options?: { sizeNumbersAllowed?: boolean },
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
                        return false
                })

        const terms: string[] = []
        for (const token of tokens) {
                if (PRODUCT_STOP_WORDS.has(token)) continue
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

// ─── Vitrin: a bare product phrase is a showcase demand ─────────────────────
// «شومیز», «کیف دوشی دارین؟», «سارافون مجلسی» name the thing the customer
// wants to SEE. They must produce the vitrin — up to MAX_SHOWCASE_PRODUCTS
// available product cards on every channel — instead of a five-row prose
// consultation that mentions products the customer cannot tap or view.
// Question-shaped, priced, counted, coded, attribute and policy/order turns
// stay on the richer consultation path.
const VITRIN_EXCLUDE_RE =
        /(?:چند|چنده|چندتا|چرا|کجا|کجاست|چطور|چجوری|ایا|آیا|کدوم|کدام|قیمت|تومن|تومان|ریال|سفارش|پیگیری|رهگیری|مرسوله|ارسال|باربری|اسنپ|تی\s*پاکس|چاپار|گارانتی|ضمانت|مرجوع|تعویض|بازگشت|قسط|اقساط|فاکتور|تخفیف|هدیه|پرداخت|می\s*خواستم|برای|مناسب|خریدم|خریده|دوست|قشنگ|خوشگل|زشت|دیدم|دیدید|گرفتم|موند|مونده|تموم|رسید|اومد|برگشت|برگردون|گم|شکست|پاره|اندازه|جنس|پارچه|سایزبندی|میشه|می\s*تونم|میتونین|می\s*تونین|ممنون|مرسی|تشکر|عالی|راهنمایی|کمک|مشکل|سوال|سؤال|نظر|فرستادم|گذاشتین|موجودیت|باقی|تمام|شده|price|cost|order|shipping|deliver|refund|return|track|when|why|suitable\s+for)/iu
/** Trailing availability tail of a bare vitrin phrase («شومیز دارین؟»). */
const VITRIN_TRAILING_RE =
        /\s*(?:دار(?:ی|ید|ین|ن)|موجود(?:ه|ین|ید|ن)?|هست(?:ین|ید)?)[\s؟?!.،,]*$/iu

function isBareVitrinPhrase(normalized: string, terms: string[]): boolean {
        if (!terms.length) return false
        if (VITRIN_EXCLUDE_RE.test(normalized)) return false
        // Counts, prices, sizes and product codes are consultations/lookups.
        if (/[\p{N}]/u.test(normalized)) return false
        const stripped = normalized
                .replace(/[\s؟?!.،,]+$/u, '')
                .replace(VITRIN_TRAILING_RE, '')
                .replace(/[\s؟?!.،,]+$/u, '')
                .trim()
        // A sentence-like message (multiple clauses) is never a bare phrase.
        if (/[.!؟?\n]/.test(stripped)) return false
        const tokens = stripped
                .toLocaleLowerCase('fa')
                .split(/[^\p{L}\p{N}_-]+/u)
                .map((token) => token.trim())
                .filter((token) => token.length >= 2 && !PRODUCT_STOP_WORDS.has(token))
        // «شومیز», «کیف دوشی», «سارافون مجلسی» — at most two content words; a
        // longer description («پیراهن وارداتی شنل رنگ صورتی») is a consultation.
        if (!tokens.length || tokens.length > 2) return false
        // The phrase itself must name a real product subject — a single noun
        // («شومیز») or a catalog compound («ساعت مچی», «لپ تاپ», «ست صبحانه»).
        // A bare modifier («قرمز دارین؟») or a non-noun token («سایزم رو فراموش
        // کردی؟») must never trigger a showcase, so plain term membership is not
        // enough here: terms are merely non-stopword tokens.
        return PRODUCT_SUBJECT_RE.test(stripped)
}

/**
 * Build a deterministic product-search plan from the current message. When a
 * follow-up only says "send five", the closest earlier user product terms are
 * carried forward; assistant claims are never used as search input.
 */
export function planProductRequest(
        message: string,
        history: ChatMessage[],
        /**
         * Optional catalog lexicon of the CURRENT agent (identity tokens of
         * its assigned products — see lib/ai/catalog-lexicon.ts). Makes intent
         * detection data-driven: any term the tenant's own catalog names is
         * product-intent evidence, covering new verticals with zero code change.
         */
        corpusTokens?: ReadonlySet<string>,
): ProductRequestPlan {
        const normalized = normalizePersianText(message)
        const resetRequested = RESET_CONTEXT_RE.test(normalized)
        const orderOnly = ORDER_ONLY_RE.test(normalized)
        let priorProductTerms: string[] = []
        let priorVariantHint: string | null = null
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
                        const previousAttributeSignal = PRODUCT_ATTRIBUTE_RE.test(previousContent)
                        const previousProductCodeSignal =
                                PRODUCT_CODE_RE.test(previousContent) || BARE_PRODUCT_CODE_RE.test(previousContent)
                        const previousNonCatalogCode =
                                NON_CATALOG_CODE_RE.test(previousContent) && !PRODUCT_SUBJECT_RE.test(previousContent)
                        let previousTerms = extractProductTerms(previousContent)
                        if (previousTerms.length === 0 && PRODUCT_CONTEXT_FOLLOWUP_RE.test(previousContent)) {
                                // A bare follow-up («فکر کنم ۱۹۰ بهتر باشه»)
                                // owns only a size number; keep it so later
                                // turns inherit the NEW size, not the old one.
                                previousTerms = extractProductTerms(previousContent, { sizeNumbersAllowed: true })
                        }
                        const previousShoppingNeed =
                                SHOPPING_NEED_RE.test(previousContent) &&
                                (!NON_PRODUCT_NEED_RE.test(previousContent) || previousProductKeyword || previousAttributeSignal) &&
                                (!INFORMATION_SEEKING_RE.test(previousContent) || previousProductKeyword || previousAttributeSignal) &&
                                (!GENERIC_HELP_RE.test(previousContent) || previousTerms.length > 0 || previousProductKeyword || previousAttributeSignal)
                        const previousIsNonProduct =
                                ORDER_ONLY_RE.test(previousContent) ||
                                previousNonCatalogCode ||
                                (SERVICE_ONLY_RE.test(previousContent) && !PRODUCT_SUBJECT_RE.test(previousContent))
                        if (previousIsNonProduct) continue
                        const previousHasProductSignal =
                                previousProductKeyword ||
                                previousProductCodeSignal ||
                                AVAILABLE_RE.test(previousContent) ||
                                BROWSE_QUERY_RE.test(previousContent) ||
                                previousAttributeSignal ||
                                previousShoppingNeed ||
                                // A follow-up or a "بین X و Y" comparison statement
                                // is product context even without a shopping verb:
                                // "فکر کنم ۱۹۰ بهتر باشه" and "بین نقش و نگار کدوم
                                // برای من بهتره؟" must carry their terms forward —
                                // they were skipped here, which is how comparison
                                // questions lost one side of the pair.
                                PRODUCT_CONTEXT_FOLLOWUP_RE.test(previousContent) ||
                                COMPARISON_PAIR_RE.test(previousContent)
                        if (!previousHasProductSignal) continue
                        priorProductSignal = true
                        priorProductTerms = previousTerms
                        priorVariantHint = extractVariantHint(previousContent)
                        if (priorProductTerms.length) break
                }
        }

        // A comparative/possessive follow-up has no subject noun of its own:
        // when the carried context proves a product subject, bare size-like
        // numbers in THIS message («فکر کنم ۱۹۰ بهتر باشه») must survive term
        // extraction — they are the customer moving to another size of the
        // SAME family, and dropping them grounded the old size forever.
        const currentTerms = extractProductTerms(normalized, {
                sizeNumbersAllowed: priorProductTerms.some((term) =>
                        PRODUCT_SUBJECT_RE.test(term) || (corpusTokens?.has(term) ?? false)),
        })
        // ── Corpus-derived product intent ──────────────────────────────
        // A term that the agent's own catalog carries in its identity fields
        // (name/category/tags/SKU) proves this turn is about that tenant's
        // products even when the global PRODUCT_NOUNS list has never heard of
        // the vertical («پاف مراکشی اومده؟», «قابلمه ضدخش دارین؟»).
        const corpusSubjectTerms = corpusTokens
                ? currentTerms.filter((term) => corpusTokens.has(term))
                : []
        const corpusSubjectSignal = corpusSubjectTerms.length > 0
        // A strong courier/shipping signal overrides the generic product-subject
        // guard: «فروشگاه با اسنپ هم ارسال می‌کنه؟» must stay a policy question.
        // Lead-time questions ("آماده‌سازی و ارسالش چقدر طول می‌کشه؟") are strong
        // policy too: even mid-order, when the message carries the city and
        // payment method the operator just asked for, catalog grounding would
        // only ever fail closed and destroy the order context.
        const policyOnly = isShippingPolicyQuestion(normalized)
                || STRONG_BUSINESS_POLICY_RE.test(normalized)
                || LEAD_TIME_QUESTION_RE.test(normalized)
                || (BUSINESS_POLICY_RE.test(normalized) && !PRODUCT_SUBJECT_RE.test(normalized) && !corpusSubjectSignal)
        // Decor advice on the customer's OWN furniture ("مبل کرم دارم، چه طرحی
        // پیشنهاد میدی؟") is a knowledge-base consultation, not a catalog
        // search: the store doesn't sell the customer's own sofa.
        const advisoryConsult = POSSESSION_RE.test(normalized)
                && ADVICE_REQUEST_RE.test(normalized)
                && !BUY_INTENT_RE.test(normalized)
        const showcaseCommand = SHOWCASE_COMMAND_RE.test(normalized)
        const browseQuery = BROWSE_QUERY_RE.test(normalized)
        const productKeywordSignal = PRODUCT_INTENT_RE.test(normalized)
        const attributeSignal = PRODUCT_ATTRIBUTE_RE.test(normalized)
        const nonCatalogCode = NON_CATALOG_CODE_RE.test(normalized) && !PRODUCT_SUBJECT_RE.test(normalized)
        const productCodeSignal = !nonCatalogCode && (
                PRODUCT_CODE_RE.test(normalized) || BARE_PRODUCT_CODE_RE.test(normalized)
        )
        const shoppingNeedSignal =
                SHOPPING_NEED_RE.test(normalized) &&
                (!NON_PRODUCT_NEED_RE.test(normalized) || productKeywordSignal || attributeSignal) &&
                (!INFORMATION_SEEKING_RE.test(normalized) || productKeywordSignal || attributeSignal) &&
                (!GENERIC_HELP_RE.test(normalized) || currentTerms.length > 0 || productKeywordSignal || attributeSignal)
        // Availability verbs such as «دارید» are useful for named-product
        // queries, but are not product intent when the user explicitly asks
        // about services, appointments or bookings. A corpus hit overrides the
        // service guard when the sentence names one of the tenant's products.
        const serviceOnly = SERVICE_ONLY_RE.test(normalized) && !PRODUCT_SUBJECT_RE.test(normalized) && !corpusSubjectSignal
        // «شماره تماس فروشگاه چیه؟» / «پشتیبانی آنلاین دارین؟» name the shop or
        // an availability verb but are non-shopping needs: the NON_PRODUCT gate
        // keeps them out of catalog retrieval. Product codes stay above the gate
        // because a real SKU is unambiguous catalog evidence.
        const nonProductNeed = NON_PRODUCT_NEED_RE.test(normalized)
        const directProductSignal = !policyOnly && !nonCatalogCode && !advisoryConsult && (
                productCodeSignal ||
                (!nonProductNeed && (
                        productKeywordSignal ||
                        corpusSubjectSignal ||
                        (!serviceOnly && (AVAILABLE_RE.test(normalized) || shoppingNeedSignal || attributeSignal))
                ))
        )

        // A bare "yes / show me" is only a showcase acceptance when the agent
        // itself just offered to show products — a bare "بله" answering "shall I
        // register your order?" must never dump a product list.
        const lastAssistant = [...history].reverse().find((item) => item.role === 'assistant')
        const assistantOfferedShowcase =
                !!lastAssistant && ASSISTANT_OFFER_RE.test(normalizePersianText(lastAssistant.content ?? ''))
        const affirmativeFollowUp =
                AFFIRMATIVE_SHOW_RE.test(normalized.trim()) && priorProductSignal && assistantOfferedShowcase

        // A generic verb such as "send/show/list" is not enough by itself:
        // "send this message" and "show my orders" must never become a catalog
        // showcase. A product/commercial cue or a recent product context is
        // required; the latter supports follow-ups such as "send five" and
        // "show all" right after a browse question. A non-shopping need in the
        // CURRENT message («شماره کارت بفرست», «شماره تماس رو بفرست») stays a
        // non-product turn even when product terms sit in the history — the
        // customer is asking for contact/payment details, not for cards.
        const showcaseFromContext =
                showcaseCommand && !nonProductNeed &&
                (priorProductTerms.length > 0 || (priorProductSignal && currentTerms.length === 0))
        // ─── Variant routing (must precede vitrinPhrase so a variant pick of
        // the discussed product is never mistaken for a catalog-wide browse).
        // Pluralized variant noun + browse cue = the customer wants the variety
        // of the product under discussion. Order/policy/service/reset turns keep
        // their own routing; a non-catalog code context can't be a variant target.
        const variantBrowse = !orderOnly && !serviceOnly && !policyOnly && !resetRequested && !nonCatalogCode && (
                (VARIANT_PLURAL_RE.test(normalized) && VARIANT_BROWSE_CUE_RE.test(normalized)) ||
                (VARIANT_PLURAL_EN_RE.test(normalized) && VARIANT_BROWSE_CUE_EN_RE.test(normalized))
        )
        const variantHint = variantBrowse ? null : extractVariantHint(normalized)
        // Most-recent-first references to the product the variants belong to.
        // Chronology wins: the closest earlier reference — an assistant product
        // card (marker ids) or the customer naming a code — is the target, so a
        // «طرح‌هاشو بفرست» after a text-only consult on «0788» still finds 0788.
        const variantTargetRefs: string[] = []
        if (variantBrowse || variantHint) {
                const lookbackFloor = Math.max(0, history.length - 24)
                for (let index = history.length - 1; index >= lookbackFloor; index -= 1) {
                        const item = history[index]
                        const content = item.content ?? ''
                        if (item.role === 'assistant') {
                                const markerIds = extractMarkerProductIds(content)
                                if (markerIds.length) {
                                        variantTargetRefs.push(...markerIds)
                                        break
                                }
                                continue
                        }
                        if (item.role !== 'user') continue
                        const previousContent = normalizePersianText(content)
                        if (RESET_CONTEXT_RE.test(previousContent)) break
                        const codeTerms = extractProductTerms(previousContent)
                                .filter((term) => /^\d{3,8}$/.test(term))
                        if (codeTerms.length) {
                                variantTargetRefs.push(...codeTerms)
                                break
                        }
                }
        }
        // ─── Variant pick: «طرح 07 رو میخوام» / «رنگ شکلاتی دارین؟» ──────────
        // The customer named ONE specific variant of the product already under
        // discussion (hint present + a resolvable earlier reference). Without
        // this flag the bare «رنگ شکلاتی دارین؟» fires the catalog-wide vitrine
        // on the color word and returns random products that merely MENTION the
        // color. A pick must resolve against the discussed product instead.
        const variantPick =
                !orderOnly && !serviceOnly && !policyOnly && !resetRequested && !nonCatalogCode &&
                variantHint != null && variantTargetRefs.length > 0
        // ─── Code-named variant vitrine: «0788» / «تونیک روناز ۰۷۸۸» ──────────
        // The code alone names the exact product but no specific variation,
        // so the customer is asking to SEE the item — and for a variant-bearing
        // product the item IS its variety. The deterministic reply is that
        // product's variant vitrine (each design's own photo/price/stock),
        // before any consultation could attach a single parent card whose
        // image is merely one of the designs. The full-term match must resolve
        // to exactly one row (see chat-engine); variation-less products fall
        // back to the ordinary consultation/showcase flow.
        const codeVariantVitrine =
                productCodeSignal && variantHint == null && !nonProductNeed &&
                !variantBrowse && !variantPick &&
                !orderOnly && !serviceOnly && !policyOnly && !resetRequested && !nonCatalogCode
        // A bare product phrase («شومیز», «کیف دوشی دارین؟») names the thing the
        // customer wants to SEE, so it upgrades the turn to a vitrin showcase:
        // up to ten AVAILABLE product cards on every channel, with no follow-up
        // question. Showcase commands keep their own routing above; question-
        // shaped, priced, counted, coded, attribute and policy/order turns stay
        // consultations via the guards inside isBareVitrinPhrase. A variant pick
        // of the discussed product overrides it — «رنگ شکلاتی دارین؟» after a
        // پرنسس vitrine is about THAT product's شکلاتی variant, not the catalog.
        const vitrinPhrase =
                !variantPick &&
                !orderOnly && !serviceOnly && !policyOnly && !nonCatalogCode &&
                !showcaseCommand && !browseQuery && !affirmativeFollowUp &&
                directProductSignal &&
                isBareVitrinPhrase(normalized, currentTerms)

        const explicitShowcase =
                !variantPick && !orderOnly && !serviceOnly && !policyOnly && (
                        (showcaseCommand && directProductSignal) ||
                        showcaseFromContext ||
                        affirmativeFollowUp ||
                        vitrinPhrase
                )
        // «بیخیال، چی دارین؟» resets AND states the new request in one message;
        // only a reset with no product/browse content asks for a fresh prompt.
        const requestNewTopic =
                resetRequested && !explicitShowcase && !browseQuery && !directProductSignal && !variantPick
        const singularProductDetailFollowUp =
                priorProductSignal && SINGULAR_PRODUCT_DETAIL_FOLLOWUP_RE.test(normalized)
        const contextualProductFollowUp =
                priorProductSignal && (
                        PRODUCT_CONTEXT_FOLLOWUP_RE.test(normalized) || singularProductDetailFollowUp
                )
        // A comparative-choice follow-up ("کدومش ارزون‌تره؟") grounds BOTH sides
        // of the pair the recent messages name — see fetchCatalogProducts's
        // comparison branch.
        const comparisonConsult = contextualProductFollowUp && COMPARISON_QUESTION_RE.test(normalized)
        const isProductTurn =
                !requestNewTopic && !orderOnly && !serviceOnly && !policyOnly && !nonCatalogCode && !advisoryConsult &&
                (directProductSignal || contextualProductFollowUp || browseQuery || explicitShowcase || variantBrowse || variantPick)
        // An accepted offer refers to what was discussed before, never to the
        // affirmative word itself.
        let searchTerms = isProductTurn ? (affirmativeFollowUp ? [] : currentTerms) : []

        if (isProductTurn && searchTerms.length === 0 && !resetRequested) searchTerms = priorProductTerms
        // A pronoun-only comparison follow-up often leaves generic adjective
        // fragments behind ("کدومش ارزون تره" -> کدومش/ارزون/تره). Searching
        // the catalog with those fragments can retrieve an unrelated product.
        // Unless this turn names a fresh product/code, anchor retrieval to the
        // nearest prior product terms instead.
        if (
                contextualProductFollowUp && priorProductTerms.length > 0 &&
                !EXPLICIT_PRODUCT_SUBJECT_RE.test(normalized) && !productCodeSignal
        ) {
                // The variant remains available inside the selected parent
                // row, but it is not part of the product's identity. Carrying
                // «شش» from «طرح شش» into a later material question made
                // the fail-closed matcher require an irrelevant word that the
                // row stores as «طرح 06». Anchor the lookup to the parent
                // product and let its trusted variations answer variant facts.
                //
                // A fresh size-like number in THIS message ("فکر کنم ۱۹۰ بهتر
                // باشه" after a ۱۶۰ goal) is the customer moving within the
                // same family: it must REPLACE the older carried size, not be
                // dropped by it — otherwise every later design/price turn for
                // the new size silently grounds the OLD size's rows.
                const freshSizeTerms = currentTerms.filter((term) =>
                        /^\d{2,4}$/.test(term) && !priorProductTerms.includes(term))
                const basePriorTerms = singularProductDetailFollowUp && priorVariantHint
                        ? priorProductTerms.filter((term) => term !== priorVariantHint)
                        : priorProductTerms
                searchTerms = freshSizeTerms.length > 0
                        ? [...new Set([
                                ...freshSizeTerms,
                                ...basePriorTerms.filter((term) => !/^\d{2,4}$/.test(term)),
                        ])].slice(0, 6)
                        : basePriorTerms
        }

        // Variant turns are about the product already under discussion; plural
        // variant nouns («طرح‌ها») and bare variant values («شکلاتی», «07») alone
        // would pollute the catalog search and return random variation-bearing
        // rows. Prefer the current code terms plus the prior discussion's terms
        // instead so the model consults with the RIGHT product in context.
        if (variantBrowse || variantPick) {
                const codeTerms = currentTerms.filter((term) => /^\d{3,8}$/.test(term))
                const merged = [...new Set([...codeTerms, ...priorProductTerms])]
                if (merged.length) searchTerms = merged
        }

        const explicitCount = explicitRequestedCount(normalized.toLocaleLowerCase('fa'))

        // "What do you have?" with no specific product, no count and no prior
        // product context is a browse — the professional move is a short
        // consult (overview + one narrowing question), not a 10-card dump.
        const discoveryBrowse =
                isProductTurn && !explicitShowcase &&
                browseQuery && explicitCount == null && searchTerms.length === 0

        const inventoryMode = OUT_OF_STOCK_RE.test(normalized)
                ? 'OUT_OF_STOCK'
                : explicitShowcase || variantBrowse || AVAILABLE_RE.test(normalized)
                        ? 'AVAILABLE'
                        : 'ANY'

        // Showing products and abandoning the old subject are separate actions.
        // Previously every explicit showcase cleared history, so the natural
        // refinement «میخوام برای مبل سبز مناسب باشه» lost «جلومبلی». Only an
        // explicitly named, genuinely different product/code creates a catalog
        // boundary; «همه رو نشون بده» and same-subject requests keep context.
        const currentSubjectTerms = currentTerms.filter((term) => PRODUCT_SUBJECT_RE.test(term))
        const priorSubjectTerms = priorProductTerms.filter((term) => PRODUCT_SUBJECT_RE.test(term))
        const currentIdentityTerms = productCodeSignal
                ? currentTerms.filter((term) => /^\d{3,8}$/u.test(term))
                : currentSubjectTerms
        const priorIdentityTerms = currentIdentityTerms.length > 0 && currentSubjectTerms.length === 0
                ? priorProductTerms.filter((term) => /^\d{3,8}$/u.test(term))
                : priorSubjectTerms
        const relatedToPriorSubject = currentIdentityTerms.some((current) =>
                priorIdentityTerms.some((prior) =>
                        current === prior ||
                        (current.length >= 3 && prior.includes(current)) ||
                        (prior.length >= 3 && current.includes(prior)),
                ),
        )
        const explicitlyNamesProduct = EXPLICIT_PRODUCT_SUBJECT_RE.test(normalized) || productCodeSignal || corpusSubjectSignal
        const startsDifferentProduct =
                priorProductSignal && explicitlyNamesProduct &&
                currentTerms.length > 0 && priorProductTerms.length > 0 && !relatedToPriorSubject

        // Non-attribute terms named by this very message. A sibling product family
        // («میز تلویزیون» after a «میز عسلی» goal) shares the head noun but names a
        // different subject; the state engine needs this signal to restart the goal.
        // Numbers, رنگ/طرح/سایز/…-labelled values and bare color adjectives describe
        // the CURRENT product («برای مبل سبز» is a constraint, never a new subject)
        // and must not trigger a goal restart.
        const escapeTerm = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const attributeLabelled = (term: string) =>
                new RegExp(`(?:رنگ|طرح|سایز|اندازه|جنس|مدل|کد|برند)\\s+${escapeTerm(term)}`).test(normalized)
        const colorAdjective = /^(?:مشکی|سفید|سبز|آبی|قرمز|زرد|صورتی|بنفش|طوسی|کرم|قهوه(?:\s*ای)?|دودی|خاکستری|سرمه(?:\s*ای)?|فیروزه(?:\s*ای)?|نارنجی|زیتونی|گلبهی|سرخابی|لیمویی|یاسی|شکلاتی|زغالی|گردویی|بلوطی|افرایی|برنزی|طلایی|نقره(?:\s*ای)?|کرمی|گنجشکی)$/iu
        const subjectSwitchTerms = isProductTurn && (explicitlyNamesProduct || productCodeSignal)
                ? currentTerms.filter((term) => !/^\d+$/.test(term) && !attributeLabelled(term) && !colorAdjective.test(term))
                : []

        return {
                subjectSwitchTerms,
                corpusSubjectTerms,
                isProductTurn,
                explicitShowcase,
                discoveryBrowse,
                resetProductContext: resetRequested || startsDifferentProduct,
                requestNewTopic,
                requestedCount:
                        explicitCount ?? (
                                explicitShowcase || variantBrowse
                                        ? MAX_SHOWCASE_PRODUCTS
                                        : discoveryBrowse
                                                ? 6
                                                // A comparison consult presents both sides of
                                                // the pair: two rows per side is plenty.
                                                : comparisonConsult ? 4
                                                // A singular attribute question is about one
                                                // established product. Returning one best row
                                                // prevents unrelated catalog cards from leaking
                                                // into a focused answer such as «پارچش چیه؟».
                                                : singularProductDetailFollowUp ? 1 : 5
                        ),
                searchTerms,
                inventoryMode,
                includeProductCards: !singularProductDetailFollowUp,
                detailField:
                        singularProductDetailFollowUp && MATERIAL_DETAIL_FOLLOWUP_RE.test(normalized)
                                ? 'MATERIAL'
                                : null,
                // The customer named an identifier-like SKU; used to guarantee
                // the exact catalog match is presented as a product card.
                codeIdentified: productCodeSignal,
                variantBrowse,
                variantHint,
                variantPick,
                variantTargetRefs,
                codeVariantVitrine,
                advisoryConsult,
                comparisonConsult,
        }
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
        return plan.searchTerms
                .filter((term) => PRODUCT_SUBJECT_RE.test(term))
                .slice(0, 2)
                .join(' ')
                .slice(0, 40)
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
        const facetAttributes = (() => {
                if (!product.attributes || typeof product.attributes !== 'object' || Array.isArray(product.attributes)) {
                        return ''
                }
                const publicEntries = Object.entries(product.attributes as Record<string, unknown>)
                        .filter(([key]) => !key.startsWith('_'))
                return publicEntries.length ? JSON.stringify(Object.fromEntries(publicEntries)) : ''
        })()
        return {
                name: normalizePersianText(product.name).toLocaleLowerCase('fa'),
                description: normalizePersianText(product.description ?? '').toLocaleLowerCase('fa'),
                sku: normalizePersianText(product.sku ?? '').toLocaleLowerCase('fa'),
                tags: normalizePersianText(product.tags.join(' ')).toLocaleLowerCase('fa'),
                attributes: normalizePersianText(facetAttributes).toLocaleLowerCase('fa'),
                category: normalizePersianText(product.category?.name ?? '').toLocaleLowerCase('fa'),
        }
}

export interface AssignedCatalogReference {
        productIds: string[]
        searchTerms: string[]
        match: 'EXACT' | 'PARTIAL'
}

/**
 * Catalog-backed escape hatch for product names outside the global vocabulary
 * (for example «پاف ۹۰ شهداد» or a store-specific handmade item). This probe is
 * deliberately lexical and name/category/SKU-only: a coincidental word in a
 * long description must not turn a general support question into shopping.
 */
export async function findAssignedCatalogReference(
        agentId: string,
        message: string,
): Promise<AssignedCatalogReference | null> {
        const normalized = normalizePersianText(message)
        if (!normalized || normalized.length > 180 || RESET_CONTEXT_RE.test(normalized)) return null
        if (ORDER_ONLY_RE.test(normalized) || SERVICE_ONLY_RE.test(normalized)
                || NON_PRODUCT_NEED_RE.test(normalized) || isShippingPolicyQuestion(normalized)) return null
        const nameNumbers = !PRICE_VALUE_RE.test(normalized) && !NON_CATALOG_CODE_RE.test(normalized)
                ? normalized.split(/[^\p{L}\p{N}_-]+/u).filter((token) => /^\d{1,8}$/.test(token))
                : []
        const searchTerms = [...new Set([...extractProductTerms(normalized), ...nameNumbers])].slice(0, 6)
        if (!searchTerms.length) return null
        const lexicalFilters: Prisma.ProductWhereInput[] = searchTerms.flatMap((term) =>
                catalogTermVariants(term).flatMap((variant) => [
                        { name: { contains: variant, mode: 'insensitive' as const } },
                        { sku: { contains: variant, mode: 'insensitive' as const } },
                        { tags: { has: variant } },
                        { category: { is: { name: { contains: variant, mode: 'insensitive' as const } } } },
                ]),
        )
        const rows = await prisma.product.findMany({
                where: {
                        active: true,
                        catalogItems: { some: { agentId } },
                        OR: lexicalFilters,
                },
                take: 40,
                select: {
                        id: true,
                        name: true,
                        sku: true,
                        tags: true,
                        category: { select: { name: true } },
                },
        })
        const ranked = rows.map((row) => {
                const identityFields = [row.name, row.sku ?? '']
                        .map((value) => normalizePersianText(value).toLocaleLowerCase('fa'))
                const categoryField = normalizePersianText(row.category?.name ?? '').toLocaleLowerCase('fa')
                const canonicalFields = [...identityFields, categoryField]
                const descriptiveFields = [row.tags.join(' ')]
                        .map((value) => normalizePersianText(value).toLocaleLowerCase('fa'))
                const termMatches = (term: string, fields: string[]) => {
                        const variants = catalogTermVariants(term)
                        if (/^\d+$/.test(term)) {
                                return fields.some((field) => variants.some((variant) =>
                                        new RegExp(`(?:^|[^\\d])${variant}(?=$|[^\\d])`, 'u').test(field),
                                ))
                        }
                        return fields.some((field) => variants.some((variant) => field.includes(variant)))
                }
                const coverage = searchTerms.filter((term) => {
                        if (/^\d+$/.test(term)) {
                                // «90» must not match «190», and mutable tags do
                                // not prove an identifier/size belongs to a row.
                                return termMatches(term, identityFields)
                        }
                        return termMatches(term, [...canonicalFields, ...descriptiveFields])
                }).length
                const canonicalCoverage = searchTerms.filter((term) =>
                        termMatches(term, /^\d+$/.test(term) ? identityFields : canonicalFields),
                ).length
                const categorySubject = searchTerms.length === 1 && catalogTermVariants(searchTerms[0])
                        .some((variant) => categoryField === variant || categoryField.startsWith(`${variant} `))
                return { id: row.id, coverage, canonicalCoverage, categorySubject }
        }).sort((a, b) => b.coverage - a.coverage)
        let exact = ranked.filter((row) =>
                row.coverage === searchTerms.length && row.canonicalCoverage >= 1,
        )
        if (searchTerms.length === 1 && exact.length > 1) {
                // A single open-ended adjective/tag (for example «سبز») can
                // match many product names and is not enough to invent a new
                // subject. An exact category remains a valid broad request.
                exact = exact.filter((row) => row.categorySubject)
        }
        if (exact.length) {
                return { productIds: exact.slice(0, 10).map((row) => row.id), searchTerms, match: 'EXACT' }
        }
        if (searchTerms.length === 1) return null
        // An unavailable size/design can still be an unmistakable product
        // request. Require two matched name/category terms when the message has
        // several terms; a one-word phrase must match that one catalog term.
        const minimumCoverage = Math.min(2, searchTerms.length)
        const partial = ranked.filter((row) => row.coverage >= minimumCoverage && row.canonicalCoverage >= 1)
        if (!partial.length) return null
        return { productIds: partial.slice(0, 10).map((row) => row.id), searchTerms, match: 'PARTIAL' }
}

/** Upgrade an otherwise unknown short phrase after the assigned catalog proves it. */
export function productRequestFromCatalogReference(
        plan: ProductRequestPlan,
        message: string,
        reference: AssignedCatalogReference,
): ProductRequestPlan {
        const normalized = normalizePersianText(message)
        const consultation = /(?:قیمت|چند|چقدر|موجود|جنس|رنگ|سایز|اندازه|مناسب|برای|چطور|چجوری|چرا|price|cost|stock|size|color|colour|how|why|[؟?])/iu.test(normalized)
        // A partial match proves the subject but not the exact requested
        // variant. Keep it conversational so alternatives are not presented
        // as if they were an exact catalog match.
        const explicitShowcase = plan.isProductTurn
                ? plan.explicitShowcase
                : reference.match === 'EXACT' && !consultation
                        && normalized.split(/\s+/u).filter(Boolean).length <= 6
        return {
                ...plan,
                isProductTurn: true,
                explicitShowcase,
                discoveryBrowse: false,
                resetProductContext: false,
                requestNewTopic: false,
                requestedCount: explicitShowcase ? MAX_SHOWCASE_PRODUCTS : plan.requestedCount,
                searchTerms: reference.searchTerms,
                inventoryMode: explicitShowcase ? 'AVAILABLE' : plan.inventoryMode,
        }
}

/** Match measurements regardless of whether the source used 48, ۴۸ or ٤٨. */
function catalogTermVariants(term: string): string[] {
        if (!/\d/.test(term)) return [term]
        const variants = [
                term,
                term.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]),
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

        const rankedIds = [...new Set(productIds)].slice(0, 40)
        const terms = plan.searchTerms.slice(0, 6)
        const lexicalFilters: Prisma.ProductWhereInput[] = terms.flatMap((term) =>
                catalogTermVariants(term).flatMap((variant) => [
                        { name: { contains: variant, mode: 'insensitive' as const } },
                        { description: { contains: variant, mode: 'insensitive' as const } },
                        { sku: { contains: variant, mode: 'insensitive' as const } },
                        { tags: { has: variant } },
                        { category: { is: { name: { contains: variant, mode: 'insensitive' as const } } } },
                ]),
        )
        // The broadest term in a multi-term request can match hundreds of
        // rows (for example «پیراهن» in a fashion catalog). A fixed
        // candidate cap ordered by popularity can then discard the exact,
        // rarer name match («شراره») before in-memory ranking even
        // sees it. Fetch semantic IDs and non-subject identity terms in a
        // small priority lane, then merge them with the broad pool.
        const identityTerms = terms.filter((term) => !PRODUCT_SUBJECT_RE.test(term))
        const identityLexicalFilters: Prisma.ProductWhereInput[] = identityTerms.flatMap((term) =>
                catalogTermVariants(term).flatMap((variant) => [
                        { name: { contains: variant, mode: 'insensitive' as const } },
                        { description: { contains: variant, mode: 'insensitive' as const } },
                        { sku: { contains: variant, mode: 'insensitive' as const } },
                        { tags: { has: variant } },
                        { category: { is: { name: { contains: variant, mode: 'insensitive' as const } } } },
                ]),
        )
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
        const [priorityRows, broadRows] = await Promise.all([
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
        ])
        const seenProductIds = new Set<string>()
        const rows = [...priorityRows, ...broadRows].filter((product) => {
                if (seenProductIds.has(product.id)) return false
                seenProductIds.add(product.id)
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
                const normalizedField = ` ${field.replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim()} `
                return normalizedField.includes(` ${term} `)
        }
        const ranked = rows.map((product) => {
                const searchable = searchableProductText(product)
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
                                const nameToken = new RegExp(
                                        `(?:^|[^\\p{L}\\p{N}])${term}(?=$|[^\\p{L}\\p{N}])`,
                                        'u',
                                )
                                if (nameToken.test(searchable.name)) {
                                        score += 40
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
                        }
                        const isSubjectTerm = subjectTerms.includes(term)
                        if (
                                isSubjectTerm &&
                                (canonicalTokenMatch(searchable.name, term) || canonicalTokenMatch(searchable.category, term))
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
                const rankBy = (bucket: (typeof ranked)[number][], reference: Set<string> | null) =>
                        [...bucket].sort((left, right) => {
                                const recallDelta = Number(recalled(right)) - Number(recalled(left))
                                if (recallDelta !== 0) return recallDelta
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
                                        return comparisonRows.map(({ product }) => ({
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
                                        }))
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
        if (requiresGroundedMatch && eligible.length === 0 && ranked.length > 0 && terms.length > 1) {
                const subjectCount = (subset: number[]) =>
                        subset.filter((i) => subjectTerms.includes(terms[i])).length
                const corpusCount = (subset: number[]) =>
                        subset.filter((i) => corpusTokens?.has(terms[i])).length
                const rowCoversSubset = (item: (typeof ranked)[number], subset: number[]) =>
                        subset.every((i) => item.matchedTerms[i]) &&
                        subset.every((i) => !subjectTerms.includes(terms[i]) || item.subjectMatchedTerms[i])
                function keyComparison(a: number[], b: number[]): number {
                        for (let i = 0; i < Math.max(a.length, b.length); i++) {
                                const av = a[i] ?? 0
                                const bv = b[i] ?? 0
                                if (av !== bv) return av - bv
                        }
                        return 0
                }
                // Pick the covering subset that keeps the strongest anchors:
                // subject/corpus terms first, then the best row evidence (row
                // score already blends name-match weight, vector rank and
                // popularity), then sheer subset size. This keeps semantic
                // recall pointing at the RIGHT product family («رومیزی میز
                // غذاخوری» must answer with رومیزی rows, not dining sets that
                // merely mention میز+غذاخوری in their category/description).
                let bestSubset: { rows: typeof ranked; key: number[] } | null = null
                const total = 1 << terms.length
                for (let mask = 1; mask < total - 1; mask++) {
                        const subset: number[] = []
                        for (let i = 0; i < terms.length; i++) if (mask & (1 << i)) subset.push(i)
                        if (subjectCount(subset) === 0 && corpusCount(subset) === 0) continue
                        const covering = ranked.filter((item) => rowCoversSubset(item, subset))
                        if (covering.length === 0) continue
                        // Semantic endorsement: relaxation is only honest when
                        // the turn's own recall evidence (vector chunks / the
                        // lexical catalog reference) points at the rows we are
                        // about to keep. Without it, dropping a real catalog
                        // attribute («شلوار پلنگی» → showing plain شلوار rows)
                        // would present a variant the customer never asked for.
                        if (rankedIds.length > 0 && !covering.some((item) => semanticRank.has(item.product.id))) continue
                        const key = [
                                subjectCount(subset),
                                corpusCount(subset),
                                Math.max(...covering.map((item) => item.score)),
                                subset.length,
                        ]
                        if (!bestSubset || keyComparison(key, bestSubset.key) > 0) {
                                bestSubset = { rows: covering, key }
                        }
                }
                if (bestSubset) relaxedRows = bestSubset.rows
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
        const uniquelyIdentified = !relaxed && selected.length === 1 && terms.length > 1

        return selected.map(({ product, coverage, subjectCoverage }) => ({
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
        }))
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
                        .replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])
                        .replace(/,/g, '،')
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
                select: { name: true, description: true, durationMinutes: true, location: true },
        })
}
