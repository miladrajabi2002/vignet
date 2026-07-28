/**
 * Shared Persian text normalization for the knowledge pipeline.
 *
 * The exact-term (lexical) arm of hybrid retrieval compares stored chunk
 * content against the customer's query inside PostgreSQL
 * (`to_tsvector('simple', content)` vs `websearch_to_tsquery`), so BOTH sides
 * must be normalized identically. Iranian content routinely mixes Arabic ي/ك
 * with Persian ی/ک (WooCommerce imports, copy-pasted text), half-space
 * variants (می‌خوام vs می خوام) and Persian/Arabic-Indic digits; without
 * folding these, exact-term recall silently fails on visually identical text.
 *
 * Applied at ingest time (insertChunk normalizes stored content — the GIN
 * expression index indexes stored content, so no migration is needed) and at
 * query time (buildLexicalQuery below). Mirrors the character mapping of
 * `normalizePersianText` in lib/ai/conversation.ts, but preserves newlines so
 * the chunker can still split on paragraph boundaries.
 */
export function normalizePersian(value: string): string {
  return (
    value
      .normalize('NFKC')
      // Arabic letter variants → Persian equivalents.
      .replace(/[يى]/g, 'ی') // ي / ى → ی
      .replace(/ك/g, 'ک') // ك → ک
      .replace(/ة/g, 'ه') // ة → ه
      // Hamza-carrier alef forms are Arabic spelling artifacts in Persian text.
      // (Standalone آ is a distinct Persian letter and is intentionally kept.)
      .replace(/[أإٱ]/g, 'ا')
      // Tatweel (U+0640) and Arabic diacritics carry no meaning for matching.
      .replace(/[ـً-ٰٟ]/g, '')
      // ZWNJ/ZWJ → space (same choice as lib/ai/conversation.ts) so
      // «می‌خوام» and «می خوام» tokenize identically (U+200C/U+200D).
      .replace(/[‌‍]/g, ' ')
      // Persian / Arabic-Indic digits → ASCII so SKUs and prices match.
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      // Collapse space runs introduced by the substitutions above, but
      // PRESERVE newlines — chunking relies on paragraph boundaries.
      .replace(/[ \t]{2,}/g, ' ')
  )
}

/**
 * Persian + English filler words that carry no retrieval signal. Focused on
 * conversational scaffolding («سلام ببخشید میخواستم بدونم …») so that only
 * content-bearing terms (product names, SKUs, «هزینه ارسال», …) reach the
 * tsquery. Deliberately small — over-stripping would hurt exact-term recall.
 */
const LEXICAL_STOPWORDS = new Set<string>([
  // Greetings / politeness
  'سلام', 'درود', 'وقت', 'بخیر', 'خوبی', 'خوبید', 'خوبین', 'ممنون', 'ممنونم',
  'مرسی', 'تشکر', 'سپاس', 'لطفا', 'خواهش', 'ببخشید', 'شرمنده', 'عزیز',
  'جناب', 'خانم', 'اقا', 'آقا', 'بفرمایید', 'بفرما', 'خداحافظ',
  // Conversational verbs / fillers
  'میخواستم', 'میخوام', 'خواستم', 'بخوام', 'خوام', 'بدونم', 'بدانم', 'میشه',
  'میشد', 'بشه', 'شده', 'شد', 'لطف', 'کنید', 'کنین', 'کنی', 'کن', 'میکنم',
  'کردم', 'کرد', 'بده', 'بدید', 'بدین', 'بگید', 'بگو', 'بگین', 'هست',
  'هستش', 'هستید', 'هستین', 'است', 'نیست', 'بود', 'باشه', 'باشد', 'دارید',
  'دارین', 'داری', 'دارم', 'داره', 'دارن', 'دارند', 'میتونم', 'میتونید',
  'میتونین', 'تونم', 'می', 'نمی', 'سوال', 'پرسش', 'راهنمایی',
  // Function words
  'را', 'رو', 'از', 'به', 'با', 'در', 'برای', 'برام', 'براتون', 'تا', 'که',
  'یا', 'هم', 'همین', 'فقط', 'الان', 'اگه', 'اگر', 'ولی', 'اما', 'پس',
  'چون', 'دیگه', 'دیگر', 'یه', 'یک', 'یکی', 'مورد', 'درباره', 'درمورد',
  // Question scaffolding
  'ایا', 'آیا', 'چی', 'چیه', 'چیا', 'چه', 'چند', 'چنده', 'چقدر', 'چقدره',
  'چقد', 'چطور', 'چطوره', 'چجوری', 'کجا', 'کجاست', 'کی', 'کیه',
  // Pronouns / demonstratives
  'من', 'شما', 'تو', 'ما', 'ایشون', 'این', 'اون', 'آن', 'اینا', 'اونا',
  // English fillers
  'hi', 'hello', 'hey', 'please', 'thanks', 'thank', 'ok', 'okay', 'im',
  'you', 'your', 'we', 'me', 'my', 'an', 'the', 'is', 'are', 'was', 'do',
  'does', 'can', 'could', 'would', 'want', 'wanted', 'know', 'how', 'what',
  'whats', 'which', 'where', 'when', 'why', 'much', 'many', 'about', 'for',
  'to', 'of', 'in', 'on', 'and', 'or', 'it', 'this', 'that', 'have', 'has',
  'need', 'tell', 'question',
])

/**
 * Turn a raw conversational message into a `websearch_to_tsquery` string with
 * OR semantics. The previous approach passed the whole message through
 * websearch AND semantics, which required every token (including «سلام» and
 * «ببخشید») to appear in one chunk — so the lexical arm almost never fired
 * for natural Persian questions. Here we keep only content-bearing tokens and
 * join them with the websearch `or` operator; any single matching term keeps
 * the chunk as a lexical candidate, and ts_rank_cd still ranks multi-term
 * matches higher.
 *
 * Returns '' when nothing content-bearing remains (pure smalltalk), which
 * disables the lexical arm for that turn.
 */
export function buildLexicalQuery(raw: string, maxTokens = 12): string {
  const normalized = normalizePersian(raw.slice(0, 500)).toLocaleLowerCase('fa')
  const tokens = normalized
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !LEXICAL_STOPWORDS.has(t))

  const unique: string[] = []
  for (const token of tokens) {
    if (!unique.includes(token)) unique.push(token)
    if (unique.length >= maxTokens) break
  }
  return unique.join(' or ')
}
