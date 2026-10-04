/**
 * Typo-tolerant catalog terms.
 *
 * A customer search term that is not in the store's own vocabulary
 * («شلوا», «آپادنا», «مانتوو») is corrected to the closest word the catalog
 * really uses («شلوار», «آپادانا», «مانتو»), so the lexical search and the
 * ranking both see the right word. This is spelling correction against the
 * tenant's own catalog words, not intent detection:
 *
 *   • words of 3 letters or fewer are never corrected (کیف ≠ کیک);
 *   • the allowed distance grows with length (1 edit up to 5 letters, 2 from 6);
 *   • Persian keyboard/phonetic confusions cost half an edit (ز/ذ/ض/ظ, س/ص/ث,
 *     ت/ط, ق/غ, ح/ه, ا/آ, پ/ب, چ/ج, ژ/ز, گ/ک) and a swap of two neighbours
 *     costs one edit;
 *   • when two catalog words are equally close the term is left as typed
 *     (the vector search still has it) instead of guessing;
 *   • a real retail word the store happens not to sell («صندل» in a shop of
 *     «صندلی») is protected and stays as typed.
 *
 * A term written as two catalog words glued together («میزتلویزیون») or one
 * word split in two is matched through its space-free form.
 */

const CHEAP_GROUPS = [
  'زذضظ', 'سصث', 'تط', 'قغ', 'حه', 'اآأإ', 'یيئى', 'کكگ', 'پب', 'چج', 'ژز', 'وؤ', 'هة',
]

const CHEAP_PAIRS = new Set<string>()
for (const group of CHEAP_GROUPS) {
  for (const left of group) {
    for (const right of group) if (left !== right) CHEAP_PAIRS.add(left + right)
  }
}

function substitutionCost(left: string, right: string): number {
  if (left === right) return 0
  return CHEAP_PAIRS.has(left + right) ? 0.5 : 1
}

/**
 * Weighted optimal-string-alignment distance (Damerau–Levenshtein without
 * repeated edits of one substring). Returns `limit + 1` as soon as the
 * distance is certainly above `limit`.
 */
export function catalogEditDistance(left: string, right: string, limit = 2): number {
  return distanceOf([...left], [...right], limit)
}

// Three reusable rows: the hot loop allocates nothing per candidate word.
let rowA = new Float64Array(32)
let rowB = new Float64Array(32)
let rowC = new Float64Array(32)

function distanceOf(a: string[], b: string[], limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  const cols = b.length + 1
  if (rowA.length < cols) {
    rowA = new Float64Array(cols * 2)
    rowB = new Float64Array(cols * 2)
    rowC = new Float64Array(cols * 2)
  }
  let prevPrev = rowA
  let prev = rowB
  let current = rowC
  for (let col = 0; col < cols; col++) prev[col] = col
  for (let row = 1; row <= a.length; row++) {
    current[0] = row
    let rowMin = row
    for (let col = 1; col < cols; col++) {
      let value = Math.min(prev[col] + 1, current[col - 1] + 1, prev[col - 1] + substitutionCost(a[row - 1], b[col - 1]))
      if (row > 1 && col > 1 && a[row - 1] === b[col - 2] && a[row - 2] === b[col - 1]) {
        value = Math.min(value, prevPrev[col - 2] + 1)
      }
      current[col] = value
      if (value < rowMin) rowMin = value
    }
    if (rowMin > limit) return limit + 1
    const recycled = prevPrev
    prevPrev = prev
    prev = current
    current = recycled
  }
  return prev[cols - 1]
}

interface VocabularyIndex {
  /** Words longer than 3 letters, by letter count, pre-split into letters. */
  byLength: Map<number, Array<{ word: string; letters: string[] }>>
}

const indexes = new WeakMap<ReadonlySet<string>, VocabularyIndex>()

function indexOf(vocabulary: ReadonlySet<string>): VocabularyIndex {
  const cached = indexes.get(vocabulary)
  if (cached) return cached
  const byLength = new Map<number, Array<{ word: string; letters: string[] }>>()
  for (const word of vocabulary) {
    const letters = [...word]
    if (letters.length <= 3 || looksLikeCode(word)) continue
    const bucket = byLength.get(letters.length)
    if (bucket) bucket.push({ word, letters })
    else byLength.set(letters.length, [{ word, letters }])
  }
  const index = { byLength }
  indexes.set(vocabulary, index)
  return index
}

/** Edits allowed for a term of this length (letters, not bytes). */
export function allowedEdits(term: string): number {
  const length = [...term].length
  if (length <= 3) return 0
  if (length <= 5) return 1
  return 2
}

const isDigits = (value: string) => value.length > 0 && [...value].every((char) => char >= '0' && char <= '9')

function looksLikeCode(term: string): boolean {
  // Product codes and SKUs («0788», «ak-71») are exact identifiers.
  return [...term].some((char) => char >= '0' && char <= '9')
}

/**
 * The catalog word a misspelled term most likely means, or null when the term
 * is already a catalog word, too short, a code, or ambiguous.
 */
export function correctCatalogTerm(
  term: string,
  vocabulary: ReadonlySet<string> | null | undefined,
  options: { protect?: ReadonlySet<string> } = {},
): string | null {
  if (!vocabulary?.size) return null
  const value = term.trim()
  if (!value || vocabulary.has(value) || looksLikeCode(value) || isDigits(value)) return null
  if (options.protect?.has(value)) return null
  const limit = allowedEdits(value)
  // Glued or split compound: «میزتلویزیون» ↔ «میز تلویزیون».
  const compact = value.split(' ').join('')
  if (compact !== value && vocabulary.has(compact)) return compact
  if (limit === 0) return null

  let best = limit + 1
  let winners: string[] = []
  const letters = [...value]
  const { byLength } = indexOf(vocabulary)
  for (let length = letters.length - limit; length <= letters.length + limit; length++) {
    for (const candidate of byLength.get(length) ?? []) {
      const distance = distanceOf(letters, candidate.letters, Math.min(limit, best))
      if (distance > limit) continue
      if (distance < best) {
        best = distance
        winners = [candidate.word]
      } else if (distance === best) {
        winners.push(candidate.word)
      }
    }
  }
  if (!winners.length) return null
  if (winners.length === 1) return winners[0]
  // A typo rarely changes the first letter, and a dropped letter is the most
  // common slip: prefer that winner when it is the only one.
  const sameStart = winners.filter((word) => word[0] === value[0])
  if (sameStart.length === 1) return sameStart[0]
  const pool = sameStart.length ? sameStart : winners
  const completions = pool.filter((word) => word.startsWith(value))
  return completions.length === 1 ? completions[0] : null
}

export interface TermCorrection {
  from: string
  to: string
}

/** Correct every search term against the catalog vocabulary. */
export function correctSearchTerms(
  terms: string[],
  vocabulary: ReadonlySet<string> | null | undefined,
  options: { protect?: ReadonlySet<string> } = {},
): { terms: string[]; corrections: TermCorrection[] } {
  const corrections: TermCorrection[] = []
  const corrected = terms.map((term) => {
    const fix = correctCatalogTerm(term, vocabulary, options)
    if (!fix || fix === term) return term
    corrections.push({ from: term, to: fix })
    return fix
  })
  return { terms: [...new Set(corrected)], corrections }
}
