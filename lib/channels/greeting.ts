/**
 * Greeting fast-path.
 *
 * A bare «سلام» (or its English sibling) carries zero sales intent, yet the
 * full pipeline used to run for it: RAG retrieval, the model round-trip and a
 * reserved AI credit — just to hear «سلام! چطور می‌تونم کمکتون کنم؟». This
 * module recognizes greeting-only turns locally so the channel handler can
 * welcome the customer without touching the AI budget.
 *
 * The detector is deliberately conservative:
 *  - short messages only (≤ 5 tokens, ≤ 60 chars),
 *  - every token must belong to the greeting/politeness vocabulary,
 *  - anything question-like or product-like («سلام قیمت محصول چنده؟»)
 *    falls through to the normal AI turn.
 */

const GREETING_TOKENS = new Set([
        // Persian greetings
        'سلام',
        'درود',
        'مرحبا',
        'سلامعلیکم',
        'السلامعلیکم',
        'علیکسلام',
        // Time-of-day formulas (tokens so «وقت بخیر» and «صبحتون بخیر» both work)
        'وقت',
        'وقتتون',
        'وقتتان',
        'بخیر',
        'صبح',
        'صبحتون',
        'صبحتان',
        'عصر',
        'عصرتون',
        'عصرتان',
        'شب',
        'شبتون',
        'شبتان',
        // Politeness small-talk that may accompany a bare greeting
        'بر',
        'شما',
        'خوبی',
        'خوبین',
        'خوبید',
        'خوبهستید',
        'خوبهستین',
        'چطوری',
        'چطورین',
        'چطورید',
        'چه',
        'خبر',
        'خبرتون',
        'خبرتان',
        // Latin script
        'hello',
        'hi',
        'hey',
        'there',
        'salam',
        'salaam',
        'salaam',
        'dorood',
        'drood',
        'good',
        'morning',
        'evening',
        'afternoon',
])

/** Upper bounds keep «سلام من دنبال قیمت محصول فلان هستم» out of the fast path. */
const MAX_GREETING_TOKENS = 5
const MAX_GREETING_CHARS = 60

export function isGreetingOnlyMessage(rawText: string): boolean {
        const text = (rawText ?? '').trim()
        if (!text || text.length > MAX_GREETING_CHARS) return false

        const normalized = normalizeGreetingText(text)
        if (!normalized) return false

        const tokens = normalized.split(/[\s\u200c]+/).filter(Boolean)
        if (tokens.length === 0 || tokens.length > MAX_GREETING_TOKENS) return false

        return tokens.every((token) => GREETING_TOKENS.has(token))
}

function normalizeGreetingText(text: string): string {
        return text
                .toLocaleLowerCase('fa')
                // Arabic variants → Persian equivalents.
                .replace(/[أإآ]/g, 'ا')
                .replace(/ة/g, 'ه')
                .replace(/[ىي]/g, 'ی')
                .replace(/ك/g, 'ک')
                // Arabic diacritics.
                .replace(/[\u064B-\u065F\u0670]/g, '')
                // Persian/Arabic and ASCII punctuation.
                .replace(/[.،,!?؟:؛;()"\-_/\\~*+#«»]+/g, ' ')
                // Emoji / pictographs / symbols — keep only letters, digits, spaces, ZWNJ.
                .replace(/[^\p{L}\p{N}\s\u200c]/gu, ' ')
                .replace(/\s+/g, ' ')
                .trim()
}

/**
 * Resolve the outbound welcome text for a greeting-only turn (A2).
 *
 * Precedence:
 *   1. the agent's configured `welcomeMessage` (dashboard settings),
 *   2. the channel's configured welcome (e.g. Instagram automation settings),
 *   3. a warm default that greets with the business name when known,
 *   4. the generic canned default.
 *
 * `hasPriorReply` keeps the short follow-up acknowledgement («سلام.») so a
 * repeated greeting inside an ongoing thread stays natural.
 */
export function greetingReplyText(
        firstMessage: string,
        hasPriorReply = false,
        options?: {
                configuredWelcome?: string | null
                channelWelcome?: string | null
                businessName?: string | null
        },
): string {
        const configured = options?.configuredWelcome?.trim()
                || options?.channelWelcome?.trim()
                || ''
        // Latin-script message → reply in English; otherwise Persian wins.
        const english = /^[\x00-\x7F\s]+$/.test(firstMessage)

        if (hasPriorReply) {
                if (configured) return configured
                return english ? 'Hello.' : 'سلام.'
        }

        if (configured) return configured

        if (english) {
                return options?.businessName
                        ? `Hello! 👋 Welcome to ${options.businessName}. How can I help you today?`
                        : 'Hello! 👋 Welcome. How can I help you today?'
        }

        return options?.businessName
                ? `سلام! به ${options.businessName} خوش اومدی، امروز چه کمکی ازم بگیرم؟`
                : 'سلام! 👋 خوش آمدید. چطور می‌تونم کمکتون کنم؟'
}

/**
 * Inbox-visible placeholder for media-only inbound messages (A13). The model
 * never sees this text as a question — it only labels the stored USER row so
 * the operator can tell what the customer actually sent.
 */
export function mediaPlaceholderText(msg: {
        voiceFileId?: string
        mediaKind?: 'photo' | 'video' | 'voice' | 'sticker' | 'file' | 'audio'
}): string {
        if (msg.voiceFileId) return '[پیام صوتی]'
        switch (msg.mediaKind) {
                case 'photo': return '[عکس]'
                case 'video': return '[ویدیو]'
                case 'sticker': return '[استیکر]'
                case 'file': return '[فایل]'
                case 'voice': return '[پیام صوتی]'
                case 'audio': return '[فایل صوتی]'
                default: return '[پیام رسانه‌ای]'
        }
}

