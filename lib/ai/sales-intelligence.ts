import type {
        BusinessType,
        MessageRole,
        Prisma,
        SalesBuyerReadiness,
        SalesIntentStage,
        SalesLeadType,
        SalesSentiment,
        SalesUrgency,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Behaviour-based sales intelligence.
 *
 * The classifier intentionally uses only observable conversation signals. It
 * does not infer personality, mental health, demographics or other sensitive
 * traits. It is deterministic, bilingual and bounded, so every inbound turn
 * can be scored without a second LLM request or an unbounded transcript read.
 */

export const SALES_INTELLIGENCE_VERSION = 'sales-heuristic-v1'
export const SALES_INTELLIGENCE_MESSAGE_LIMIT = 24

export interface SalesConversationMessage {
        id?: string
        role: MessageRole | 'USER' | 'ASSISTANT' | 'SYSTEM'
        content: string
        unanswered?: boolean
        createdAt?: Date
}

export interface SalesEvidence {
        code: string
        label: string
        weight: number
        excerpt: string
        messageId?: string
}

export interface SalesOperationalSignals {
        explicitHumanRequest: boolean
        severeDistress: boolean
        requiresHumanAuthority: boolean
        repeatedRequest: boolean
        consecutiveUnanswered: number
        latestUserIsGreetingOrInfoOnly: boolean
        negativeSignalCount: number
}

export interface SalesConversationAnalysis {
        leadType: SalesLeadType
        stage: SalesIntentStage
        buyerReadiness: SalesBuyerReadiness
        buyerProbability: number
        sentiment: SalesSentiment
        urgency: SalesUrgency
        confidence: number
        objections: string[]
        riskFlags: string[]
        signalCodes: string[]
        evidence: SalesEvidence[]
        recommendedAction: string
        explanation: string
        operational: SalesOperationalSignals
}

export interface SalesConversationContext {
        conversationId: string
        workspaceId: string
        businessType: BusinessType
        language: string
        roleTemplate: string | null
        messageCount: number
        messages: SalesConversationMessage[]
}

export interface PersistSalesInsightOptions {
        handoffRecommended?: boolean
        handoffReasonCodes?: string[]
}

/**
 * Turn the explainable snapshot into a small internal coaching note for the
 * existing model call. This adapts the answer without adding a second LLM call
 * or exposing a score to the customer.
 */
export function salesGuidanceForModel(
        analysis: SalesConversationAnalysis,
        language = 'fa',
): string {
        const english = language.toLowerCase().startsWith('en')
        return english
                ? `[Internal sales guidance — never disclose or quote this block]
Recommended next move: ${analysis.recommendedAction}
First answer the customer's current request. Use at most one relevant follow-up question. Do not pressure, manipulate, invent scarcity, or treat the estimate as a fact.`
                : `[راهنمای داخلی فروش — این بخش را هرگز افشا یا نقل نکن]
اقدام بعدی پیشنهادی: ${analysis.recommendedAction}
ابتدا به درخواست فعلی مشتری پاسخ بده. حداکثر یک سؤال مرتبط بپرس. از فشار، دست‌کاری، کمبود ساختگی یا بیان این برآورد به‌عنوان واقعیت پرهیز کن.`
}

type SignalGroup = readonly string[]

const TERMS = {
        greeting: [
                'سلام', 'درود', 'وقت بخیر', 'صبح بخیر', 'شب بخیر',
                'hi', 'hello', 'hey', 'good morning', 'good evening',
        ],
        buyCommitment: [
                'میخوام بخرم', 'می خوام بخرم', 'می خواهم بخرم', 'خریدش میکنم',
                'خریدش می کنم', 'ثبت سفارش', 'سفارش بده', 'سفارش بدم', 'لینک پرداخت',
                'چطور پرداخت کنم', 'رزرو کن', 'رزرو کنید', 'نهایی کنیم',
                'i want to buy', "i'll take it", 'place an order', 'buy it',
                'send payment link', 'how can i pay', 'book it', 'checkout',
        ],
        transaction: [
                'موجوده', 'موجود هست', 'موجودی', 'ارسال', 'تحویل', 'زمان تحویل',
                'شرایط پرداخت', 'پرداخت قسطی', 'قسط', 'هزینه ارسال', 'رزرو',
                'in stock', 'availability', 'shipping', 'delivery', 'payment plan',
                'installment', 'when can i get', 'can i order',
        ],
        negotiation: [
                'تخفیف', 'قیمت نهایی', 'آخرش چند', 'قابل مذاکره', 'شرایط ویژه',
                'پیش فاکتور', 'فاکتور رسمی', 'خرید عمده', 'سفارش عمده', 'قرارداد',
                'discount', 'best price', 'final price', 'negotiate', 'custom quote',
                'proforma', 'bulk order', 'wholesale', 'contract', 'enterprise',
        ],
        consideration: [
                'مقایسه', 'چه فرقی', 'فرقش', 'کدام بهتر', 'کدوم بهتر', 'نظر مشتری',
                'تجربه مشتری', 'ضمانت', 'گارانتی', 'مرجوعی', 'ارزش خرید',
                'compare', 'difference', 'which is better', 'reviews', 'warranty',
                'return policy', 'worth it', 'alternative',
        ],
        discovery: [
                'نیاز دارم', 'دنبال', 'برای من مناسبه', 'برای من مناسب', 'مشاوره',
                'پیشنهاد میدید', 'پیشنهاد می دهید', 'چه پیشنهادی', 'راه حل',
                'i need', 'looking for', 'recommend', 'suitable for me',
                'what do you suggest', 'solution for',
        ],
        information: [
                'اطلاعات', 'توضیحات', 'مشخصات', 'کاتالوگ', 'جزئیات', 'چیه',
                'چطور کار میکنه', 'چطور کار می کند', 'قیمت چنده', 'قیمتش',
                'information', 'details', 'specs', 'catalog', 'what is',
                'how does it work', 'tell me about', 'how much',
        ],
        informationOnly: [
                'فقط اطلاعات', 'صرفا اطلاعات', 'صرفاً اطلاعات', 'فقط کنجکاوم',
                'فعلا قصد خرید ندارم', 'فعلاً قصد خرید ندارم', 'قصد خرید ندارم',
                'هنوز تصمیم نگرفتم', 'دارم تحقیق میکنم', 'دارم تحقیق می کنم',
                'just researching', 'just information', 'not ready to buy',
                'no plan to buy', 'only curious', 'still researching',
        ],
        support: [
                'مشکل دارم', 'کار نمیکنه', 'کار نمی کنه', 'خراب شده', 'خطا میده',
                'پشتیبانی', 'پیگیری', 'لغو', 'بازپرداخت', 'مرجوع',
                'not working', 'problem with', 'support', 'cancel', 'refund',
                'does not work', 'error', 'follow up',
        ],
        postPurchase: [
                'خریدم', 'سفارش دادم', 'سفارشم', 'پرداخت کردم', 'رزرو کردم',
                'کد رهگیری', 'شماره سفارش', 'بسته من', 'پس گرفتن پول',
                'i bought', 'i ordered', 'my order', 'i paid', 'tracking code',
                'order number', 'my booking', 'charged me',
        ],
        positive: [
                'عالیه', 'خیلی خوبه', 'پسندیدم', 'جالبه', 'مناسبه', 'ممنون',
                'عالی', 'خوبه', 'interested', 'sounds good', 'perfect', 'great',
                'i like it', 'thank you',
        ],
        negative: [
                'ناراضی', 'بد بود', 'جواب نداد', 'اشتباه', 'مشکل', 'ناامید',
                'قبول ندارم', 'گران', 'دیر شده', 'disappointed', 'not happy',
                'bad service', 'wrong', 'too expensive', 'late', 'frustrated',
        ],
        severeDistress: [
                'عصبانی', 'افتضاح', 'کلاهبرداری', 'شکایت میکنم', 'شکایت می کنم',
                'دادگاه', 'پلیس', 'دیگه تحمل ندارم', 'فاجعه',
                'furious', 'scam', 'fraud', 'i will sue', 'legal action',
                'unacceptable', 'this is a disaster',
        ],
        urgentHigh: [
                'فوری', 'همین الان', 'الان لازم دارم', 'اورژانسی', 'اضطراری',
                'asap', 'immediately', 'urgent', 'emergency', 'right now',
        ],
        urgentMedium: [
                'امروز', 'تا فردا', 'هرچه زودتر', 'این هفته', 'زود',
                'today', 'tomorrow', 'soon', 'this week',
        ],
        humanRequest: [
                'اپراتور', 'پشتیبانی انسانی', 'با یک انسان', 'با مسئول صحبت',
                'با مدیر صحبت', 'وصل کن به پشتیبانی', 'کارشناس انسانی',
                'human agent', 'real person', 'live agent', 'representative',
                'speak to someone', 'talk to a manager', 'human support',
        ],
        authority: [
                'مدیر فروش', 'مسئول فروش', 'تصمیم گیرنده', 'تایید مدیر',
                'شرایط اختصاصی', 'قیمت همکاری', 'فاکتور رسمی', 'مناقصه',
                'sales manager', 'decision maker', 'manager approval',
                'procurement', 'custom terms', 'corporate pricing',
        ],
} as const satisfies Record<string, SignalGroup>

const OBJECTION_TERMS: Record<string, SignalGroup> = {
        PRICE: ['گرونه', 'گران است', 'قیمت بالاست', 'بودجه ندارم', 'too expensive', 'over budget', 'cheaper'],
        TRUST: ['مطمئن نیستم', 'اعتماد ندارم', 'واقعیه', 'تضمین', 'نماد اعتماد', 'not sure i trust', 'legit', 'guarantee'],
        FIT: ['مناسب من نیست', 'به درد من میخوره', 'به درد من می خورد', 'سازگاره', 'will it fit', 'compatible', 'right for me'],
        TIMING: ['الان وقتش نیست', 'بعدا', 'بعداً', 'فعلا صبر', 'not now', 'later', 'need more time'],
        AUTHORITY: ['باید بپرسم', 'باید تایید بگیرم', 'شریکم', 'مدیرم', 'need approval', 'ask my partner', 'ask my manager'],
        COMPETITOR: ['جای دیگه', 'رقیب', 'برند دیگر', 'گزینه دیگه', 'competitor', 'another vendor', 'other option'],
        RISK: ['اگر جواب نداد', 'اگر خراب شد', 'ریسک', 'امن هست', 'what if it fails', 'risk', 'is it safe'],
}

const GENERAL_RISK_TERMS: Record<string, SignalGroup> = {
        SELF_HARM: ['خودکشی', 'به خودم آسیب', 'نمیخوام زنده باشم', 'suicide', 'self harm', 'hurt myself'],
        IMMEDIATE_DANGER: ['خطر جانی', 'تهدید جانی', 'جانم در خطر', 'immediate danger', 'life threatening'],
        LEGAL_THREAT: ['شکایت رسمی', 'دادگاه', 'وکیل', 'پلیس', 'legal action', 'lawyer', 'report to police'],
        PAYMENT_DISPUTE: ['برداشت غیرمجاز', 'دوبار کم شده', 'پولم را خوردید', 'chargeback', 'unauthorized charge', 'charged twice'],
}

const VERTICAL_RISK_TERMS: Partial<Record<BusinessType, Record<string, SignalGroup>>> = {
        FOOD: {
                ALLERGY: ['حساسیت غذایی', 'آلرژی', 'بادام زمینی', 'نفس نمیکشم', 'food allergy', 'allergic', 'peanut', 'cannot breathe'],
                FOOD_SAFETY: ['مسمومیت', 'غذای فاسد', 'مسموم شدم', 'food poisoning', 'spoiled food'],
        },
        APPOINTMENTS: {
                MEDICAL_URGENCY: ['درد شدید', 'خونریزی', 'بیهوش', 'نفس تنگی', 'اورژانس', 'severe pain', 'bleeding', 'unconscious', 'shortness of breath'],
        },
        SUPPORT: {
                ACCOUNT_SECURITY: ['هک شدم', 'حسابم دزدیده', 'نفوذ', 'اطلاعات لو رفته', 'hacked', 'account compromised', 'data breach'],
        },
        COMMERCE: {
                COMMERCE_FRAUD: ['کارت دزدیده', 'سفارش جعلی', 'کلاهبرداری مالی', 'stolen card', 'fraudulent order'],
        },
}

const SIGNAL_LABELS: Record<string, { fa: string; en: string }> = {
        BUY_COMMITMENT: { fa: 'درخواست صریح خرید یا رزرو', en: 'explicit purchase or booking request' },
        TRANSACTIONAL_QUESTION: { fa: 'پرسش عملیاتی پیش از خرید', en: 'transactional pre-purchase question' },
        NEGOTIATION: { fa: 'مذاکره درباره قیمت یا شرایط', en: 'price or terms negotiation' },
        CONSIDERATION: { fa: 'مقایسه و ارزیابی گزینه‌ها', en: 'comparison and option evaluation' },
        NEED_DISCOVERY: { fa: 'بیان نیاز یا درخواست پیشنهاد', en: 'stated need or request for recommendation' },
        INFORMATION: { fa: 'درخواست اطلاعات', en: 'information request' },
        INFORMATION_ONLY: { fa: 'اعلام نبود قصد خرید فعلی', en: 'no current buying intent' },
        POST_PURCHASE: { fa: 'نشانه خرید یا رزرو قبلی', en: 'existing purchase or booking' },
        SUPPORT: { fa: 'درخواست پشتیبانی', en: 'support request' },
        POSITIVE_SENTIMENT: { fa: 'بازخورد مثبت', en: 'positive feedback' },
        NEGATIVE_SENTIMENT: { fa: 'نارضایتی یا اصطکاک', en: 'dissatisfaction or friction' },
        SEVERE_DISTRESS: { fa: 'نارضایتی شدید', en: 'severe distress' },
        HIGH_URGENCY: { fa: 'فوریت بالا', en: 'high urgency' },
        MEDIUM_URGENCY: { fa: 'محدودیت زمانی', en: 'time constraint' },
        HUMAN_REQUEST: { fa: 'درخواست صریح اپراتور انسانی', en: 'explicit human operator request' },
        AUTHORITY_REQUIRED: { fa: 'نیاز احتمالی به اختیار انسانی', en: 'possible human authority required' },
        REPEATED_REQUEST: { fa: 'تکرار درخواست حل‌نشده', en: 'repeated unresolved request' },
}

const STOP_WORDS = new Set([
        'از', 'به', 'در', 'با', 'برای', 'که', 'این', 'اون', 'آن', 'من', 'شما',
        'رو', 'را', 'و', 'یا', 'یک', 'می', 'است', 'هست', 'the', 'a', 'an', 'to',
        'for', 'of', 'is', 'it', 'i', 'you', 'and', 'or', 'this', 'that',
])

function clamp(value: number, min: number, max: number): number {
        return Math.min(max, Math.max(min, value))
}

/** Normalize Persian/Arabic variants, digits and spacing before matching. */
export function normalizeSalesText(value: string): string {
        const persianDigits = '۰۱۲۳۴۵۶۷۸۹'
        const arabicDigits = '٠١٢٣٤٥٦٧٨٩'
        return value
                .normalize('NFKC')
                .toLowerCase()
                .replace(/[يى]/g, 'ی')
                .replace(/ك/g, 'ک')
                .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
                .replace(/[\u200c\u200d]/g, ' ')
                .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
                .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
                .replace(/[^\p{L}\p{N}\s%٪؟?!]/gu, ' ')
                .replace(/\s+/g, ' ')
                .trim()
}

function includesTerm(text: string, rawTerm: string): boolean {
        const term = normalizeSalesText(rawTerm)
        if (!term) return false
        if (/^[a-z0-9 ]+$/.test(term)) {
                return (` ${text} `).includes(` ${term} `)
        }
        return text.includes(term)
}

function firstMatch(text: string, terms: SignalGroup): string | null {
        return terms.find((term) => includesTerm(text, term)) ?? null
}

function isGreetingOnly(text: string): boolean {
        const normalized = normalizeSalesText(text).replace(/[؟?!]/g, '').trim()
        return TERMS.greeting.some((term) => normalized === normalizeSalesText(term))
}

function excerpt(value: string): string {
        const oneLine = value.replace(/\s+/g, ' ').trim()
        return oneLine.length <= 160 ? oneLine : `${oneLine.slice(0, 157)}...`
}

function tokenSet(value: string): Set<string> {
        return new Set(
                normalizeSalesText(value)
                        .split(' ')
                        .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
        )
}

function similarity(left: string, right: string): number {
        const a = tokenSet(left)
        const b = tokenSet(right)
        if (a.size < 2 || b.size < 2) return 0
        let intersection = 0
        for (const token of a) if (b.has(token)) intersection += 1
        return intersection / new Set([...a, ...b]).size
}

function detectRepeatedRequest(userMessagesNewestFirst: SalesConversationMessage[]): boolean {
        const latest = userMessagesNewestFirst[0]
        if (!latest || isGreetingOnly(latest.content)) return false
        const normalizedLatest = normalizeSalesText(latest.content)
        if (normalizedLatest.length < 8) return false
        return userMessagesNewestFirst.slice(1, 6).some((candidate) => {
                const normalizedCandidate = normalizeSalesText(candidate.content)
                if (normalizedCandidate === normalizedLatest) return true
                if (normalizedLatest.length >= 16 && (
                        normalizedCandidate.includes(normalizedLatest) ||
                        normalizedLatest.includes(normalizedCandidate)
                )) return true
                return similarity(latest.content, candidate.content) >= 0.62
        })
}

function countConsecutiveUnanswered(messages: SalesConversationMessage[]): number {
        const assistant = [...messages].reverse().filter((message) => message.role === 'ASSISTANT')
        let count = 0
        for (const message of assistant) {
                if (!message.unanswered) break
                count += 1
        }
        return count
}

function readinessFor(probability: number, stage: SalesIntentStage): SalesBuyerReadiness {
        if (stage === 'POST_PURCHASE') return 'CUSTOMER'
        if (probability >= 70) return 'HOT'
        if (probability >= 50) return 'WARM'
        if (probability >= 25) return 'EXPLORING'
        return 'COLD'
}

function localize(language: string, fa: string, en: string): string {
        return language.toLowerCase().startsWith('en') ? en : fa
}

function recommendNextAction(params: {
        language: string
        stage: SalesIntentStage
        objections: Set<string>
        riskFlags: Set<string>
        explicitHumanRequest: boolean
        repeatedRequest: boolean
        requiresHumanAuthority: boolean
}): string {
        const { language, stage, objections, riskFlags } = params
        if (riskFlags.size > 0 || params.explicitHumanRequest) {
                return localize(
                        language,
                        'گفتگو را با خلاصه روشن و بدون درخواست تکرار اطلاعات به اپراتور منتقل کنید؛ ابتدا فوریت و انتظار مشتری را تأیید کنید.',
                        'Transfer with a clear summary and no request to repeat information; first acknowledge urgency and the customer’s expected outcome.',
                )
        }
        if (params.repeatedRequest) {
                return localize(
                        language,
                        'درخواست تکرارشده را کوتاه بازگو کنید، مسئولیت پیگیری را بپذیرید و یک پاسخ مشخص یا مسیر اپراتور ارائه دهید.',
                        'Restate the repeated request briefly, own the follow-up, and provide a concrete answer or operator path.',
                )
        }
        if (stage === 'POST_PURCHASE') {
                return localize(language, 'ابتدا شماره سفارش/رزرو و نتیجه مورد انتظار را تأیید و سپس وضعیت یا راه‌حل دقیق ارائه کنید.', 'Confirm the order/booking reference and desired outcome, then provide an exact status or resolution.')
        }
        if (stage === 'PURCHASE_INTENT') {
                return localize(language, 'با یک سؤال کوتاه جزئیات نهایی را تأیید کنید و مسیر خرید، پرداخت یا رزرو را مستقیم ارائه دهید.', 'Confirm the final detail with one short question, then provide the direct purchase, payment, or booking path.')
        }
        if (stage === 'NEGOTIATION' || params.requiresHumanAuthority) {
                return localize(language, 'ارزش و تناسب پیشنهاد را جمع‌بندی کنید، مانع اصلی را روشن کنید و در صورت نیاز اختیار قیمت/شرایط را به کارشناس بسپارید.', 'Summarize value and fit, clarify the main blocker, and route pricing or terms authority to a specialist when needed.')
        }
        if (objections.has('TRUST') || objections.has('RISK')) {
                return localize(language, 'به‌جای فشار برای خرید، مدرک اعتماد، ضمانت و محدودیت‌ها را شفاف ارائه و سپس یک سؤال اطمینان‌بخش بپرسید.', 'Avoid purchase pressure; present proof, guarantees, and limitations clearly, then ask one confidence-building question.')
        }
        if (objections.has('PRICE')) {
                return localize(language, 'ابتدا ارزش مرتبط با نیاز مشتری را روشن کنید، سپس گزینه‌های قیمت یا پرداخت را بدون تخفیف عجولانه مقایسه کنید.', 'Clarify value against the customer’s need, then compare price or payment options without rushing to discount.')
        }
        if (stage === 'CONSIDERATION') {
                return localize(language, 'دو یا سه معیار تصمیم مشتری را مشخص و گزینه‌ها را بر همان معیارها، با مزایا و محدودیت‌های صادقانه، مقایسه کنید.', 'Identify two or three decision criteria and compare options against them with honest benefits and limitations.')
        }
        if (stage === 'DISCOVERY') {
                return localize(language, 'یک سؤال کشف نیاز درباره هدف، محدودیت یا زمان‌بندی بپرسید و بعد فقط پیشنهادهای مرتبط را ارائه کنید.', 'Ask one discovery question about goal, constraint, or timing, then show only relevant options.')
        }
        return localize(language, 'پاسخ اطلاعاتی کوتاه بدهید و با یک سؤال بدون فشار، هدف و زمان احتمالی تصمیم را روشن کنید.', 'Give a concise informational answer, then use one low-pressure question to clarify the goal and likely decision timing.')
}

/**
 * Score a bounded conversation using modern consultative-sales signals:
 * discovery, consideration, commitment, objections, urgency and trust friction.
 */
export function analyzeSalesConversation(input: {
        messages: SalesConversationMessage[]
        businessType?: BusinessType
        language?: string
        roleTemplate?: string | null
}): SalesConversationAnalysis {
        const language = input.language || 'fa'
        const businessType = input.businessType ?? 'CUSTOM'
        const messages = input.messages.slice(-SALES_INTELLIGENCE_MESSAGE_LIMIT)
        const usersNewestFirst = messages
                .filter((message) => message.role === 'USER')
                .reverse()
                .slice(0, 12)
        const latestUser = usersNewestFirst[0]

        let probability = 12
        let purchaseStrength = 0
        let transactionStrength = 0
        let negotiationStrength = 0
        let considerationStrength = 0
        let discoveryStrength = 0
        let informationStrength = 0
        let supportStrength = 0
        let postPurchaseStrength = 0
        let positiveStrength = 0
        let negativeStrength = 0
        let noPurchaseStrength = 0
        let highUrgency = false
        let mediumUrgency = false
        let explicitHumanRequest = false
        let severeDistress = false
        let authoritySignal = false
        let negativeSignalCount = 0

        const objections = new Set<string>()
        const riskFlags = new Set<string>()
        const signalCodes = new Set<string>()
        const evidence: SalesEvidence[] = []
        const signalCounts = new Map<string, number>()

        const record = (
                code: string,
                baseWeight: number,
                message: SalesConversationMessage,
                age: number,
        ): number => {
                const count = signalCounts.get(code) ?? 0
                signalCounts.set(code, count + 1)
                signalCodes.add(code)
                const recency = Math.max(0.52, 1 - age * 0.08)
                const repeatFactor = count === 0 ? 1 : count === 1 ? 0.35 : 0.15
                const weight = Math.round(baseWeight * recency * repeatFactor * 10) / 10
                if (!evidence.some((item) => item.code === code) && evidence.length < 10) {
                        const label = SIGNAL_LABELS[code]
                        evidence.push({
                                code,
                                label: label ? localize(language, label.fa, label.en) : code,
                                weight,
                                excerpt: excerpt(message.content),
                                ...(message.id ? { messageId: message.id } : {}),
                        })
                }
                return weight
        }

        for (const [age, message] of usersNewestFirst.entries()) {
                const text = normalizeSalesText(message.content)
                if (!text) continue

                const informationOnly = firstMatch(text, TERMS.informationOnly)
                const postPurchase = firstMatch(text, TERMS.postPurchase)
                const buyCommitment = informationOnly ? null : firstMatch(text, TERMS.buyCommitment)
                const transaction = firstMatch(text, TERMS.transaction)
                const negotiation = firstMatch(text, TERMS.negotiation)
                const consideration = firstMatch(text, TERMS.consideration)
                const discovery = firstMatch(text, TERMS.discovery)
                const information = firstMatch(text, TERMS.information)
                const support = firstMatch(text, TERMS.support)
                const positive = firstMatch(text, TERMS.positive)
                const negative = firstMatch(text, TERMS.negative)
                const distress = firstMatch(text, TERMS.severeDistress)
                const urgent = firstMatch(text, TERMS.urgentHigh)
                const timeBound = firstMatch(text, TERMS.urgentMedium)
                const human = firstMatch(text, TERMS.humanRequest)
                const authority = firstMatch(text, TERMS.authority)

                if (buyCommitment) {
                        const weight = record('BUY_COMMITMENT', 42, message, age)
                        probability += weight
                        purchaseStrength += Math.abs(weight)
                }
                if (transaction) {
                        const weight = record('TRANSACTIONAL_QUESTION', 17, message, age)
                        probability += weight
                        transactionStrength += Math.abs(weight)
                }
                if (negotiation) {
                        const weight = record('NEGOTIATION', 14, message, age)
                        probability += weight
                        negotiationStrength += Math.abs(weight)
                }
                if (consideration) {
                        const weight = record('CONSIDERATION', 12, message, age)
                        probability += weight
                        considerationStrength += Math.abs(weight)
                }
                if (discovery) {
                        const weight = record('NEED_DISCOVERY', 7, message, age)
                        probability += weight
                        discoveryStrength += Math.abs(weight)
                }
                if (information) {
                        const weight = record('INFORMATION', 3, message, age)
                        probability += weight
                        informationStrength += Math.abs(weight)
                }
                if (informationOnly) {
                        const weight = record('INFORMATION_ONLY', -24, message, age)
                        probability += weight
                        noPurchaseStrength += Math.abs(weight)
                        informationStrength += 8
                }
                if (postPurchase) {
                        record('POST_PURCHASE', 50, message, age)
                        postPurchaseStrength += 50
                }
                if (support) {
                        const weight = record('SUPPORT', -2, message, age)
                        probability += weight
                        supportStrength += 8
                }
                if (positive) {
                        const weight = record('POSITIVE_SENTIMENT', 3, message, age)
                        probability += weight
                        positiveStrength += Math.abs(weight)
                }
                if (negative) {
                        const weight = record('NEGATIVE_SENTIMENT', -5, message, age)
                        probability += weight
                        negativeStrength += Math.abs(weight)
                        negativeSignalCount += 1
                }
                if (distress) {
                        const weight = record('SEVERE_DISTRESS', -8, message, age)
                        probability += weight
                        negativeStrength += 12
                        negativeSignalCount += 2
                        severeDistress = true
                }
                if (urgent) {
                        record('HIGH_URGENCY', 2, message, age)
                        highUrgency = true
                } else if (timeBound) {
                        record('MEDIUM_URGENCY', 1, message, age)
                        mediumUrgency = true
                }
                if (human) {
                        record('HUMAN_REQUEST', 0, message, age)
                        explicitHumanRequest = true
                }
                if (authority) {
                        record('AUTHORITY_REQUIRED', 5, message, age)
                        authoritySignal = true
                }

                for (const [code, terms] of Object.entries(OBJECTION_TERMS)) {
                        if (!firstMatch(text, terms)) continue
                        objections.add(code)
                        const effects: Record<string, number> = {
                                PRICE: 1,
                                TRUST: -6,
                                FIT: -2,
                                TIMING: -7,
                                AUTHORITY: -3,
                                COMPETITOR: -2,
                                RISK: -5,
                        }
                        probability += record(`OBJECTION_${code}`, effects[code] ?? -2, message, age)
                }

                for (const [code, terms] of Object.entries(GENERAL_RISK_TERMS)) {
                        if (!firstMatch(text, terms)) continue
                        riskFlags.add(code)
                        record(`RISK_${code}`, 0, message, age)
                }
                for (const [code, terms] of Object.entries(VERTICAL_RISK_TERMS[businessType] ?? {})) {
                        if (!firstMatch(text, terms)) continue
                        riskFlags.add(code)
                        record(`RISK_${code}`, 0, message, age)
                }
        }

        const repeatedRequest = detectRepeatedRequest(usersNewestFirst)
        if (repeatedRequest && latestUser) {
                record('REPEATED_REQUEST', 0, latestUser, 0)
        }

        let stage: SalesIntentStage = 'UNKNOWN'
        if (postPurchaseStrength > 0) stage = 'POST_PURCHASE'
        else if (purchaseStrength >= 20) stage = 'PURCHASE_INTENT'
        else if (negotiationStrength >= 8) stage = 'NEGOTIATION'
        else if (transactionStrength >= 8 || considerationStrength >= 7 || objections.size > 0) stage = 'CONSIDERATION'
        else if (informationStrength > 0 || noPurchaseStrength > 0) stage = 'INFORMATION_GATHERING'
        else if (discoveryStrength > 0) stage = 'DISCOVERY'

        if (postPurchaseStrength > 0) probability = 100
        else if (noPurchaseStrength > 0) probability = Math.min(probability, 18)
        else if (supportStrength > 0 && purchaseStrength + transactionStrength + negotiationStrength === 0) {
                probability = Math.min(probability, 20)
        }
        if (stage === 'UNKNOWN') probability = Math.min(probability, 20)
        probability = Math.round(clamp(probability, 0, 100))

        let leadType: SalesLeadType = 'UNCLEAR'
        if (stage === 'POST_PURCHASE') leadType = 'EXISTING_CUSTOMER'
        else if (supportStrength > informationStrength && probability < 35) leadType = 'SUPPORT_SEEKER'
        else if (
                stage === 'PURCHASE_INTENT' ||
                stage === 'NEGOTIATION' ||
                (stage === 'CONSIDERATION' && probability >= 32)
        ) leadType = 'BUYER'
        else if (stage === 'INFORMATION_GATHERING') leadType = 'INFORMATION_SEEKER'

        let sentiment: SalesSentiment = 'NEUTRAL'
        if (severeDistress) sentiment = 'DISTRESSED'
        else if (positiveStrength > 0 && negativeStrength > 0) sentiment = 'MIXED'
        else if (negativeStrength > positiveStrength) sentiment = 'NEGATIVE'
        else if (positiveStrength > 0) sentiment = 'POSITIVE'

        const urgency: SalesUrgency = highUrgency || riskFlags.size > 0
                ? 'HIGH'
                : mediumUrgency
                        ? 'MEDIUM'
                        : 'LOW'

        const conflictingIntent = noPurchaseStrength > 0 && (
                purchaseStrength + transactionStrength + negotiationStrength > 10
        )
        let confidence = evidence.length === 0
                ? 0.25
                : 0.32 + Math.min(0.42, signalCodes.size * 0.055) + Math.min(0.14, Math.abs(probability - 35) / 300)
        if (repeatedRequest) confidence += 0.05
        if (conflictingIntent) confidence -= 0.12
        confidence = Math.round(clamp(confidence, 0.2, 0.94) * 100) / 100

        const requiresHumanAuthority = authoritySignal && (
                stage === 'NEGOTIATION' || stage === 'PURCHASE_INTENT' || probability >= 55
        )
        const latestText = latestUser?.content ?? ''
        const latestNormalized = normalizeSalesText(latestText)
        const latestInfoOnly = Boolean(firstMatch(latestNormalized, TERMS.informationOnly))
        const latestUserIsGreetingOrInfoOnly = !latestUser || isGreetingOnly(latestText) || (
                latestInfoOnly && stage === 'INFORMATION_GATHERING'
        )
        const consecutiveUnanswered = countConsecutiveUnanswered(messages)

        const recommendedAction = recommendNextAction({
                language,
                stage,
                objections,
                riskFlags,
                explicitHumanRequest,
                repeatedRequest,
                requiresHumanAuthority,
        })
        const leadLabel: Record<SalesLeadType, { fa: string; en: string }> = {
                UNCLEAR: { fa: 'هنوز نامشخص', en: 'not yet clear' },
                INFORMATION_SEEKER: { fa: 'بیشتر در حال جمع‌آوری اطلاعات', en: 'primarily gathering information' },
                BUYER: { fa: 'دارای نشانه‌های خرید', en: 'showing buying signals' },
                EXISTING_CUSTOMER: { fa: 'مشتری فعلی', en: 'an existing customer' },
                SUPPORT_SEEKER: { fa: 'در پی پشتیبانی', en: 'seeking support' },
        }
        const explanation = evidence.length === 0
                ? localize(
                        language,
                        'هنوز نشانه رفتاری کافی برای تشخیص قطعی وجود ندارد؛ این برآورد با پیام‌های بعدی دقیق‌تر می‌شود.',
                        'There is not enough behavioural evidence for a firm reading yet; this estimate will improve with later messages.',
                )
                : localize(
                        language,
                        `بر پایه ${evidence.length} نشانه رفتاری، مخاطب ${leadLabel[leadType].fa} است؛ احتمال تبدیل ${probability}٪ با اطمینان ${Math.round(confidence * 100)}٪ برآورد می‌شود.`,
                        `Based on ${evidence.length} observable signals, the contact is ${leadLabel[leadType].en}; estimated conversion probability is ${probability}% at ${Math.round(confidence * 100)}% confidence.`,
                )

        return {
                leadType,
                stage,
                buyerReadiness: readinessFor(probability, stage),
                buyerProbability: probability,
                sentiment,
                urgency,
                confidence,
                objections: Array.from(objections),
                riskFlags: Array.from(riskFlags),
                signalCodes: Array.from(signalCodes),
                evidence,
                recommendedAction,
                explanation,
                operational: {
                        explicitHumanRequest,
                        severeDistress,
                        requiresHumanAuthority,
                        repeatedRequest,
                        consecutiveUnanswered,
                        latestUserIsGreetingOrInfoOnly,
                        negativeSignalCount,
                },
        }
}

/** Load a single bounded snapshot used by both classification and handoff. */
export async function loadSalesConversationContext(
        conversationId: string,
): Promise<SalesConversationContext | null> {
        const conversation = await prisma.conversation.findUnique({
                where: { id: conversationId },
                select: {
                        id: true,
                        workspaceId: true,
                        workspace: { select: { businessType: true, language: true } },
                        agent: { select: { language: true, roleTemplate: true } },
                        _count: { select: { messages: true } },
                        messages: {
                                where: { role: { in: ['USER', 'ASSISTANT'] } },
                                orderBy: { createdAt: 'desc' },
                                take: SALES_INTELLIGENCE_MESSAGE_LIMIT,
                                select: {
                                        id: true,
                                        role: true,
                                        content: true,
                                        unanswered: true,
                                        createdAt: true,
                                },
                        },
                },
        })
        if (!conversation) return null
        return {
                conversationId: conversation.id,
                workspaceId: conversation.workspaceId,
                businessType: conversation.workspace.businessType,
                language: conversation.agent.language || conversation.workspace.language,
                roleTemplate: conversation.agent.roleTemplate,
                messageCount: conversation._count.messages,
                messages: conversation.messages.reverse(),
        }
}

/**
 * Persist only if this snapshot is at least as fresh as the stored one. This
 * prevents an older concurrent webhook from overwriting a newer analysis.
 */
export async function persistConversationSalesInsight(
        context: SalesConversationContext,
        analysis: SalesConversationAnalysis,
        options: PersistSalesInsightOptions = {},
): Promise<void> {
        const now = new Date()
        const common = {
                leadType: analysis.leadType,
                stage: analysis.stage,
                buyerReadiness: analysis.buyerReadiness,
                buyerProbability: analysis.buyerProbability,
                sentiment: analysis.sentiment,
                urgency: analysis.urgency,
                confidence: analysis.confidence,
                objections: analysis.objections,
                riskFlags: analysis.riskFlags,
                signalCodes: analysis.signalCodes,
                evidence: analysis.evidence as unknown as Prisma.InputJsonValue,
                recommendedAction: analysis.recommendedAction,
                explanation: analysis.explanation,
                modelVersion: SALES_INTELLIGENCE_VERSION,
                analyzedMessageCount: context.messageCount,
                analyzedAt: now,
                ...(options.handoffRecommended !== undefined
                        ? { handoffRecommended: options.handoffRecommended }
                        : {}),
                ...(options.handoffReasonCodes !== undefined
                        ? { handoffReasonCodes: options.handoffReasonCodes }
                        : {}),
        }

        const updated = await prisma.conversationSalesInsight.updateMany({
                where: {
                        conversationId: context.conversationId,
                        analyzedMessageCount: { lte: context.messageCount },
                },
                data: common,
        })
        if (updated.count > 0) return

        try {
                await prisma.conversationSalesInsight.create({
                        data: {
                                workspaceId: context.workspaceId,
                                conversationId: context.conversationId,
                                ...common,
                        },
                })
        } catch (error) {
                // A concurrent create won. Apply only when our snapshot is not stale.
                if (
                        typeof error === 'object' &&
                        error !== null &&
                        'code' in error &&
                        (error as { code?: string }).code === 'P2002'
                ) {
                        await prisma.conversationSalesInsight.updateMany({
                                where: {
                                        conversationId: context.conversationId,
                                        analyzedMessageCount: { lte: context.messageCount },
                                },
                                data: common,
                        })
                        return
                }
                throw error
        }
}

/** Best-effort public helper for inbound-only or operator-owned turns. */
export async function refreshConversationSalesInsight(
        conversationId: string,
        options: PersistSalesInsightOptions = {},
): Promise<SalesConversationAnalysis | null> {
        const context = await loadSalesConversationContext(conversationId)
        if (!context) return null
        const analysis = analyzeSalesConversation({
                messages: context.messages,
                businessType: context.businessType,
                language: context.language,
                roleTemplate: context.roleTemplate,
        })
        await persistConversationSalesInsight(context, analysis, options)
        return analysis
}

export interface SalesInsightBackfillResult {
        processed: number
        failed: number
        hasMore: boolean
}

/**
 * Backfill the most recently active historical conversations in a small,
 * workspace-scoped batch. Four workers cap database pressure; callers can
 * invoke another batch only when `hasMore` is true.
 */
export async function backfillWorkspaceSalesInsights(
        workspaceId: string,
        requestedLimit = 20,
): Promise<SalesInsightBackfillResult> {
        const limit = Math.round(clamp(requestedLimit, 1, 50))
        const conversations = await prisma.conversation.findMany({
                where: {
                        workspaceId,
                        salesInsight: { is: null },
                        messages: { some: { role: 'USER' } },
                },
                orderBy: [
                        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
                        { updatedAt: 'desc' },
                ],
                take: limit + 1,
                select: { id: true },
        })
        const hasMore = conversations.length > limit
        const queue = conversations.slice(0, limit)
        let processed = 0
        let failed = 0
        let cursor = 0

        const worker = async () => {
                while (cursor < queue.length) {
                        const index = cursor
                        cursor += 1
                        try {
                                const analysis = await refreshConversationSalesInsight(queue[index].id)
                                if (analysis) processed += 1
                                else failed += 1
                        } catch (error) {
                                failed += 1
                                console.error('[sales-intelligence] historical backfill failed:', error)
                        }
                }
        }
        await Promise.all(Array.from({ length: Math.min(4, queue.length) }, () => worker()))
        return { processed, failed, hasMore }
}
