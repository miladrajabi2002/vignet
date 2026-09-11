/**
 * Live smoke test for the admin improvement skills.
 *
 * Runs a full FREE pass (and optionally DEEP with SKILLS_DEEP=1) against the
 * real database, then prints every finding so the owner can verify exactly
 * what the skills discovered. Read-mostly: writes only to SkillFinding/SkillRun.
 *
 * Usage:  npx tsx -r dotenv/config scripts/skills-smoke.ts [FREE|DEEP]
 */
import { prisma } from '@/lib/prisma'
import { runSkillsRun, startSkillsRun } from '@/lib/skills/engine'

async function main() {
  const mode = (process.argv[2] ?? 'FREE').toUpperCase() === 'DEEP' ? 'DEEP' : 'FREE'
  console.log(`[skills-smoke] starting ${mode} pass…`)
  const runId = await startSkillsRun(mode as 'FREE' | 'DEEP', 'manual')
  await runSkillsRun(runId)
  const run = await prisma.skillRun.findUniqueOrThrow({ where: { id: runId } })
  console.log('[skills-smoke] run:', {
    status: run.status,
    error: run.error,
    agentsScanned: run.agentsScanned,
    conversationsScanned: run.conversationsScanned,
    findingsCreated: run.findingsCreated,
    findingsUpdated: run.findingsUpdated,
    findingsResolved: run.findingsResolved,
    llmRequests: run.llmRequests,
    durationMs: run.durationMs,
  })
  const findings = await prisma.skillFinding.findMany({
    orderBy: [{ status: 'asc' }, { lastSeenAt: 'desc' }],
    take: 60,
    include: { agent: { select: { name: true, workspace: { select: { name: true } } } } },
  })
  for (const finding of findings) {
    console.log('—'.repeat(80))
    console.log(`[${finding.status}] (${finding.severity}) ${finding.skillKey} · ${finding.agent?.name ?? '-'} @ ${finding.agent?.workspace.name ?? '-'}`)
    console.log(`  ${finding.title}`)
    console.log(`  ${finding.diagnosis.split('\n').slice(0, 4).join('\n  ')}`)
  }
  const counts = await prisma.skillFinding.groupBy({ by: ['skillKey', 'status'], _count: { _all: true } })
  console.log('[skills-smoke] counts:', counts.map((c) => `${c.skillKey}/${c.status}=${c._count._all}`).join('  '))
  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error('[skills-smoke] failed', error)
  await prisma.$disconnect()
  process.exit(1)
})
