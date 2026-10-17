/**
 * Bare one-word replies («بله», «نه», «باشه», «مرسی») carry meaning only
 * next to the question they answer. Stored on their own — as a slot value,
 * a customer detail or a «request» line in a handoff summary — they read as
 * noise («شهر: بله») and can overwrite the real value the customer confirmed.
 *
 * A closed word list matched against the whole message, never a pattern
 * searched inside it: «بله آبی» or «شنزن» are content, not a bare reply.
 */
import { normalizeEvidenceText } from '@/lib/agent/parsers/evidence'

export type BareReplyKind = 'yes' | 'no' | 'ack'

const YES = new Set([
  'بله', 'بلی', 'آره', 'اره', 'آری', 'اوهوم', 'درسته', 'درست', 'صحیحه', 'دقیقا', 'دقیقاً', 'همینه', 'همونه', 'حتما', 'حتماً',
  'yes', 'yeah', 'yep', 'yup', 'sure', 'correct', 'right', 'exactly',
])
const NO = new Set(['نه', 'نخیر', 'خیر', 'نچ', 'no', 'nope', 'nah'])
const ACK = new Set([
  'باشه', 'باشد', 'اوکی', 'اوکیه', 'اوک', 'ok', 'okay', 'k', 'مرسی', 'ممنون', 'ممنونم', 'متشکرم', 'مچکرم', 'سپاس', 'تشکر', 'thanks', 'thx',
])
const PUNCTUATION = new Set(Array.from('!,.،؛:;؟?-–—«»"\'()[]…'))
const PICTOGRAPH = /[\p{Extended_Pictographic}‍️]/u

function words(value: string): string[] {
  return Array.from(normalizeEvidenceText(value))
    .map((char) => (PUNCTUATION.has(char) || PICTOGRAPH.test(char) ? ' ' : char))
    .join('')
    .split(' ')
    .filter(Boolean)
}

/** «بله»، «نه ممنون»، «اوکی مرسی» → its kind; anything with real content → null. */
export function bareReplyKind(value: string): BareReplyKind | null {
  const list = words(value)
  if (!list.length || list.length > 3) return null
  if (list.join(' ') === 'thank you') return 'ack'
  const kinds = list.map((word) => (YES.has(word) ? 'yes' : NO.has(word) ? 'no' : ACK.has(word) ? 'ack' : null))
  if (kinds.some((kind) => kind === null)) return null
  if (kinds.includes('no')) return 'no'
  if (kinds.includes('yes')) return 'yes'
  return 'ack'
}

/** Digit-, case-, spelling- and punctuation-insensitive form for "is this already said?" checks. */
export function comparableText(value: string): string {
  return words(value).join(' ')
}

/** Trim separators («، »، «: »، « - ») left at either end after cutting a part out. */
export function trimSeparators(value: string): string {
  const chars = Array.from(value)
  const isEdge = (char: string) => PUNCTUATION.has(char) || char.trim() === ''
  let start = 0
  let end = chars.length
  while (start < end && isEdge(chars[start])) start += 1
  while (end > start && isEdge(chars[end - 1])) end -= 1
  return chars.slice(start, end).join('').split(' ').filter(Boolean).join(' ')
}
