import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { uploadFile, BUCKETS, isStorageConfigured } from '@/lib/storage'
import { dispatchIngestion } from '@/lib/queue/jobs'
import { syncOnboarding } from '@/lib/onboarding'
import type { KBType } from '@prisma/client'
import { assertSafeHttpUrl, UnsafeHttpTargetError } from '@/lib/security/safe-http'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'
import { randomUUID } from 'node:crypto'
import { hasWorkspacePermission } from '@/lib/workspace-permissions'
import { rateLimit, rateLimitCost } from '@/lib/ratelimit'
import { isProbablyUtf8Text, matchesPdfSignature } from '@/lib/security/file-signatures'
import {
  readBoundedRequestBody,
  RequestBodyTooLargeError,
} from '@/lib/security/request-body'

const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_MULTIPART_BYTES = MAX_FILE_BYTES + 256 * 1024
const MAX_JSON_BYTES = 2 * 1024 * 1024
const DEFAULT_KNOWLEDGE_DAILY_BYTES = 200 * 1024 * 1024
const DEFAULT_KNOWLEDGE_GLOBAL_DAILY_BYTES = 2 * 1024 * 1024 * 1024

type Params = { params: Promise<{ agentId: string }> }

async function ownAgent(workspaceId: string, agentId: string) {
  return prisma.agent.findFirst({
    where: { id: agentId, workspaceId },
    select: { id: true },
  })
}

export async function GET(_req: Request, props: Params) {
  const params = await props.params;
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!hasWorkspacePermission(user.role, 'agents:manage')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  if (!(await ownAgent(user.workspaceId, params.agentId)))
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const items = await prisma.knowledgeBase.findMany({
    where: { agentId: params.agentId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ items })
}

export async function POST(req: Request, props: Params) {
  const params = await props.params;
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!hasWorkspacePermission(user.role, 'agents:manage')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  if (!(await rateLimit(`knowledge-create:${user.workspaceId}`, 60, 3600, { failClosed: true }))) {
    return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
  }
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed) {
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  }
  if (!(await ownAgent(user.workspaceId, params.agentId)))
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const contentType = req.headers.get('content-type') ?? ''
  let name = ''
  let type: KBType = 'TEXT'
  let inlineText: string | undefined
  let sourceUrl: string | undefined
  let fileKey: string | undefined
  let fileName: string | undefined
  let fileSize: number | undefined
  // ─ F4: optional auto-refresh cadence for URL knowledge bases (hours).
  let refreshIntervalHours = 0

  if (contentType.includes('multipart/form-data')) {
    let rawBody: Buffer
    try {
      rawBody = await readBoundedRequestBody(req, MAX_MULTIPART_BYTES)
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 413 })
      }
      throw error
    }
    const form = await new Response(new Uint8Array(rawBody), {
      headers: { 'Content-Type': contentType },
    }).formData().catch(() => null)
    if (!form) return NextResponse.json({ error: 'INVALID_FORM' }, { status: 400 })
    const file = form.get('file') as File | null
    name = String(form.get('name') ?? file?.name ?? 'فایل')
    if (!file) return NextResponse.json({ error: 'NO_FILE' }, { status: 400 })
    name = name.trim().slice(0, 200)
    if (!isStorageConfigured())
      return NextResponse.json({ error: 'STORAGE_NOT_CONFIGURED' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'pdf' && ext !== 'csv') {
      return NextResponse.json({ error: 'INVALID_FILE_TYPE' }, { status: 415 })
    }
    type = ext === 'csv' ? 'CSV' : 'PDF'
    if (file.size === 0) return NextResponse.json({ error: 'EMPTY_FILE' }, { status: 400 })
    if (file.size > MAX_FILE_BYTES)
      return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    if (
      (type === 'PDF' && !matchesPdfSignature(buf)) ||
      (type === 'CSV' && !isProbablyUtf8Text(buf))
    ) {
      return NextResponse.json({ error: 'INVALID_FILE_CONTENT' }, { status: 415 })
    }

    const workspaceBudget = Number(process.env.KNOWLEDGE_UPLOAD_DAILY_BYTES)
    const globalBudget = Number(process.env.KNOWLEDGE_UPLOAD_GLOBAL_DAILY_BYTES)
    const allowedForWorkspace = await rateLimitCost(
      `knowledge-upload-bytes:${user.workspaceId}`,
      Number.isFinite(workspaceBudget) && workspaceBudget >= MAX_FILE_BYTES
        ? Math.floor(workspaceBudget)
        : DEFAULT_KNOWLEDGE_DAILY_BYTES,
      86_400,
      file.size,
      { failClosed: true },
    )
    const allowedGlobally = await rateLimitCost(
      'knowledge-upload-bytes:global',
      Number.isFinite(globalBudget) && globalBudget >= MAX_FILE_BYTES
        ? Math.floor(globalBudget)
        : DEFAULT_KNOWLEDGE_GLOBAL_DAILY_BYTES,
      86_400,
      file.size,
      { failClosed: true },
    )
    if (!allowedForWorkspace) {
      return NextResponse.json({ error: 'UPLOAD_QUOTA_EXCEEDED' }, { status: 429 })
    }
    if (!allowedGlobally) {
      return NextResponse.json({ error: 'UPLOAD_CAPACITY_EXCEEDED' }, { status: 503 })
    }

    const path = `${user.workspaceId}/${params.agentId}/${randomUUID()}.${ext}`
    fileKey = await uploadFile({
      bucket: BUCKETS.knowledge,
      path,
      body: buf,
      contentType: type === 'PDF' ? 'application/pdf' : 'text/csv; charset=utf-8',
    })
    fileName = file.name.replace(/[\u0000-\u001f\\/]/g, '_').slice(0, 255)
    fileSize = file.size
  } else {
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
      // handled as INVALID below
    }
    if (!json) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
    name = String(json.name ?? 'دانش')
    name = name.trim().slice(0, 200)
    const mode = String(json.mode ?? 'text')
    if (mode === 'url') {
      type = 'URL'
      sourceUrl = String(json.url ?? '').trim()
      if (sourceUrl.length > 2048) {
        return NextResponse.json({ error: 'INVALID_URL' }, { status: 400 })
      }
      try {
        await assertSafeHttpUrl(sourceUrl)
      } catch (error) {
        if (!(error instanceof UnsafeHttpTargetError)) console.error('[knowledge] URL validation failed:', error)
        return NextResponse.json({ error: 'INVALID_URL' }, { status: 400 })
      }
      // Parse the optional refresh cadence (0–168 hours, default 0 = manual).
      const rawHours = Number(json.refreshIntervalHours ?? 0)
      refreshIntervalHours =
        Number.isFinite(rawHours) && rawHours >= 0 && rawHours <= 168
          ? Math.floor(rawHours)
          : 0
    } else {
      type = json.type === 'FAQ' ? 'FAQ' : 'TEXT'
      inlineText = String(json.content ?? '')
      if (!inlineText.trim() || inlineText.length > 1_000_000)
        return NextResponse.json({ error: 'EMPTY' }, { status: 400 })
    }
  }

  const kb = await prisma.knowledgeBase.create({
    data: {
      agentId: params.agentId,
      workspaceId: user.workspaceId,
      name,
      type,
      sourceUrl,
      fileKey,
      fileName,
      fileSize,
      status: 'PENDING',
      // F4: only meaningful for URL type; ignored otherwise.
      refreshIntervalHours: type === 'URL' ? refreshIntervalHours : 0,
    },
  })

  await dispatchIngestion({ kbId: kb.id, text: inlineText })
  await syncOnboarding(user.workspaceId)

  return NextResponse.json({ kb }, { status: 201 })
}
