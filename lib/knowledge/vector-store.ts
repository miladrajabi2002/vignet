import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { normalizePersian, buildLexicalQuery } from '@/lib/knowledge/normalize'
import { rankRetrievedChunks } from '@/lib/knowledge/ranking'

/** Format a number[] as a pgvector literal: [0.1,0.2,...] */
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

/**
 * pgvector 0.8+ supports iterative HNSW scans: the index keeps scanning until
 * the post-filter LIMIT is satisfied instead of stopping at ef_search global
 * neighbors. Without it, a small tenant's chunks must appear among the top-120
 * GLOBAL nearest neighbors to be seen at all — a guarantee that erodes as the
 * shared chunk table grows. Detected once per process; older pgvector would
 * reject the unknown GUC and abort the whole retrieval transaction.
 */
let iterativeScanSupport: Promise<boolean> | null = null
function supportsIterativeScan(): Promise<boolean> {
  iterativeScanSupport ??= prisma
    .$queryRaw<Array<{ extversion: string }>>`SELECT extversion FROM pg_extension WHERE extname = 'vector'`
    .then((rows) => {
      const version = rows[0]?.extversion
      if (!version) return false
      const [major = 0, minor = 0] = version.split('.').map(Number)
      return major > 0 || (major === 0 && minor >= 8)
    })
    .catch(() => false)
  return iterativeScanSupport
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
      // Store normalized content so the GIN tsvector index and the normalized
      // lexical query (buildLexicalQuery) agree on Arabic/Persian letter
      // variants, half-spaces and digit systems.
      content: normalizePersian(input.content),
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
  /** Position in the exact-term (tsquery) ranking; null = no lexical match. */
  lexicalRank?: number | null
}

/**
 * Hybrid (vector + lexical RRF) retrieval over an agent's knowledge chunks.
 * Always scoped by workspaceId AND agentId for tenant isolation.
 *
 * Relevance gate: candidates that neither reach MIN_VECTOR_SIMILARITY nor
 * have an exact-term match are dropped entirely, so smalltalk («سلام»,
 * «ممنون») injects zero chunks into the prompt instead of the K nearest
 * irrelevant ones.
 *
 * F4 — recency/curation boosts (see lib/knowledge/ranking.ts): both are
 * scaled below one RRF rank step, so they only break near-ties — a recently
 * re-crawled page can no longer systematically outrank the owner's curated
 * FAQ/manual knowledge.
 */
export async function retrieveChunks(params: {
  workspaceId: string
  agentId: string
  queryEmbedding: number[]
  /** Raw customer query for exact-term/full-text recall in the hybrid ranker. */
  queryText?: string
  limit?: number
  /** Exclude product-catalog chunks when the agent's catalog access is off. */
  includeProductCatalog?: boolean
}): Promise<RetrievedChunk[]> {
  const literal = toVectorLiteral(params.queryEmbedding)
  const limit = params.limit ?? 5

  // Pull a slightly larger candidate set so the recency re-rank has headroom.
  const candidateLimit = Math.max(limit * 3, limit + 5)
  // Content-bearing terms only, OR-joined: websearch AND semantics over the
  // raw message («سلام ببخشید میخواستم …») virtually never matched a chunk,
  // silently degrading hybrid retrieval to vector-only.
  const queryText = buildLexicalQuery(params.queryText ?? '')
  const includeProductCatalog = params.includeProductCatalog !== false
  const iterativeScan = await supportsIterativeScan()

  // The workspace/agent WHERE filter is applied *after* the HNSW scan, so for
  // small tenants the default ef_search (40) can return too few (or zero)
  // rows even when matches exist. Raise it for this query only (SET LOCAL is
  // transaction-scoped) and, on pgvector 0.8+, let the scan iterate past
  // ef_search until the tenant-filtered LIMIT is satisfied.
  const rows = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL hnsw.ef_search = 120`
    if (iterativeScan) {
      await tx.$executeRaw`SET LOCAL hnsw.iterative_scan = relaxed_order`
    }
    return tx.$queryRaw<RetrievedChunk[]>`
      WITH vector_ranked AS (
        SELECT kc.id,
               ROW_NUMBER() OVER (ORDER BY kc.embedding <=> ${literal}::vector) AS vector_rank,
               1 - (kc.embedding <=> ${literal}::vector) AS similarity
        FROM "KnowledgeChunk" kc
        WHERE kc."workspaceId" = ${params.workspaceId}
          AND kc."agentId" = ${params.agentId}
          AND kc.embedding IS NOT NULL
          AND (${includeProductCatalog} OR kc.metadata ->> 'productId' IS NULL)
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
          AND (${includeProductCatalog} OR kc.metadata ->> 'productId' IS NULL)
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
             l.lexical_rank::int AS "lexicalRank",
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

  // Relevance gate + tie-break boosts (pure logic, see lib/knowledge/ranking.ts).
  return rankRetrievedChunks(rows, limit)
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
