import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminAuthedRequest } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { SKILL_FINDING_STATUSES } from '@/lib/skills/registry'

export const dynamic = 'force-dynamic'

const statusSchema = z.object({
  id: z.string().min(1).max(100),
  status: z.enum(SKILL_FINDING_STATUSES),
  note: z.string().trim().max(1000).optional(),
})

/** Lightweight polling endpoint for the skills dashboard while a run is active. */
export async function GET(req: Request) {
  if (!(await isAdminAuthedRequest(req))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  const [activeRun, open, high] = await Promise.all([
    prisma.skillRun.findFirst({
      where: { status: 'RUNNING' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, mode: true, source: true, status: true, createdAt: true, skills: true },
    }),
    prisma.skillFinding.count({ where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } } }),
    prisma.skillFinding.count({ where: { status: 'OPEN', severity: 'HIGH' } }),
  ])
  return NextResponse.json({ activeRun, open, high })
}

/** Owner triage: acknowledge, resolve, dismiss, or reopen a finding. */
export async function PATCH(req: Request) {
  if (!(await isAdminAuthedRequest(req))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }
  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  const { id, status, note } = parsed.data
  const finding = await prisma.skillFinding.findUnique({ where: { id } })
  if (!finding) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const updated = await prisma.skillFinding.update({
    where: { id },
    data: {
      status,
      resolvedAt: status === 'RESOLVED' ? new Date() : null,
      resolvedNote: status === 'RESOLVED' ? (note?.trim() || 'رسیدگی شد') : status === 'DISMISSED' ? (note?.trim() || 'نادیده گرفته شد') : null,
    },
    select: { id: true, status: true, resolvedAt: true, resolvedNote: true },
  })
  return NextResponse.json({ ok: true, finding: updated })
}
