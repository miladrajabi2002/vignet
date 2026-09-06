/**
 * Final-reply post-processing (A5).
 *
 * Persian messenger replies conventionally drop the trailing period: «الان چک
 * می‌کنم» reads natural while «الان چک می‌کنم.» feels stiff and bot-like. This
 * strips trailing full stops from short, single-paragraph Persian replies
 * right before persistence/delivery, so every channel (Telegram, Instagram,
 * Rubika, web widget, API) shares one canonical output.
 *
 * Deliberately conservative — the following stay untouched:
 *   • replies without any Persian/Arabic script (English, numbers, links)
 *   • multi-line replies and anything that looks like a list (bullets,
 *     numbered lines, markdown headers) — lists keep their terminal punctuation
 *   • long replies (> 480 chars) — usually structured content, not chat prose
 *   • ellipses mid-sentence and every other character (؟ ! … ‌) are preserved
 */

const PERSIAN_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/
const LIST_LINE = /^\s*(?:[-*•·–—]|\d+[.)]|[۰-۹]+[.)]|#{1,6}\s)/
const TRAILING_PERIODS = /[\s\u200c]*[.。．]+$/g

export function stripTrailingPersianPeriod(reply: string): string {
        const text = (reply ?? '').trimEnd()
        if (!text) return reply

        // Must contain Persian/Arabic script to qualify.
        if (!PERSIAN_SCRIPT.test(text)) return reply

        // Keep lists and structured/markdown content intact.
        const lines = text.split(/\n/)
        if (lines.length > 2) return reply
        if (lines.some((line) => LIST_LINE.test(line))) return reply

        // Only short conversational prose.
        if (text.length > 480) return reply

        // Preserve URLs / decimals at the very end — a trailing dot there is
        // part of data, not sentence punctuation. Digits/latin directly before
        // the period block disqualify the strip.
        if (/[A-Za-z0-9\u06F0-\u06F9]\u200c?\.$/.test(text)) return reply

        const stripped = text.replace(TRAILING_PERIODS, '')
        // Re-trim: the strip may expose trailing ZWNJ/space.
        return stripped.trimEnd() || reply
}
