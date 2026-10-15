/**
 * The forwarding rule's filter, read from one sample deposit SMS the owner
 * pastes during setup.
 *
 * The forwarder app (Android) or Shortcuts (iPhone) sends a message only when
 * its text CONTAINS the filter, letter for letter. Banks do not all spell the
 * same: Bank Melli writes «اينترنت» with the Arabic «ي», so a filter typed on
 * a Persian keyboard would never match. The filter is therefore always the
 * bank's own text, cut out of the sample, never retyped.
 *
 * Two candidates are read:
 *   • account — the account number the deposit lands in, with its label as
 *               printed («حساب8907027623»): no other message on the phone
 *               carries it, so it is the filter whenever the bank prints one;
 *   • word    — the transaction's fixed word («واریز», «انتقال», «نشست»…):
 *               the filter when the message has no account number.
 *
 * A small model reads the sample (a few hundred tokens); its answer counts
 * only if it is found in the sample itself, and the plain rules below stand
 * in when the model is unavailable or answers nothing usable.
 */
import { toEnglishDigits } from '@/lib/phone'
import { captureError } from '@/lib/errors/capture'
import { auxCompletion } from '@/lib/ai/llm/aux'
import { parseBankSms, type BankSmsKind } from '@/lib/payments/card/sms-parse'

export interface SmsSampleReading {
  kind: BankSmsKind
  amountRial: number | null
  /** The deposit word exactly as the bank prints it. */
  word: string | null
  /** The account number exactly as the bank prints it. */
  account: string | null
  /** The one text the forwarding rule matches on; null when nothing usable was found. */
  filter: string | null
  /** The bank uses Arabic «ي»/«ك» in the filter: it must be copied, not typed. */
  arabicLetters: boolean
  source: 'ai' | 'rules'
}

/** Transaction words of incoming money, most specific first. */
const DEPOSIT_WORDS = ['واریز', 'بستانکار', 'نشست', 'افزایش', 'انتقال'] as const
const ACCOUNT_LABEL = /(?:حساب|سپرده|ش\.?\s?ح|account|acc)\s*(?:شماره|ش)?\s*[:：.]?\s*/gi
const ACCOUNT_VALUE = /^[\d][\d.\-*/]{4,}[\d*]/

/**
 * One character in, one character out (unlike normalizeSms, which drops
 * «\r»), so a position in the folded text is the same position in the raw one.
 */
export function foldSms(raw: string): string {
  return toEnglishDigits(raw)
    .replace(/ي/g, 'ی')
    .replace(/ى/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌‎‏‪-‮⁦-⁩\r]/g, ' ')
    .replace(/[٬،]/g, ',')
}

/** The bank's own spelling of `needle`, cut out of `raw`; null when it is not there. */
export function anchorInSms(raw: string, needle: string | null | undefined): string | null {
  const wanted = foldSms((needle ?? '').trim())
  if (!wanted) return null
  const at = foldSms(raw).indexOf(wanted)
  return at === -1 ? null : raw.slice(at, at + wanted.length)
}

function digitCount(value: string): number {
  return (toEnglishDigits(value).match(/\d/g) ?? []).length
}

/** A word filter: a letters-only run of one or two words. */
function usableWord(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (trimmed.length < 3 || trimmed.length > 24 || /[\d:+\-]/.test(toEnglishDigits(trimmed))) return null
  if (/مانده|موجودی|حساب|بانک|تاریخ/.test(foldSms(trimmed))) return null
  return trimmed.split(/\s+/).length <= 2 ? trimmed : null
}

/** An account filter: at least six digits, not the amount, not the balance. */
function usableAccount(value: string | null, sms: string, amountRial: number | null): string | null {
  if (!value) return null
  const trimmed = value.trim().replace(/[.\-/]+$/, '')
  if (digitCount(trimmed) < 6 || /\s/.test(trimmed)) return null
  const digits = toEnglishDigits(trimmed).replace(/\D/g, '')
  if (amountRial != null && (digits === String(amountRial) || digits === String(Math.floor(amountRial / 10)))) return null
  // Never a number that sits after «مانده»/«موجودی» (the balance).
  const folded = foldSms(sms)
  const at = folded.indexOf(foldSms(trimmed))
  if (at > 0 && /(?:مانده|موجودی)\s*[:：]?\s*$/.test(folded.slice(Math.max(0, at - 14), at))) return null
  return trimmed
}

/** The plain reading: the first deposit word and the number after «حساب»/«سپرده». */
export function readSampleRules(raw: string): { word: string | null; account: string | null } {
  const folded = foldSms(raw)
  let word: string | null = null
  for (const candidate of DEPOSIT_WORDS) {
    const at = folded.indexOf(candidate)
    if (at !== -1) {
      word = raw.slice(at, at + candidate.length)
      break
    }
  }
  let account: string | null = null
  for (const label of folded.matchAll(ACCOUNT_LABEL)) {
    const start = (label.index ?? 0) + label[0].length
    const value = ACCOUNT_VALUE.exec(folded.slice(start))
    if (value) {
      account = raw.slice(start, start + value[0].length)
      break
    }
  }
  return { word, account }
}

const FILTER_MAX = 40

/**
 * The forwarding rule's text: the account with the label right before it
 * («حساب8907027623», «حساب:152601422685») as one run of the bank's text, the
 * account alone when it has no label, else the deposit word.
 */
export function chooseFilter(raw: string, word: string | null, account: string | null): string | null {
  if (account) {
    const at = raw.indexOf(account)
    if (at !== -1) {
      const before = foldSms(raw.slice(Math.max(0, at - 14), at))
      const label = /(?:شماره\s*)?(?:حساب|سپرده)\s?[:：.]?\s?$/.exec(before)
      const filter = label ? raw.slice(at - label[0].length, at + account.length) : account
      if (filter.length <= FILTER_MAX && !/\n/.test(filter)) return filter
    }
    return account.length <= FILTER_MAX ? account : null
  }
  return word
}

const SYSTEM_PROMPT = [
  'You read ONE Iranian bank SMS that reports money coming into an account.',
  'Reply with STRICT JSON only: {"word": <string|null>, "account": <string|null>}',
  '- "word": the fixed Persian word that names the transaction as incoming money, copied exactly as written in the SMS (keep its letters, e.g. Arabic ي stays ي). Only the transaction type, not the channel: for «انتقال اينترنت:+2,000» answer «انتقال». Typical: واریز, انتقال, نشست, افزایش, بستانکار. Never a number, date, bank name, «مانده» or «حساب». null if there is none.',
  '- "account": the account / deposit number (after حساب or سپرده) exactly as printed, with any dots, dashes or asterisks. Never the amount, the balance (مانده), a card number, a date or a time. null if absent.',
  '- Copy from the SMS; never invent. JSON only, no markdown.',
].join('\n')

function jsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    const value = JSON.parse(cleaned.slice(start, end + 1)) as unknown
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export async function readSmsSample(workspaceId: string, raw: string): Promise<SmsSampleReading> {
  const text = raw.trim().slice(0, 600)
  const parsed = parseBankSms(text)
  const base = { kind: parsed.kind, amountRial: parsed.amountRial }
  // A message with a password never leaves the server, not even to the model.
  if (parsed.kind === 'secret' || !text) return { ...base, word: null, account: null, filter: null, arabicLetters: false, source: 'rules' }

  const rules = readSampleRules(text)
  let source: SmsSampleReading['source'] = 'rules'
  let word = usableWord(rules.word)
  let account = usableAccount(rules.account, text, parsed.amountRial)
  try {
    const result = await auxCompletion({
      purpose: 'sms_keyword',
      workspaceId,
      // The balance is already masked in `redacted`; the model does not need it.
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: parsed.redacted || text }],
      maxTokens: 60,
      timeoutMs: 10_000,
      retries: 0,
    })
    const answer = jsonObject(result.content)
    if (answer) {
      const aiWord = usableWord(anchorInSms(text, typeof answer.word === 'string' ? answer.word : null))
      const aiAccount = usableAccount(anchorInSms(text, typeof answer.account === 'string' ? answer.account : null), text, parsed.amountRial)
      if (aiWord || aiAccount) source = 'ai'
      word = aiWord ?? word
      account = aiAccount ?? account
    }
  } catch (error) {
    // No key, no budget, a timeout: the rules' reading stands.
    if (!(error instanceof Error && error.name === 'AuxUnavailableError')) captureError('cardpay:sms-sample', error, { workspaceId })
  }
  // A withdrawal is not what the rule is for: no filter from it.
  const filter = parsed.kind === 'withdraw' ? null : chooseFilter(text, word, account)
  return { ...base, word, account, filter, arabicLetters: /[يك]/.test(filter ?? ''), source }
}
