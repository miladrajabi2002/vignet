import type { Prisma } from '@prisma/client'

/**
 * Pure re-ranking / relevance-gating logic for hybrid knowledge retrieval.
 * Kept free of Prisma-client imports so it can be unit-tested directly;
 * `retrieveChunks` in vector-store.ts is the only production caller.
 */

/**
 * Tie-break bonus for recently re-crawled URL chunks. It stays below one
 * top-list RRF rank step (~0.008), so it cannot leapfrog a stronger result.
 */
export const RECENT_BOOST_MAX = 0.004

/**
 * Tie-break bonus for owner-curated knowledge (dashboard FAQ / manual text).
 * Slightly larger than RECENT_BOOST_MAX so a shop owner's corrected answer
 * wins conflicts against a freshly re-crawled page saying something else.
 */
export const CURATED_BOOST = 0.005

/**
 * Similarity floor for vector-only candidates (text-embedding-3-small,
 * cosine). Smalltalk («سلام», «ممنون») lands well below this against real
 * knowledge chunks, so those turns inject zero chunks into the prompt.
 * Chunks with a lexical (exact-term) hit bypass the floor — an exact SKU or
 * product-name match is strong evidence regardless of embedding distance.
 */
export const MIN_VECTOR_SIMILARITY = 0.3

/** Recency boost decays linearly to zero over this window. */
export const RECENCY_DECAY_MS = 7 * 24 * 60 * 60 * 1000

export interface RankableChunk {
  similarity: number
  hybridScore?: number
  lexicalRank?: number | null
  kbLastIngestedAt?: Date | string | null
  metadata?: Prisma.JsonValue
}

/** Owner-curated sources authored in the dashboard (vs crawled/imported). */
function isCurated(metadata: Prisma.JsonValue | undefined): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false
  const source = (metadata as Record<string, unknown>).source
  return source === 'FAQ' || source === 'TEXT'
}

/**
 * Gate candidates on relevance, apply sub-rank-step boosts, sort and cut to
 * `limit`. Returns [] when nothing is genuinely relevant — the caller then
 * injects no knowledge into the prompt (and downstream product-popularity
 * counters are not bumped by irrelevant retrievals).
 */
export function rankRetrievedChunks<T extends RankableChunk>(
  rows: T[],
  limit: number,
  now: number = Date.now(),
): T[] {
  const relevant = rows.filter(
    (r) => r.lexicalRank != null || r.similarity >= MIN_VECTOR_SIMILARITY,
  )

  const scored = relevant.map((r) => {
    let boost = 0
    if (r.kbLastIngestedAt) {
      const ageMs = now - new Date(r.kbLastIngestedAt).getTime()
      if (ageMs >= 0 && ageMs < RECENCY_DECAY_MS) {
        boost += RECENT_BOOST_MAX * (1 - ageMs / RECENCY_DECAY_MS)
      }
    }
    if (isCurated(r.metadata)) boost += CURATED_BOOST
    return { row: r, score: (r.hybridScore ?? r.similarity) + boost }
  })

  scored.sort((a, b) => b.score - a.score || b.row.similarity - a.row.similarity)
  return scored.slice(0, limit).map((s) => s.row)
}
