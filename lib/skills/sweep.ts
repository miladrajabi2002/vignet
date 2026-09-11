/**
 * Admin-only improvement skills — scheduler sweep.
 *
 * Every 6 hours the worker runs the FREE skills over the trailing week and
 * reaps stale RUNNING runs left behind by a crashed process. DEEP skills are
 * never scheduled: they cost platform AI budget and run only when the owner
 * explicitly triggers them from /admin/skills.
 */

import { prisma } from '@/lib/prisma'
import { runSkillsRun, startSkillsRun } from './engine'

const STALE_RUNNING_MS = 20 * 60_000

export async function sweepSkills(): Promise<void> {
  // Reap crashed runs first so they can never block fresh sweeps.
  await prisma.skillRun.updateMany({
    where: { status: 'RUNNING', createdAt: { lt: new Date(Date.now() - STALE_RUNNING_MS) } },
    data: { status: 'ERROR', error: 'STALE', finishedAt: new Date() },
  })
  const active = await prisma.skillRun.findFirst({ where: { status: 'RUNNING' }, select: { id: true } })
  if (active) return
  // One scheduled FREE sweep per rolling 6 hours.
  const recent = await prisma.skillRun.count({
    where: { source: 'scheduled', mode: 'FREE', createdAt: { gt: new Date(Date.now() - 6 * 3600_000) } },
  })
  if (recent) return
  const runId = await startSkillsRun('FREE', 'scheduled')
  await runSkillsRun(runId)
}
