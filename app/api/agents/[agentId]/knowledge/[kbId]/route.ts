import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { syncOnboarding } from '@/lib/onboarding'
import { BUCKETS, deleteFile } from '@/lib/storage'
import { dispatchIngestion } from '@/lib/queue/jobs'
import { assertSafeHttpUrl, UnsafeHttpTargetError } from '@/lib/security/safe-http'
import {
  readBoundedRequestBody,
  RequestBodyTooLargeError,
} from '@/lib/security/request-body'

type Params = { params: Promise<{ agentId: string; kbId: string }> }

const MAX_JSON_BYTES = 2 * 1024 * 1024

async function ownKb(workspaceId: string, agentId: string, kbId: string) {
  return prisma.knowledgeBase.findFirst({
    where: {
      id: kbId,
      agentId,
      workspaceId,
      // PRODUCT_CATALOG knowledge bases are managed automatically by the
      // catalog feature — operators should not edit them from the KB tab.
      type: { not: 'PRODUCT_CATALOG' },
    },
    select: {
      id: true,
      name: true,
      type: true,
      sourceUrl: true,
      refreshIntervalHours: true,
      status: true,
    },
  })
}

/** GET — fetch a single knowledge base entry for the edit form. */
export async function GET(_req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const kb = await ownKb(user.workspaceId, params.agentId, params.kbId)
  if (!kb) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  return NextResponse.json({ kb })
}

/**
 * PATCH — update a knowledge base entry's editable fields.
 *
 * What can be edited per type:
 *   - TEXT: name, content (re-ingests)
 *   - URL:  name, url, refreshIntervalHours (re-crawls)
 *   - PDF/CSV: name only (binary source cannot be edited inline; re-upload
 *     via the regular POST flow instead)
 *
 * Editing content/URL triggers a fresh ingestion so the vector store stays
 * in sync with the visible text.
 */
export async function PATCH(req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const kb = await ownKb(user.workspaceId, params.agentId, params.kbId)
  if (!kb) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  let rawBody: Buffer
  try {
    rawBody = await readBoundedRequestBody(req, MAX_JSON_BYTES)
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
    }
    throw error
  }

  let json: Record<string, unknown> | null = null
  try {
    json = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  }
  if (!json) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const name = typeof json.name === 'string' ? json.name.trim().slice(0, 200) : undefined

  // URL fields
  let sourceUrl: string | undefined
  let refreshIntervalHours: number | undefined
  if (kb.type === 'URL') {
    if (typeof json.url === 'string') {
      sourceUrl = json.url.trim()
      if (sourceUrl.length > 2048) {
        return NextResponse.json({ error: 'INVALID_URL' }, { status: 400 })
      }
      try {
        await assertSafeHttpUrl(sourceUrl)
      } catch (error) {
        if (!(error instanceof UnsafeHttpTargetError)) {
          console.error('[knowledge] URL validation failed:', error)
        }
        return NextResponse.json({ error: 'INVALID_URL' }, { status: 400 })
      }
    }
    if (json.refreshIntervalHours !== undefined) {
      const rawHours = Number(json.refreshIntervalHours)
      refreshIntervalHours =
        Number.isFinite(rawHours) && rawHours >= 0 && rawHours <= 168
          ? Math.floor(rawHours)
          : 0
    }
  }

  // TEXT content (re-ingest when changed)
  let inlineText: string | undefined
  if (kb.type === 'TEXT' && typeof json.content === 'string') {
    inlineText = json.content
    if (!inlineText.trim() || inlineText.length > 1_000_000) {
      return NextResponse.json({ error: 'EMPTY' }, { status: 400 })
    }
  }

  // Build the update payload. Only include fields that actually changed so
  // we don't touch updatedAt for no-op edits.
  const data: Record<string, unknown> = {}
  if (name && name !== kb.name) data.name = name
  if (kb.type === 'URL') {
    if (sourceUrl && sourceUrl !== kb.sourceUrl) data.sourceUrl = sourceUrl
    if (
      refreshIntervalHours !== undefined &&
      refreshIntervalHours !== kb.refreshIntervalHours
    ) {
      data.refreshIntervalHours = refreshIntervalHours
    }
  }
  // For TEXT, content is not stored on the KB row itself — it's chunked into
  // KnowledgeChunk rows. We still mark the KB as PENDING so the UI shows a
  // processing state, then dispatch re-ingestion with the new text.
  const needsReingest =
    (kb.type === 'TEXT' && inlineText !== undefined) ||
    (kb.type === 'URL' && sourceUrl && sourceUrl !== kb.sourceUrl)

  if (needsReingest) {
    data.status = 'PENDING'
    data.errorMsg = null
    // Clear chunkCount so the UI doesn't show stale counts during reprocessing.
    data.chunkCount = 0
  }

  if (Object.keys(data).length === 0) {
    // No-op edit — return the KB unchanged.
    return NextResponse.json({ kb, noop: true })
  }

  const updated = await prisma.knowledgeBase.update({
    where: { id: kb.id },
    data,
    select: {
      id: true,
      name: true,
      type: true,
      sourceUrl: true,
      refreshIntervalHours: true,
      status: true,
    },
  })

  // Dispatch re-ingestion for content changes (TEXT) or URL changes (URL).
  // The ingestion job will clear existing chunks before re-embedding
  // (it uses shadow-generation: new chunks inserted alongside old ones,
  // then old ones deleted on success).
  if (needsReingest) {
    if (kb.type === 'TEXT' && inlineText !== undefined) {
      await dispatchIngestion({ kbId: kb.id, text: inlineText })
    } else if (kb.type === 'URL' && sourceUrl) {
      // The URL is already persisted on the KB row (in the update above),
      // so the ingestion worker will pick it up from there.
      await dispatchIngestion({ kbId: kb.id })
    }
  }

  await syncOnboarding(user.workspaceId)

  return NextResponse.json({ kb: updated })
}

export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const kb = await prisma.knowledgeBase.findFirst({
    where: {
      id: params.kbId,
      agentId: params.agentId,
      workspaceId: user.workspaceId,
    },
    select: { id: true, fileKey: true },
  })
  if (!kb) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  // chunks cascade on KB delete (onDelete: Cascade in schema).
  await prisma.knowledgeBase.delete({ where: { id: kb.id } })
  if (kb.fileKey) {
    await deleteFile(BUCKETS.knowledge, kb.fileKey).catch((error) => {
      console.error('[knowledge] failed to delete storage object:', error)
    })
  }
  await syncOnboarding(user.workspaceId)

  return NextResponse.json({ ok: true })
}
