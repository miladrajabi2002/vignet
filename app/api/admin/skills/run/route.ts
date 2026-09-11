import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminAuthedRequest } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { runSkillsRun, startSkillsRun } from '@/lib/skills/engine'

export const dynamic = 'force-dynamic'

const STALE_RUNNING_MS = 20 * 60_000

const runSchema = z.object({ mode: z.enum(['FREE', 'DEEP']) })

/**
 * Start a skills pass. The HTTP request returns immediately with the durable
 * run id; the engine keeps executing in this server process and the dashboard
 * polls GET /api/admin/skills until the run finishes. A stale RUNNING run
 * (crashed process) is reaped first so it can never block a fresh start.
 */
export async function POST(req: Request) {
  if (!(await isAdminAuthedRequest(req))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }
  const parsed = runSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })

  await prisma.skillRun.updateMany({
    where: { status: 'RUNNING', createdAt: { lt: new Date(Date.now() - STALE_RUNNING_MS) } },
    data: { status: 'ERROR', error: 'STALE', finishedAt: new Date() },
  })
  const active = await prisma.skillRun.findFirst({ where: { status: 'RUNNING' }, select: { id: true } })
  if (active) return NextResponse.json({ error: 'RUN_ACTIVE' }, { status: 409 })

  const runId = await startSkillsRun(parsed.data.mode, 'manual')
  // Fire-and-forget: the durable SkillRun row is the source of truth.
  setImmediate(() => {
    runSkillsRun(runId).catch((error) => console.error('[skills] manual run crashed', { runId, error }))
  })
  return NextResponse.json({ ok: true, runId })
}
