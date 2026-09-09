import { prisma } from '@/lib/prisma'
import { settingsSchema, selectionSchema, draftSchema } from './types'
import { startImprovement } from './service'
import { applyImprovement, previewImprovement } from './actions'

/** At most one schedule run per agent per rolling day, selected under the same
 * agent lock as manual starts. Failed runs stay visible for explicit retry. */
export async function sweepImprovement() {
  const agents = await prisma.agent.findMany({ where: { active: true, improvementSettings: { path: ['daily'], equals: true } },
    select: { id: true, workspaceId: true, improvementSettings: true }, take: 100 })
  for (const agent of agents) {
    try {
      const settings = settingsSchema.parse(agent.improvementSettings)
      const actorId = (agent.improvementSettings as Record<string, unknown>).authorizedBy
      if (typeof actorId !== 'string' || !(await prisma.user.count({ where: { id: actorId, workspaceId: agent.workspaceId } }))) continue
      const previous = await prisma.improvementRun.findFirst({ where: { agentId: agent.id, filters: { path: ['scheduled'], equals: true } }, orderBy: { createdAt: 'desc' } })
      if (previous && Date.now() - previous.createdAt.getTime() < 86400000) continue
      // Oldest unreviewed updates first: a daily limit must not permanently skip a backlog.
      const candidates = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT c.id FROM "Conversation" c
        WHERE c."agentId" = ${agent.id} AND c."workspaceId" = ${agent.workspaceId}
          AND c."lastMessageAt" IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "ImprovementReview" r JOIN "ImprovementRun" j ON j.id = r."runId"
            WHERE r."conversationId" = c.id AND r.status = 'DONE' AND j."createdAt" >= c."lastMessageAt")
        ORDER BY c."lastMessageAt" ASC, c.id ASC LIMIT ${settings.count}`
      if (!candidates.length) continue
      const input = selectionSchema.parse({ mode: 'selected', ids: candidates.map((c) => c.id), count: settings.count })
      await startImprovement(agent.workspaceId, agent.id, actorId, input, true)
    } catch (error) {
      const code = error instanceof Error ? error.message : 'FAILED'
      if (!['RUN_ACTIVE', 'NO_CONVERSATIONS'].includes(code)) console.error('[improvement] scheduled review unavailable')
    }
  }
}

export async function autoApplyRun(runId: string) {
  const run = await prisma.improvementRun.findUnique({ where: { id: runId }, include: { agent: true } })
  if (!run || !['DONE', 'PARTIAL'].includes(run.status)) return
  const settings = settingsSchema.parse(run.agent.improvementSettings ?? {})
  const actorId = (run.agent.improvementSettings as Record<string, unknown> | null)?.authorizedBy
  if (!settings.autoBehavior || typeof actorId !== 'string' || !(await prisma.user.count({ where: { id: actorId, workspaceId: run.workspaceId } }))) return
  const suggestions = await prisma.improvementSuggestion.findMany({ where: { agentId: run.agentId, workspaceId: run.workspaceId, status: 'PENDING', kind: 'BEHAVIOR', evidence: { some: { review: { runId } } } },
    include: { evidence: { select: { review: { select: { conversationId: true } } } } } })
  for (const s of suggestions) {
    const draft = draftSchema.parse(s.draft)
    if (draft.scope !== 'AGENT') continue
    if (!settings.allowedPaths.includes(draft.behaviorPath as 'format.length' | 'conversation.avoidRepeatedGreetings') || new Set(s.evidence.map((e) => e.review.conversationId)).size < 3) continue
    try {
      const preview = await previewImprovement(run.workspaceId, run.agentId, s.id, s.version, 'automatic')
      if (!preview.assessment.improved) continue
      await applyImprovement(run.workspaceId, run.agentId, actorId, s.id, s.version, true)
    } catch { /* Keep the suggestion pending for the owner; never broaden scope. */ }
  }
}
