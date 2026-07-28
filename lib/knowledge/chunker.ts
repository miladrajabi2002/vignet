/**
 * Split long text into overlapping chunks for embedding.
 * Chunks on paragraph/sentence boundaries where possible, with a character
 * budget that approximates ~250–350 tokens per chunk.
 */

export interface ChunkOptions {
  maxChars?: number
  overlap?: number
}

export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const maxChars = Math.max(1, Math.floor(opts.maxChars ?? 1200))
  const overlap = Math.min(
    maxChars - 1,
    Math.max(0, Math.floor(opts.overlap ?? 150)),
  )

  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (clean.length <= maxChars) return clean ? [clean] : []

  // Prefer splitting on paragraph boundaries.
  const paragraphs = clean.split(/\n\n+/)
  const chunks: string[] = []
  let current = ''

  const pushCurrent = () => {
    const trimmed = current.trim()
    if (trimmed) chunks.push(trimmed)
  }

  for (const para of paragraphs) {
    if (para.length > maxChars) {
      // Paragraph itself too big — hard-split by sentences/characters.
      pushCurrent()
      current = ''
      for (const piece of splitBySentence(para, maxChars, overlap)) {
        chunks.push(piece)
      }
      continue
    }
    if ((current + '\n\n' + para).length > maxChars) {
      const previous = current
      pushCurrent()
      // Start next chunk with a tail overlap from the previous chunk.
      // Cap the tail by the actual remaining room; the former fixed-size tail
      // could make the new chunk exceed maxChars when `para` was near the cap.
      const tailRoom = Math.max(0, maxChars - para.length - 2)
      const tail = previous.slice(-Math.min(overlap, tailRoom))
      current = tail ? `${tail}\n\n${para}` : para
    } else {
      current = current ? `${current}\n\n${para}` : para
    }
  }
  pushCurrent()

  return chunks
}

function splitBySentence(text: string, maxChars: number, overlap = 0): string[] {
  const sentences = text.match(/[^.!?؟\n]+[.!?؟\n]?/g) ?? [text]
  const out: string[] = []
  let current = ''
  const pushCurrent = () => {
    const trimmed = current.trim()
    if (trimmed) out.push(trimmed)
  }

  for (const s of sentences) {
    if (s.length > maxChars) {
      pushCurrent()
      current = ''
      const pieces = hardSplit(s, maxChars, overlap)
      // Keep the last piece open so the next sentence can share the normal
      // sentence-boundary overlap. Every emitted piece still respects the cap.
      out.push(...pieces.slice(0, -1))
      current = pieces.at(-1) ?? ''
      continue
    }
    if ((current + s).length > maxChars) {
      const previous = current
      pushCurrent()
      // Carry a tail overlap so a fact split across the boundary is still
      // retrievable from at least one chunk (mirrors the paragraph path).
      const tailRoom = Math.max(0, maxChars - s.length)
      const tail = previous.slice(-Math.min(overlap, tailRoom))
      current = tail ? tail + s : s
    } else {
      current += s
    }
  }
  pushCurrent()
  return out
}

/** Character fallback for a single sentence/token longer than maxChars. */
function hardSplit(text: string, maxChars: number, overlap: number): string[] {
  const out: string[] = []
  let start = 0

  while (start < text.length) {
    let end = Math.min(text.length, start + maxChars)
    if (end < text.length) {
      // Prefer a nearby whitespace boundary without producing a tiny piece.
      const boundary = text.lastIndexOf(' ', end)
      if (boundary > start + Math.floor(maxChars * 0.6)) end = boundary
    }
    const piece = text.slice(start, end).trim()
    if (piece) out.push(piece)
    if (end >= text.length) break
    start = Math.max(start + 1, end - overlap)
  }

  return out
}

/**
 * FAQ-aware chunking: one chunk per question/answer pair, so a pair's
 * embedding is never diluted by unrelated pairs and a question is never
 * separated from its answer. Detects labeled questions («سوال:», «پرسش:»,
 * "Q:", …) and lines ending in ؟/?; text without any recognizable question
 * structure falls back to the generic chunker.
 */
export function chunkFaq(text: string, opts: ChunkOptions = {}): string[] {
  const maxChars = Math.max(1, Math.floor(opts.maxChars ?? 1200))
  const clean = text.replace(/\r\n/g, '\n').trim()
  if (!clean) return []

  const isQuestionLine = (line: string): boolean => {
    const t = line.trim()
    if (!t) return false
    // «سوال ۳:» / «پرسش:» / "Q1)" / "Question:" style labels.
    if (/^(?:q|question|س|سوال|سؤال|پرسش)\s*[\d۰-۹]*\s*[:：.)\-–—]/i.test(t)) return true
    // A reasonably short line ending in a question mark.
    return /[؟?]$/.test(t) && t.length <= 300
  }

  const blocks: string[] = []
  let current: string[] = []
  let questionCount = 0
  for (const line of clean.split('\n')) {
    if (isQuestionLine(line)) {
      if (current.some((l) => l.trim())) blocks.push(current.join('\n').trim())
      current = [line]
      questionCount++
    } else {
      current.push(line)
    }
  }
  if (current.some((l) => l.trim())) blocks.push(current.join('\n').trim())

  if (questionCount === 0) return chunkText(clean, opts)

  return blocks.flatMap((pair) =>
    pair.length <= maxChars ? [pair] : splitLongFaqPair(pair, opts),
  )
}

/**
 * A single Q/A pair that exceeds the budget: split the answer, but repeat the
 * question line at the top of every piece so no fragment loses its question.
 */
function splitLongFaqPair(pair: string, opts: ChunkOptions): string[] {
  const maxChars = opts.maxChars ?? 1200
  const newline = pair.indexOf('\n')
  const question = newline === -1 ? '' : pair.slice(0, newline).trim()
  if (!question || question.length > maxChars / 2) return chunkText(pair, opts)
  const answer = pair.slice(newline + 1)
  const budget = Math.max(maxChars - question.length - 1, Math.floor(maxChars / 2))
  return chunkText(answer, { ...opts, maxChars: budget }).map(
    (piece) => `${question}\n${piece}`,
  )
}
