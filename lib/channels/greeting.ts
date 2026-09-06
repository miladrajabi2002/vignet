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

/** Localized canned welcome — short, warm, and asking for the real question. */
export function greetingReplyText(firstMessage: string, hasPriorReply = false): string {
        // Latin-script message → reply in English; otherwise Persian wins.
        if (/^[\x00-\x7F\s]+$/.test(firstMessage)) {
                if (hasPriorReply) return 'Hello.'
                return 'Hello! 👋 Welcome. How can I help you today?'
        }
        if (hasPriorReply) return 'سلام.'
        return 'سلام! 👋 خوش آمدید. چطور می‌تونم کمکتون کنم؟'
}
