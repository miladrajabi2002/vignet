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
}

/**
 * Cosine-similarity retrieval over an agent's knowledge chunks.
 * Always scoped by workspaceId AND agentId for tenant isolation.
 */
export async function retrieveChunks(params: {
  workspaceId: string
  agentId: string
  queryEmbedding: number[]
  limit?: number
}): Promise<RetrievedChunk[]> {
  const literal = toVectorLiteral(params.queryEmbedding)
  const limit = params.limit ?? 5

  const rows = await prisma.$queryRaw<RetrievedChunk[]>`
    SELECT id, content, metadata,
           1 - (embedding <=> ${literal}::vector) AS similarity
    FROM "KnowledgeChunk"
    WHERE "workspaceId" = ${params.workspaceId}
      AND "agentId" = ${params.agentId}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${literal}::vector
    LIMIT ${limit}
  `
  return rows
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
