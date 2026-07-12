import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

/** Format a number[] as a pgvector literal: [0.1,0.2,...] */
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

export interface InsertChunkInput {
  kbId: string
  agentId: string
  workspaceId: string
  content: string
  metadata?: Prisma.InputJsonValue
  embedding: number[]
}

/**
 * Insert a knowledge chunk with its embedding. The embedding column is an
 * Unsupported pgvector type, so we create the row via Prisma then set the
 * vector with a raw UPDATE.
 */
export async function insertChunk(input: InsertChunkInput): Promise<string> {
  const row = await prisma.knowledgeChunk.create({
    data: {
      kbId: input.kbId,
      agentId: input.agentId,
      workspaceId: input.workspaceId,
      content: input.content,
      metadata: input.metadata,
    },
    select: { id: true },
  })

  const literal = toVectorLiteral(input.embedding)
  await prisma.$executeRaw`UPDATE "KnowledgeChunk" SET embedding = ${literal}::vector WHERE id = ${row.id}`

  return row.id
}

export interface RetrievedChunk {
  id: string
  content: string
  metadata: Prisma.JsonValue
  similarity: number
  /** F4: when the chunk's parent KB was last refreshed (null for non-URL). */
  kbLastIngestedAt?: Date | null
  hybridScore?: number
}

/**
 * Cosine-similarity retrieval over an agent's knowledge chunks.
 * Always scoped by workspaceId AND agentId for tenant isolation.
 *
 * F4 — recency boost: for URL-type knowledge bases that declare a refresh
 * interval, chunks from a recently-refreshed KB get a small similarity bump so
 * fresh information wins ties against stale entries. The boost decays linearly
 * over a 7-day window (newest = +0.05, 7 days old = +0). Product-catalog and
 * non-URL chunks receive no boost (their freshness is tracked separately via
 * `Product.embeddingUpdatedAt`).
 */
export async function retrieveChunks(params: {
  workspaceId: string
  agentId: string
  queryEmbedding: number[]
  /** Raw customer query for exact-term/full-text recall in the hybrid ranker. */
  queryText?: string
  limit?: number
}): Promise<RetrievedChunk[]> {
  const literal = toVectorLiteral(params.queryEmbedding)
  const limit = params.limit ?? 5

  // Pull a slightly larger candidate set so the recency re-rank has headroom.
  const candidateLimit = Math.max(limit * 3, limit + 5)
  const queryText = params.queryText?.replace(/\s+/g, ' ').trim().slice(0, 500) ?? ''

  // The workspace/agent WHERE filter is applied *after* the HNSW scan, so for
  // small tenants the default ef_search (40) can return too few (or zero)
  // rows even when matches exist. Raise it for this query only (SET LOCAL is
  // transaction-scoped).
  const rows = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL hnsw.ef_search = 120`
    return tx.$queryRaw<RetrievedChunk[]>`
      WITH vector_ranked AS (
        SELECT kc.id,
               ROW_NUMBER() OVER (ORDER BY kc.embedding <=> ${literal}::vector) AS vector_rank,
               1 - (kc.embedding <=> ${literal}::vector) AS similarity
        FROM "KnowledgeChunk" kc
        WHERE kc."workspaceId" = ${params.workspaceId}
          AND kc."agentId" = ${params.agentId}
          AND kc.embedding IS NOT NULL
        ORDER BY kc.embedding <=> ${literal}::vector
        LIMIT ${candidateLimit}
      ),
      lexical_ranked AS (
        SELECT kc.id,
               ROW_NUMBER() OVER (
                 ORDER BY ts_rank_cd(
                   to_tsvector('simple', kc.content),
                   websearch_to_tsquery('simple', ${queryText})
                 ) DESC
               ) AS lexical_rank
        FROM "KnowledgeChunk" kc
        WHERE ${queryText} <> ''
          AND kc."workspaceId" = ${params.workspaceId}
          AND kc."agentId" = ${params.agentId}
          AND to_tsvector('simple', kc.content) @@ websearch_to_tsquery('simple', ${queryText})
        ORDER BY ts_rank_cd(
          to_tsvector('simple', kc.content),
          websearch_to_tsquery('simple', ${queryText})
        ) DESC
        LIMIT ${candidateLimit}
      ),
      candidate_ids AS (
        SELECT id FROM vector_ranked
        UNION
        SELECT id FROM lexical_ranked
      )
      SELECT kc.id,
             kc.content,
             kc.metadata,
             COALESCE(v.similarity, 0)::double precision AS similarity,
             (
               30.5 * (
                 CASE WHEN v.vector_rank IS NULL THEN 0 ELSE 1.0 / (60 + v.vector_rank) END +
                 CASE WHEN l.lexical_rank IS NULL THEN 0 ELSE 1.0 / (60 + l.lexical_rank) END
               )
             )::double precision AS "hybridScore",
             kb."lastIngestedAt" AS "kbLastIngestedAt"
      FROM candidate_ids candidates
      JOIN "KnowledgeChunk" kc ON kc.id = candidates.id
      LEFT JOIN vector_ranked v ON v.id = kc.id
      LEFT JOIN lexical_ranked l ON l.id = kc.id
      LEFT JOIN "KnowledgeBase" kb ON kb.id = kc."kbId"
      ORDER BY "hybridScore" DESC, similarity DESC
      LIMIT ${candidateLimit * 2}
    `
  })

  // Re-rank with a recency boost for URL KBs.
  const RECENT_BOOST_MAX = 0.05
  const DECAY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
  const now = Date.now()

  const scored = rows.map((r) => {
    let boost = 0
    if (r.kbLastIngestedAt) {
      const ageMs = now - new Date(r.kbLastIngestedAt).getTime()
      if (ageMs >= 0 && ageMs < DECAY_MS) {
        boost = RECENT_BOOST_MAX * (1 - ageMs / DECAY_MS)
      }
    }
    return { ...r, score: (r.hybridScore ?? r.similarity) + boost }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

/** Delete all chunks for a given product (used when a product changes/deletes). */
export async function deleteChunksForProduct(
  agentId: string,
  productId: string,
): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM "KnowledgeChunk"
    WHERE "agentId" = ${agentId}
      AND metadata ->> 'productId' = ${productId}
  `
}
