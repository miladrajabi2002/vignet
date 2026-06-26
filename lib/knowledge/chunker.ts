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
  const maxChars = opts.maxChars ?? 1200
  const overlap = opts.overlap ?? 150

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
      for (const piece of splitBySentence(para, maxChars)) {
        chunks.push(piece)
      }
      continue
    }
    if ((current + '\n\n' + para).length > maxChars) {
      pushCurrent()
      // Start next chunk with a tail overlap from the previous chunk.
      const tail = current.slice(-overlap)
      current = tail ? `${tail}\n\n${para}` : para
    } else {
      current = current ? `${current}\n\n${para}` : para
    }
  }
  pushCurrent()

  return chunks
}

function splitBySentence(text: string, maxChars: number): string[] {
  const sentences = text.match(/[^.!?؟\n]+[.!?؟\n]?/g) ?? [text]
  const out: string[] = []
  let current = ''
  for (const s of sentences) {
    if ((current + s).length > maxChars) {
      if (current.trim()) out.push(current.trim())
      current = s
    } else {
      current += s
    }
  }
  if (current.trim()) out.push(current.trim())
  return out
}
