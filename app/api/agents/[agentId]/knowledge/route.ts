import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { uploadFile, BUCKETS, isStorageConfigured } from '@/lib/storage'
import { dispatchIngestion } from '@/lib/queue/jobs'
import { syncOnboarding } from '@/lib/onboarding'
import type { KBType } from '@prisma/client'

type Params = { params: { agentId: string } }

async function ownAgent(workspaceId: string, agentId: string) {
  return prisma.agent.findFirst({
    where: { id: agentId, workspaceId },
    select: { id: true },
  })
}

export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await ownAgent(user.workspaceId, params.agentId)))
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const items = await prisma.knowledgeBase.findMany({
    where: { agentId: params.agentId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ items })
}

export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
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
    const form = await req.formData()
    const file = form.get('file') as File | null
    name = String(form.get('name') ?? file?.name ?? 'فایل')
    if (!file) return NextResponse.json({ error: 'NO_FILE' }, { status: 400 })
    if (!isStorageConfigured())
      return NextResponse.json({ error: 'STORAGE_NOT_CONFIGURED' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase()
    type = ext === 'csv' ? 'CSV' : 'PDF'
    if (file.size > 20 * 1024 * 1024)
      return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const path = `${user.workspaceId}/${params.agentId}/${Date.now()}-${file.name}`
    fileKey = await uploadFile({
      bucket: BUCKETS.knowledge,
      path,
      body: buf,
      contentType: file.type || 'application/octet-stream',
    })
    fileName = file.name
    fileSize = file.size
  } else {
    const json = await req.json().catch(() => null)
    if (!json) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
    name = String(json.name ?? 'دانش')
    const mode = String(json.mode ?? 'text')
    if (mode === 'url') {
      type = 'URL'
      sourceUrl = String(json.url ?? '')
      if (!/^https?:\/\//.test(sourceUrl))
        return NextResponse.json({ error: 'INVALID_URL' }, { status: 400 })
      // Parse the optional refresh cadence (0–168 hours, default 0 = manual).
      const rawHours = Number(json.refreshIntervalHours ?? 0)
      refreshIntervalHours =
        Number.isFinite(rawHours) && rawHours >= 0 && rawHours <= 168
          ? Math.floor(rawHours)
          : 0
    } else {
      type = json.type === 'FAQ' ? 'FAQ' : 'TEXT'
      inlineText = String(json.content ?? '')
      if (!inlineText.trim())
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
