/**
 * The opening message of a comment→DM reply.
 *
 * Instagram gives a business ONE message (the private reply) to a commenter
 * who has not written to the page in the last 24 hours; every message after
 * it is rejected until the person writes or taps a button. A reply that needs
 * more than that one message therefore starts with a short button message, and
 * the rest is sent when the commenter taps it.
 *
 * Pure and import-free: the automation engine decides with it at send time
 * and the scenario form uses the same rule to tell the operator, while they
 * build the reply, whether the opener will be used.
 */

/** Longest text one Instagram message carries. The adapter splits at exactly
 *  this length, so anything longer leaves as two messages — and a private
 *  reply only delivers the first. */
export const IG_SINGLE_TEXT_LIMIT = 900
/** Longest body of a button message. */
export const IG_BUTTON_TEXT_LIMIT = 640
/** Instagram trims button titles to this many characters. */
export const IG_BUTTON_TITLE_LIMIT = 20

export const DEFAULT_OPENER_TEXT = 'سلام 👋\nبرای دریافت پیام، روی دکمهٔ زیر بزنید 👇'
export const DEFAULT_OPENER_BUTTON = 'مشاهده'

type OpenerEntry = {
  type: string
  text?: string
  buttonType?: string
}

/**
 * True when the whole reply is the ONE message a private reply allows: a
 * single text (short enough not to be split) or a single button message.
 * Media, product cards and anything in two parts need the messaging window.
 */
export function fitsOnePrivateReply(entries: readonly OpenerEntry[]): boolean {
  if (entries.length !== 1) return false
  const [entry] = entries
  const length = (entry.text ?? '').trim().length
  if (entry.type === 'TEXT') return length > 0 && length <= IG_SINGLE_TEXT_LIMIT
  if (entry.type === 'QUICK_REPLY') {
    return length <= (entry.buttonType === 'quick_reply' ? IG_SINGLE_TEXT_LIMIT : IG_BUTTON_TEXT_LIMIT)
  }
  return false
}
