/**
 * Test support: the regex detectors that used to stand in for a reading.
 * Production code takes these signals only from the verified reading of the
 * turn; flow tests use this to turn a Persian test message into the same
 * signals without calling a model.
 */
import { normalizeOrderText } from "./order-capture"

export type CartEditCue = 'add' | 'remove' | 'change'

export const CART_ADD_RE =
  /(?:اضافه\s?(?:کن|کنید|کنین|بشه|می\s?کنی|میکنی|کنی)|(?:^|\s)هم\s(?:می\s?خوام|میخوام|میخام|بذار|بزار|بفرست|بده|اضافه|بخرم|می\s?خرم|میخرم)|(?:^|\s)(?:اینم|اونم|اینو\s?هم|اونو\s?هم|یکی\s?هم|یه\s?دونه\s?هم)(?:\s|$)|به\s?سبد|تو\s?سبد\s?(?:بذار|بزار)|(?:^|\s)add\s|(?:^|\s)also\s+(?:want|add|get)|as\s+well)/u

export const CART_REMOVE_RE =
  /(?:حذف(?:ش)?\s?(?:کن|کنید|کنین|بشه)|برش\s?(?:دار|دارید)|بردار(?:ید|ین)?(?:\s|$)|(?:رو|را|و)\s(?:نمی\s?خوام|نمیخوام|نمیخام)|از\s?سبد\s?(?:دربیار|بردار|حذف|در\s?بیار)|(?:^|\s)remove\s|take\s+(?:out|off)|(?:^|\s)drop\s)/u

export const CART_CHANGE_RE =
  /(?:(?:عوض|تغییر)\s?(?:کن|کنید|کنین|بده|بدید|بشه)|به\s?جا(?:ی|ش)|(?:^|\s)(?:تعداد(?:ش|شو|ش\s?رو)?)\s|(?:\d+|دو|سه|چهار|پنج|شش|یه|یک)\s?(?:تا|عدد|دونه)\s?(?:کن|بشه|باشه|بذار|بزار|کنید)|(?:^|\s)(?:یکی|یدونه)\s?(?:کن|بشه|باشه|کمش\s?کن)|(?:رنگ|سایز|طرح|مدل)(?:ش|شو|ش\s?رو)?\s.+\s(?:کن|باشه|بشه)|(?:^|\s)(?:change|instead|make\s+it)\s)/u

/** Does this message edit the cart (and how, roughly)? */
export function detectCartEditCue(message: string): CartEditCue | null {
  const text = normalizeOrderText(message)
  if (!text) return null
  if (CART_REMOVE_RE.test(text)) return 'remove'
  if (CART_ADD_RE.test(text)) return 'add'
  if (CART_CHANGE_RE.test(text)) return 'change'
  return null
}
