import { prisma } from '@/lib/prisma'
import { chunkText } from '@/lib/knowledge/chunker'
import { embedTexts } from '@/lib/ai/embeddings'
import { insertChunk } from '@/lib/knowledge/vector-store'
import { parsePdf, parseCsv, parseUrl } from '@/lib/knowledge/parsers'
import { downloadFile, BUCKETS } from '@/lib/storage'
import { dispatchNotification } from '@/lib/queue/jobs'

export interface IngestionJobData {
  kbId: string
  /** Inline text for TEXT/FAQ sources (not persisted on the KB row). */
  text?: string
}

const EMBED_BATCH = 32

/** Resolve the raw text for a knowledge base from its source. */
async function resolveText(
  kb: {
    type: string
    sourceUrl: string | null
    fileKey: string | null
  },
  inlineText?: string,
): Promise<string> {
  switch (kb.type) {
    case 'TEXT':
    case 'FAQ':
      return (inlineText ?? '').trim()
    case 'URL':
      if (!kb.sourceUrl) throw new Error('Missing sourceUrl')
      return parseUrl(kb.sourceUrl)
    case 'PDF': {
      if (!kb.fileKey) throw new Error('Missing fileKey')
      const buf = await downloadFile(BUCKETS.knowledge, kb.fileKey)
      return parsePdf(buf)
    }
    case 'CSV': {
      if (!kb.fileKey) throw new Error('Missing fileKey')
      const buf = await downloadFile(BUCKETS.knowledge, kb.fileKey)
      return parseCsv(buf.toString('utf8'))
    }
    default:
      return (inlineText ?? '').trim()
  }
}

/**
 * Process a knowledge base: resolve its text, chunk, embed, and store vectors.
 * Updates KB status and chunkCount throughout.
 */
export async function processIngestion(data: IngestionJobData): Promise<void> {
  const kb = await prisma.knowledgeBase.findUnique({ where: { id: data.kbId } })
  if (!kb) throw new Error(`KnowledgeBase ${data.kbId} not found`)

  await prisma.knowledgeBase.update({
    where: { id: kb.id },
    data: { status: 'PROCESSING', errorMsg: null },
  })

  try {
    const raw = await resolveText(kb, data.text)
    const chunks = chunkText(raw)
    if (chunks.length === 0) {
      await prisma.knowledgeBase.update({
        where: { id: kb.id },
        data: { status: 'READY', chunkCount: 0 },
      })
      return
    }

    // Remove any previous chunks for this KB before re-ingesting.
    await prisma.knowledgeChunk.deleteMany({ where: { kbId: kb.id } })

    let stored = 0
    for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
      const batch = chunks.slice(i, i + EMBED_BATCH)
      const vectors = await embedTexts(batch, kb.workspaceId)
      for (let j = 0; j < batch.length; j++) {
        await insertChunk({
          kbId: kb.id,
          agentId: kb.agentId,
          workspaceId: kb.workspaceId,
          content: batch[j],
          metadata: { source: kb.type, kbId: kb.id, name: kb.name },
          embedding: vectors[j],
        })
        stored++
      }
    }

    await prisma.knowledgeBase.update({
      where: { id: kb.id },
      data: { status: 'READY', chunkCount: stored },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Ingestion failed'
    await prisma.knowledgeBase.update({
      where: { id: kb.id },
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
