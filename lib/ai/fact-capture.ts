import { prisma } from '@/lib/prisma'
import { applyEvidenceFact } from '@/lib/ai/memory-evidence'

/**
 * Automatic capture of durable facts the customer states in conversation,
 * on ANY channel. Complements the human-in-the-loop improvement flow:
 * suggestions stay the high-precision path, while these deterministic,
 * zero-LLM patterns catch the high-value identity facts customers drop
 * naturally («من تهرانم», «آدرسم ...») without anyone promoting them.
 *
 * Precision beats recall here: a wrong fact is worse than a missing one,
 * because the agent then «knows» something false about the customer on every
 * channel. So a fact is captured only from a FIRST-PERSON STATEMENT clause:
 *   • questions («تو کرج هستید؟», «ارسال به تهران چند روزه؟») never count;
 *   • clauses about the business («شعبه/نمایندگی/فروشگاهتون تو تهران») never count;
 *   • a city must be a known Iranian city, an address needs a possessive
 *     («آدرسم/آدرس من») plus street-like content — «آدرس فروشگاهتون کجاست؟»
 *     is the shop's address, not the customer's.
 *
 * The customer's own newest statement supersedes an older value of the same
 * key («الان دیگه مشهد زندگی می‌کنم»); the old value stays in the audit trail.
 */

const IRANIAN_CITIES = [
  'تهران', 'مشهد', 'اصفهان', 'شیراز', 'تبریز', 'کرج', 'قم', 'اهواز',
  'رشت', 'کرمانشاه', 'ارومیه', 'زاهدان', 'همدان', 'کرمان', 'یزد', 'اردبیل',
  'بندرعباس', 'اراک', 'زنجان', 'سنندج', 'قزوین', 'خرم‌آباد', 'خرم آباد', 'گرگان', 'ساری',
  'بجنورد', 'بوشهر', 'شهرکرد', 'بیرجند', 'ایلام', 'یاسوج', 'خوی', 'کاشان',
  'نجف‌آباد', 'نجف آباد', 'ملایر', 'مراغه', 'قائم‌شهر', 'قائمشهر', 'تنکابن', 'سمنان', 'شاهرود',
  'دزفول', 'آبادان', 'مرند', 'نیشابور', 'سبزوار', 'آمل', 'بابل', 'بابلسر', 'چالوس',
  'لامرد', 'جهرم', 'مرودشت', 'داراب', 'کیش', 'قشم', 'بم', 'رفسنجان', 'سیرجان',
  'اسلامشهر', 'شهریار', 'پردیس', 'پرند', 'ورامین', 'پاکدشت', 'لواسان', 'دماوند',
  'بروجرد', 'اندیمشک', 'شوشتر', 'ماهشهر', 'لاهیجان', 'انزلی', 'بندر انزلی', 'گنبد', 'شاهین‌شهر', 'خمینی‌شهر',
]

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌‍]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

const CITY_FORMS = [...new Set(IRANIAN_CITIES.map(normalize))].sort((a, b) => b.length - a.length)
const CITY = `(${CITY_FORMS.map((city) => city.replace(/ /g, '\\s')).join('|')})`
/** End of a word: the next char is not a letter (Unicode-aware `\b`). */
const END = '(?=$|[^\\p{L}])'
const START = '(?:^|[^\\p{L}])'

/** First-person residence statements. Group 1 is always the city. */
const RESIDENCE_PATTERNS: RegExp[] = [
  // «من تو مشهد زندگی می‌کنم»، «ما در کرج ساکن هستیم»، «تو تهران هستم»
  new RegExp(`${START}(?:در|تو|توی)\\s${CITY}\\s(?:زندگی\\s?می\\s?کن(?:م|یم)|ساکن(?:م|یم)?|مستقر(?:م|یم)?|هستم|هستیم|می\\s?شینم|میشینم)${END}`, 'u'),
  // «ساکن شیرازم»، «ساکن شیراز هستم»، «اهل اصفهان هستیم»
  new RegExp(`${START}(?:ساکن|اهل)\\s${CITY}(?:م|یم)?${END}`, 'u'),
  // «الان دیگه مشهد زندگی می‌کنم»، «تهران زندگی می‌کنیم»
  new RegExp(`${START}${CITY}\\s(?:زندگی\\s?می\\s?کن(?:م|یم)|ساکن(?:م|یم))${END}`, 'u'),
  // «من تهرانم»، «من کرجیم»، «ما شیرازی هستیم»، «من تهران هستم»
  new RegExp(`${START}(?:من|ما)\\s${CITY}(?:ی)?(?:م|یم|\\sهستم|\\sهستیم)${END}`, 'u'),
  // A clause that is only «تهرانم» / «کرجیم» / «تهران هستم»
  new RegExp(`^${CITY}(?:ی)?(?:م|یم|\\sهستم|\\sهستیم)$`, 'u'),
]

/** Imperative/statement shipping destination. Group 1 is the city. */
const DESTINATION_PATTERNS: RegExp[] = [
  new RegExp(`${START}(?:بفرست(?:ید|ین|ی)?|ارسال\\s?(?:ش\\s)?(?:کن(?:ید|ین)?|بشه|بشود|باشه|باشد))\\s(?:به|برای)\\s${CITY}${END}`, 'u'),
  new RegExp(`${START}(?:به|برای)\\s${CITY}\\s(?:بفرست(?:ید|ین)?|ارسال\\s?(?:کن(?:ید|ین)?|بشه|بشود|باشه|باشد)|می\\s?خوام\\sبفرستم)${END}`, 'u'),
  new RegExp(`${START}ارسال(?:ش)?\\sبه\\s${CITY}\\s(?:باشه|باشد|بشه|بشود)${END}`, 'u'),
  new RegExp(`${START}مقصد(?:\\sارسال)?(?:م)?\\s(?::|هم\\s)?\\s?${CITY}${END}`, 'u'),
]

/** Interrogative or hypothetical clauses never state a fact. */
const QUESTION_RE = new RegExp(
  `[؟?]|${START}(?:آیا|ایا|چند|چنده|چقدر|چقد|چطور|چجوری|کجا|کجاست|کی|چی|چیه|چرا|مگه|آیا|اگه|اگر|یا\\sنه)${END}`,
  'u',
)
/** Second-person / business-directed clauses («تو کرج هستید», «شعبه تهران»). */
const ABOUT_BUSINESS_RE = new RegExp(
  `${START}(?:(?:هستید|هستین|هستی|دارید|دارین|داری|میکنید|می\\sکنید|میکنین|می\\sکنین|میفرستید|میفرستین|می\\sفرستید|می\\sفرستین)${END}|شعبه|نمایندگی|فروشگاه|مغازه|دفتر|انبار|کارخونه|کارخانه|تولیدی|نمایشگاه|حضوری|سایت)`,
  'u',
)
/** Other people's cities («برای مادرم تو مشهد») are not the customer's own. */
const THIRD_PARTY_RE = /(?:مادر|پدر|خواهر|برادر|دوست|همسر|خانم|آقا|خاله|عمه|دایی|عمو|مامان|بابا|فامیل|همکار)(?:م|مون|ش)?(?=$|[^\p{L}])/u

/** «آدرسم …»، «آدرس من …»، «نشانی منزل …» — possessive is mandatory. */
const ADDRESS_RE =
  /(?:^|[^\p{L}])(?:آدرس|ادرس|نشانی)(?:م|مم|مون|مان|\s(?:من|ما|منزل|خونه|خانه|محل\sکار)(?:م|مون)?)(?:\s?(?:اینه|این\sهست|هست|است|:|：))?\s*[:：]?\s*(.{6,160})$/u
/** Street-like evidence an address value must carry. */
const ADDRESS_CONTENT_RE =
  /(?:خیابان|خ\s?\.|کوچه|ک\s?\.|بلوار|پلاک|میدان|بزرگراه|محله|شهرک|فاز|واحد|طبقه|کد\s?پستی|جاده|روستا|بن\s?بست|نبش|جنب|\d)/u
const ADDRESS_DEFERRAL_RE =
  /^(?:رو|را|هم)?\s?(?:بعد|بعدا|بعداً|نمی\s?گم|نمیدم|نمی\s?دم|ندارم|پایین|براتون|بهتون|می\s?فرستم|میفرستم|میدم|می\s?دم|میگم|می\s?گم|لازمه|میخواید|می\s?خواید)/u

const FIRST_PERSON_CITY_TOKEN_RE = new RegExp(`^${CITY}(?:ی)?(?:م|یم)$`, 'u')

const ANY_CITY_RE = new RegExp(`${START}${CITY}${END}`, 'u')

/** First known Iranian city named anywhere in the text (normalized form). */
export function findIranianCity(text: string): string | null {
  const city = normalize(text).match(ANY_CITY_RE)?.[1]
  return city ? normalize(city) : null
}

/** «تهرانم» / «کرجیم» — a statement about the customer, never a catalog term. */
export function isFirstPersonCityToken(token: string): boolean {
  return FIRST_PERSON_CITY_TOKEN_RE.test(normalize(token))
}

export interface CapturedFact {
  key: string
  value: string
  mode: 'attribute'
}

/** Split into statement clauses; each keeps its own terminal punctuation. */
function clauses(text: string): string[] {
  return text
    .split(/(?<=[.!؟?\n؛;])|(?:\s(?:ولی|اما|ولیکن)\s)/u)
    .map((part) => part.trim())
    .filter(Boolean)
}

function firstCity(clause: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const city = clause.match(pattern)?.[1]
    if (city) return normalize(city)
  }
  return null
}

/** Pure extractor — no side effects, safe to unit test. */
export function extractStatedFacts(text: string): CapturedFact[] {
  if (!text || typeof text !== 'string') return []
  const clean = normalize(text)
  if (clean.length < 4 || clean.length > 1200) return []

  let city: string | null = null
  let destination: string | null = null
  let address: string | null = null

  for (const raw of clauses(clean)) {
    // Commas split sub-clauses for the question/business checks, but an
    // address legitimately contains commas, so it reads the whole clause.
    const subClauses = raw.split(/[،,]/u).map((part) => part.trim()).filter(Boolean)
    for (const clause of subClauses) {
      if (QUESTION_RE.test(clause) || ABOUT_BUSINESS_RE.test(clause)) continue
      if (!city && !THIRD_PARTY_RE.test(clause)) city = firstCity(clause, RESIDENCE_PATTERNS)
      if (!destination) destination = firstCity(clause, DESTINATION_PATTERNS)
    }
    if (!address && !QUESTION_RE.test(raw)) {
      const value = raw.match(ADDRESS_RE)?.[1]?.replace(/[.!؛;]+$/u, '').trim()
      if (value && !ADDRESS_DEFERRAL_RE.test(value) && /\p{L}/u.test(value)
        && (ADDRESS_CONTENT_RE.test(value) || new RegExp(`^${CITY}${END}`, 'u').test(value))) {
        address = value.slice(0, 160)
      }
    }
  }

  // «آدرسم تهران، ونک …» also states the customer's city.
  if (!city && address) city = address.match(new RegExp(`^${CITY}${END}`, 'u'))?.[1] ?? null

  const facts: CapturedFact[] = []
  if (city) facts.push({ key: 'شهر', value: normalize(city), mode: 'attribute' })
  if (destination && destination !== city) facts.push({ key: 'شهر مقصد ارسال', value: destination, mode: 'attribute' })
  if (address) facts.push({ key: 'آدرس', value: address, mode: 'attribute' })
  return facts
}

export interface CaptureStatedFactsParams {
  workspaceId: string
  conversationId: string
  contactId: string
  agentId: string
  channel: string
  text: string
  messageId?: string
}

/**
 * Persist stated facts onto the contact's evidence memory. The read-modify-
 * write runs under a row lock so a concurrent writer (another channel's
 * turn, an improvement approval, a contact merge) cannot lose either update.
 * Returns the fresh metadata when something changed so the CURRENT turn's
 * prompt can already use it; never throws — capture is an enhancement.
 */
export async function captureStatedFacts(params: CaptureStatedFactsParams): Promise<unknown | null> {
  try {
    const facts = extractStatedFacts(params.text)
    if (!facts.length) return null
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Contact" WHERE id = ${params.contactId} AND "workspaceId" = ${params.workspaceId} FOR UPDATE`
      const contact = await tx.contact.findFirst({
        where: { id: params.contactId, workspaceId: params.workspaceId },
        select: { id: true, metadata: true },
      })
      if (!contact) return null

      let metadata: unknown = contact.metadata
      let changed = false
      for (const fact of facts) {
        const result = applyEvidenceFact({
          metadata,
          agentId: params.agentId,
          mode: fact.mode,
          key: fact.key,
          value: fact.value,
          conversationId: params.conversationId,
          source: `AUTO_FACT:${params.channel}`,
          sourceId: params.messageId,
          // The customer's own explicit statement is the newest truth.
          onConflict: 'supersede',
        })
        if (result.outcome !== 'unchanged') changed = true
        metadata = result.metadata
      }
      if (!changed) return null
      await tx.contact.update({
        where: { id: contact.id },
        data: { metadata: metadata as object },
      })
      return metadata
    })
  } catch (error) {
    console.error('[fact-capture] failed:', error instanceof Error ? error.name : 'UnknownError')
    return null
  }
}
