const CONTEXT_HEADER_PREFIX = '[Source:'
const DEFAULT_CHUNK_OVERLAP = 150
const MIN_SAFE_OVERLAP = 16

export interface KnowledgeSourceChunk {
  id: string
  content: string
  metadata: unknown
  createdAt: Date
}

function generationOf(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return 'legacy'
  }
  const generation = (metadata as Record<string, unknown>).generation
  return typeof generation === 'string' && generation ? generation : 'legacy'
}

function withoutContextHeader(content: string): string {
  if (!content.startsWith(CONTEXT_HEADER_PREFIX)) return content
  const newline = content.indexOf('\n')
  return newline === -1 ? '' : content.slice(newline + 1)
}

/**
 * Best-effort recovery for text knowledge created before sourceText existed.
 * It selects one ingestion generation, strips retrieval-only headers and
 * removes the known overlap between adjacent chunks.
 */
export function reconstructKnowledgeSource(chunks: KnowledgeSourceChunk[]): string {
  if (chunks.length === 0) return ''

  const groups = new Map<string, KnowledgeSourceChunk[]>()
  for (const chunk of chunks) {
    const generation = generationOf(chunk.metadata)
    groups.set(generation, [...(groups.get(generation) ?? []), chunk])
  }

  const selected = [...groups.values()].sort((a, b) => {
    if (a.length !== b.length) return b.length - a.length
    return (b.at(-1)?.createdAt.getTime() ?? 0) - (a.at(-1)?.createdAt.getTime() ?? 0)
  })[0] ?? []

  const pieces = selected.map((chunk) => withoutContextHeader(chunk.content)).filter(Boolean)
  if (pieces.length === 0) return ''

  let text = pieces[0]
  for (const piece of pieces.slice(1)) {
    const maxOverlap = Math.min(DEFAULT_CHUNK_OVERLAP, text.length, piece.length)
    let overlap = 0
    for (let size = maxOverlap; size >= MIN_SAFE_OVERLAP; size--) {
      if (text.endsWith(piece.slice(0, size))) {
        overlap = size
        break
      }
    }
    text += overlap > 0 ? piece.slice(overlap) : `\n\n${piece}`
  }
  return text.trim()
}
