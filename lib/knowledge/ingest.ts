import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { chunkFaq, chunkText } from '@/lib/knowledge/chunker'
import { embedTexts } from '@/lib/ai/embeddings'
import { insertChunk } from '@/lib/knowledge/vector-store'
import { parsePdfPages, parseCsv, parseUrl } from '@/lib/knowledge/parsers'
import { downloadFile, BUCKETS } from '@/lib/storage'
import { dispatchNotification } from '@/lib/queue/jobs'

export interface IngestionJobData {
  kbId: string
  /** Inline text for TEXT/FAQ sources (not persisted on the KB row). */
  text?: string
}

const EMBED_BATCH = 32

function contextualChunk(
  content: string,
  source: {
    name: string
    type: string
    sourceUrl: string | null
    fileName: string | null
  },
  page?: number,
): string {
  const reference = source.sourceUrl ?? source.fileName
  const header = [
    `Source: ${source.name}`,
    `Type: ${source.type}`,
    ...(reference ? [`Reference: ${reference}`] : []),
    ...(page ? [`Page: ${page}`] : []),
  ].join(' | ')
  return `[${header}]\n${content}`
}

interface ResolvedSection {
  text: string
  page?: number
}

/** Resolve source text while retaining traceable boundaries such as PDF pages. */
async function resolveSections(
  kb: {
    type: string
    sourceUrl: string | null
    fileKey: string | null
  },
  inlineText?: string,
): Promise<ResolvedSection[]> {
  switch (kb.type) {
    case 'TEXT':
    case 'FAQ':
      return [{ text: (inlineText ?? '').trim() }]
    case 'URL':
      if (!kb.sourceUrl) throw new Error('Missing sourceUrl')
      return [{ text: await parseUrl(kb.sourceUrl) }]
    case 'PDF': {
      if (!kb.fileKey) throw new Error('Missing fileKey')
      const buf = await downloadFile(BUCKETS.knowledge, kb.fileKey)
      return (await parsePdfPages(buf)).map(({ page, text }) => ({ page, text }))
    }
    case 'CSV': {
      if (!kb.fileKey) throw new Error('Missing fileKey')
      const buf = await downloadFile(BUCKETS.knowledge, kb.fileKey)
      return [{ text: parseCsv(buf.toString('utf8')) }]
    }
    default:
      return [{ text: (inlineText ?? '').trim() }]
  }
}

/**
 * Process a knowledge base: resolve its text, chunk, embed, and store vectors.
 * Updates KB status and chunkCount throughout.
 */
export async function processIngestion(data: IngestionJobData): Promise<void> {
  const kb = await prisma.knowledgeBase.findUnique({ where: { id: data.kbId } })
  if (!kb) throw new Error(`KnowledgeBase ${data.kbId} not found`)

  const approval = kb.type === 'FAQ'
    ? await prisma.knowledgeApproval.findUnique({ where: { knowledgeBaseId: kb.id } })
    : null
  // Learned answers are durable in the approval ledger. A queued retry must
  // always use its latest version, even if the original job carried old text.
  const approvedText = approval ? `سؤال: ${approval.question}\nپاسخ: ${approval.answer}` : data.text
  await prisma.knowledgeBase.updateMany({
    where: { id: kb.id, ...(approval ? { approval: { is: { knowledgeVersion: approval.knowledgeVersion } } } : {}) },
    data: { status: 'PROCESSING', errorMsg: null },
  })

  // Shadow-generation ingest: new chunks are inserted ALONGSIDE the old ones,
  // tagged with a fresh generation id; the previous generation is deleted only
  // after every embed+insert succeeded. The old delete-first flow meant one
  // transient provider failure mid-ingest left the KB with zero (or partial)
  // knowledge until the next successful run — with this swap, the previous
  // knowledge keeps serving and retrieval never observes a half-ingested
  // window. It also makes two racing ingests converge on the last winner
  // instead of interleaving deletes and inserts.
  const generation = crypto.randomUUID()

  try {
    const sections = await resolveSections(kb, approvedText)
    const chunks = sections.flatMap((section) => {
      const pieces = kb.type === 'FAQ'
        ? chunkFaq(section.text)
        : chunkText(section.text)
      return pieces.map((content) => ({ content, page: section.page }))
    })
    if (chunks.length === 0) {
      // Genuinely empty source: retire the previous generation too, so the
      // dashboard (READY, 0 chunks) and retrieval agree instead of silently
      // serving stale chunks that the UI claims don't exist.
      await prisma.knowledgeChunk.deleteMany({ where: { kbId: kb.id } })
      await prisma.knowledgeBase.update({
        where: { id: kb.id },
        data: { status: 'READY', chunkCount: 0 },
      })
      return
    }

    let stored = 0
    for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
      // Deterministic source context improves retrieval for short/ambiguous
      // chunks without paying for a second LLM pass during ingestion.
      const batch = chunks
        .slice(i, i + EMBED_BATCH)
        .map((chunk) => ({
          ...chunk,
          contextualized: contextualChunk(chunk.content, kb, chunk.page),
        }))
      const vectors = await embedTexts(
        batch.map((chunk) => chunk.contextualized),
        kb.workspaceId,
      )
      for (let j = 0; j < batch.length; j++) {
        await insertChunk({
          kbId: kb.id,
          agentId: kb.agentId,
          workspaceId: kb.workspaceId,
          content: batch[j].contextualized,
          metadata: {
            source: kb.type,
            kbId: kb.id,
            name: kb.name,
            ...(batch[j].page ? { page: batch[j].page } : {}),
            contextualized: true,
            generation,
            ...(approval ? { learnedVersion: approval.knowledgeVersion } : {}),
          },
          embedding: vectors[j],
        })
        stored++
      }
    }

    // Publish a learned generation only if its reviewed version is still current.
    // The KB write and chunk swap share a transaction, so edits cannot publish
    // an older in-flight job over a newer human-approved answer.
    await prisma.$transaction(async (tx) => {
      const published = await tx.knowledgeBase.updateMany({
        where: { id: kb.id, ...(approval ? { approval: { is: { knowledgeVersion: approval.knowledgeVersion } } } : {}) },
        data: { status: 'READY', chunkCount: stored },
      })
      await tx.knowledgeChunk.deleteMany({
        where: published.count === 1
          ? { kbId: kb.id, NOT: { metadata: { path: ['generation'], equals: generation } } }
          : { kbId: kb.id, metadata: { path: ['generation'], equals: generation } },
      })
    })
  } catch (e) {
    // Roll back the partial new generation; the previous knowledge stays live.
    await prisma.knowledgeChunk
      .deleteMany({
        where: {
          kbId: kb.id,
          metadata: { path: ['generation'], equals: generation },
        },
      })
      .catch(() => {})
    const message = e instanceof Error ? e.message : 'Ingestion failed'
    await prisma.knowledgeBase.updateMany({
      where: { id: kb.id, ...(approval ? { approval: { is: { knowledgeVersion: approval.knowledgeVersion } } } : {}) },
      data: { status: 'ERROR', errorMsg: message.slice(0, 500) },
    })
    // Fire-and-forget ops alert (no-op unless ALERT_EMAIL + Resend configured).
    void dispatchNotification({
      kind: 'ops',
      subject: 'Knowledge ingestion failed',
      body: `KB: ${kb.name} (${kb.id})\nType: ${kb.type}\nWorkspace: ${kb.workspaceId}\nError: ${message}`,
    })
    throw e
  }
}
