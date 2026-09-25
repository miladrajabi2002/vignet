/**
 * Humanizer polish — removes AI-writing tells from outgoing replies without
 * changing what they say, and instructs the model to stop producing them.
 *
 * Two complementary layers:
 *   1. Prompt instruction (humanizerPolishInstruction) — generation-time
 *      prevention. Kept compact (~90 tokens) so the input-token cost stays
 *      negligible on every reply of every agent.
 *   2. Deterministic postprocessor (enforceHumanizerPolish) — only safe,
 *      meaning-preserving transforms: repeated punctuation collapse, stray
 *      space before punctuation, decorative emoji-burst trimming. Language
 *      level tells («نه فقط… بلکه», forced triads, stock adjectives,
 *      dramatic closers) are DETECTED and reported as codes but never
 *      rewritten by regex — rewriting meaning is the model's job (layer 1),
 *      not a heuristic's.
 *
 * Platform-wide kill switch: AI_HUMANIZER_DISABLE=1 (checked by the kernel
 * registry when the skill plan is compiled, so both layers turn off).
 */

export const HUMANIZER_SKILL_VERSION = '1.0.0'

/** Fenced code content is data — never reformat it. */
const FENCE_RE = /```|~~~/

/** Cosmetic trims only apply to short chat prose, not structured content. */
const SHORT_REPLY_MAX = 240

const LIST_LINE = /^\s*(?:[-*•·–—]|\d+[.)]|[۰-۹]+[.)])/

// Repeated terminal/interior punctuation runs («!!!» → «!»). Same-character
// runs only: URLs, decimals and ellipses stay intact.
const REPEATED_TERMINAL_PUNCT = /([!؟?،,؛;:])(?:[\s]*\1)+/gu
// Stray space before punctuation («سلام !» → «سلام!»).
const SPACE_BEFORE_PUNCT = /[ \t\u200c]+([،؛:!؟?,])/gu

// One emoji sequence, ZWJ chains (family, flags, skin tones) kept whole.
const EMOJI_SEQ = String.raw`\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*`
const EMOJI_BURST_START = new RegExp(`^[\\s\\u200c]*(?:${EMOJI_SEQ})[\\s\\u200c]*(?:(?:${EMOJI_SEQ})[\\s\\u200c]*)+`, 'u')
const EMOJI_BURST_END = new RegExp(`(?:(?:[\\s\\u200c]*)${EMOJI_SEQ}){2,}[\\s\\u200c]*$`, 'u')
const EMOJI_SEQ_GLOBAL = new RegExp(EMOJI_SEQ, 'gu')

// ── Detection-only patterns (codes, never mutations) ─────────────────────
// §1 of the humanizer skill: the “not-X-but-Y” staging contrast (both the
// «نه فقط… بلکه» and the «فقط X نیستیم، بلکه» variants).
const NOT_X_BUT_Y = /(?:نه\s?فقط|نه\s?تنها)[^.!؟\n]{0,120}بلکه|(?:فقط|تنها|صرفاً)[^.!؟\n]{0,80}نیست(?:یم|م)?[،,]?[^.!؟\n]{0,30}بلکه/
// §6: three bolded labels in a row («**کیفیت**، **سرعت**، **اعتماد**»).
const FORCED_TRIAD = /(?:\*\*[^*\n]{1,48}\*\*[،,\s]*){3}/
// §12: stock AI adjectives — two or more distinct ones in one short reply.
const STOCK_WORDS = [
  'بی‌نظیر', 'بی نظیر', 'بی‌بدیل', 'منحصر‌به‌فرد', 'خیره‌کننده', 'شگفت‌انگیز',
  'دگرگون', 'متحول', 'نوآورانه', 'بی‌رقیب', 'افسانه‌ای', 'یگانه',
]
// §2: a dramatic one-line closer repeating the point («رضایت شما، موفقیت ماست»).
const DRAMATIC_CLOSER = /(?:^|[.!؟!\s\u200c])(?:رضایت شما|موفقیت شما|همراه شما|انتخاب شما)[^.\n؟!]{0,24}[.!?؟]*\s*$/u

export interface HumanizerPolishResult {
  reply: string
  /** Machine-readable trace of detected/applied tells (tests, observability). */
  codes: string[]
}

function looksLikeList(text: string): boolean {
  return text.split('\n').some((line) => LIST_LINE.test(line))
}

export function enforceHumanizerPolish(params: { reply: string; isFa?: boolean }): HumanizerPolishResult {
  const reply = params.reply ?? ''
  if (!reply) return { reply, codes: [] }
  const isFa = params.isFa ?? true
  const codes: string[] = []

  // 1. Detection only — the reply is never rewritten for these here.
  if (isFa) {
    if (NOT_X_BUT_Y.test(reply)) codes.push('HUMANIZER_NOT_X_BUT_Y')
    if (STOCK_WORDS.filter((word) => reply.includes(word)).length >= 2) codes.push('HUMANIZER_STOCK_WORDS')
    if (DRAMATIC_CLOSER.test(reply)) codes.push('HUMANIZER_DRAMATIC_CLOSER')
  }
  if (FORCED_TRIAD.test(reply)) codes.push('HUMANIZER_FORCED_TRIAD')

  // 2. Deterministic formatting fixes. Fenced content is untouched.
  if (FENCE_RE.test(reply)) return { reply, codes }

  let output = reply
    .replace(REPEATED_TERMINAL_PUNCT, '$1')
    .replace(SPACE_BEFORE_PUNCT, '$1')
  if (output !== reply) codes.push('HUMANIZER_PUNCT_COLLAPSED')

  // 3. Emoji bursts (2+ back-to-back) trim to a single emoji — only at the
  //    very start/end of short, non-list chat prose. Whitespace that separated
  //    the burst from the text is preserved as a single space.
  if (output.length <= SHORT_REPLY_MAX && !looksLikeList(output)) {
    const startBurst = output.match(EMOJI_BURST_START)
    if (startBurst) {
      const burstText = startBurst[0]
      const first = burstText.match(EMOJI_SEQ_GLOBAL)?.[0] ?? ''
      const hadGap = /[\s\u200c]$/.test(burstText)
      output = `${first}${hadGap ? ' ' : ''}${output.slice(burstText.length)}`
      codes.push('HUMANIZER_EMOJI_BURST')
    }
    const endBurst = output.match(EMOJI_BURST_END)
    if (endBurst) {
      const burstText = endBurst[0]
      const first = burstText.match(EMOJI_SEQ_GLOBAL)?.[0] ?? ''
      const hadGap = /^[\s\u200c]/.test(burstText)
      const base = output.slice(0, output.length - burstText.length).trimEnd()
      output = `${base}${hadGap ? ' ' : ''}${first}`
      codes.push('HUMANIZER_EMOJI_BURST')
    }
  }

  return { reply: codes.length ? output : reply, codes }
}

/** Generation-time prevention block, appended to every kernel system prompt. */
export function humanizerPolishInstruction(isFa: boolean): string {
  return isFa
    ? [
        '### پرهیز از نوشتار هوش‌مصنوعی‌گونه',
        '• از الگوی «نه فقط X، بلکه Y» و جمله‌پایانی دراماتیک («رضایت شما، موفقیت ماست») استفاده نکن.',
        '• صفت‌های تبلیغاتی کلی («بی‌نظیر»، «خیره‌کننده»، «شگفت‌انگیز») ننویس؛ به‌جای صفت، داده یا مشخصهٔ واقعی بده.',
        '• سه‌گانهٔ تزئینی («کیفیت، سرعت، اعتماد») و بولدکردن چند واژه در یک پاسخ ممنوع؛ حداکثر یک تأکید.',
        '• علامت تکراری («!!!»، «؟؟») یا ردیف ایموجی نگذار؛ حداکثر یک ایموجی و فقط وقتی واقعاً مناسب است.',
      ].join('\n')
    : [
        '### Avoid AI-sounding writing',
        '• No “not only X, but Y” contrasts and no dramatic one-line closers that just restate the point.',
        '• No inflated stock adjectives (“amazing”, “unparalleled”); give a real spec or fact instead.',
        '• No forced triads and no bolding several words in one reply; at most one emphasis.',
        '• No repeated punctuation (“!!!”, “??”) or emoji runs; at most one emoji, only when it truly fits.',
      ].join('\n')
}
