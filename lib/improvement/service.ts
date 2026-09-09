import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { dispatchImprovement } from '@/lib/queue/jobs'
import { conversationWhere, json, withImprovementFreshness, type Selection } from './types'

export async function startImprovement(workspaceId: string, agentId: string, actorId: string, input: Selection, scheduled = false) {
  const run = await prisma.$transaction(async (tx) => {
    // Serialize run creation for this agent, including scheduled runs.
    await tx.$queryRaw`SELECT id FROM "Agent" WHERE id = ${agentId} AND "workspaceId" = ${workspaceId} FOR UPDATE`
    const agent = await tx.agent.findFirst({ where: { id: agentId, workspaceId } })
    if (!agent) throw new Error('NOT_FOUND')
    const active = await tx.improvementRun.findFirst({ where: { agentId, status: { in: ['QUEUED', 'RUNNING'] } } })
    if (active) throw new Error('RUN_ACTIVE')
    if (scheduled) {
      const recent = await tx.improvementRun.count({ where: { agentId, filters: { path: ['scheduled'], equals: true }, createdAt: { gt: new Date(Date.now() - 86400000) } } })
      if (recent) throw new Error('RUN_ACTIVE')
    }
    const conversations = await tx.conversation.findMany({
      where: withImprovementFreshness(
        conversationWhere(workspaceId, agentId, input),
        input.includeReviewed,
        tx.conversation.fields.lastImprovementReviewAt,
      ),
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
      take: input.mode === 'selected' ? input.ids.length : input.count,
      select: { id: true },
    })
    if (!conversations.length) throw new Error('NO_CONVERSATIONS')
    if (input.mode === 'selected' && conversations.length !== new Set(input.ids).size) throw new Error('SELECTION_CHANGED')
    return tx.improvementRun.create({ data: {
      agentId, workspaceId, createdBy: actorId, total: conversations.length, filters: json({ ...input, scheduled }),
      snapshot: json({ systemPrompt: agent.systemPrompt, promptConfig: agent.promptConfig, roleTemplate: agent.roleTemplate, language: agent.language,
        model: agent.model, handoffEnabled: agent.handoffEnabled, handoffKeywords: agent.handoffKeywords,
        productAccessEnabled: agent.productAccessEnabled, orderTrackingEnabled: agent.orderTrackingEnabled }),
      reviews: { create: conversations.map((c) => ({ conversationId: c.id })) },
    } })
  })
  try { await dispatchImprovement({ runId: run.id }) }
  catch {
    await prisma.improvementRun.update({ where: { id: run.id }, data: { status: 'ERROR', error: 'QUEUE_UNAVAILABLE' } })
    throw new Error('QUEUE_UNAVAILABLE')
  }
  return run
}

export async function retryImprovement(workspaceId: string, agentId: string, runId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Agent" WHERE id = ${agentId} AND "workspaceId" = ${workspaceId} FOR UPDATE`
    const run = await tx.improvementRun.findFirst({ where: { id: runId, agentId, workspaceId, status: { in: ['ERROR', 'PARTIAL'] } } })
    if (!run) throw new Error('CONFLICT')
    if (await tx.improvementRun.count({ where: { agentId, status: { in: ['QUEUED', 'RUNNING'] } } })) throw new Error('RUN_ACTIVE')
    await tx.improvementReview.updateMany({ where: { runId, status: { not: 'DONE' } }, data: { status: 'PENDING', error: null } })
    await tx.improvementRun.update({ where: { id: runId }, data: { status: 'QUEUED', error: null, finishedAt: null } })
  })
  try { await dispatchImprovement({ runId }) }
  catch {
    await prisma.improvementRun.update({ where: { id: runId }, data: { status: 'ERROR', error: 'QUEUE_UNAVAILABLE' } })
    throw new Error('QUEUE_UNAVAILABLE')
  }
}

export async function improvementOverview(workspaceId: string, agentId: string, page = 1, history = false, runPage = 1) {
  const [runs, suggestions, pendingCount, suggestionTotal, runTotal, activeRun] = await Promise.all([
    prisma.improvementRun.findMany({ where: { workspaceId, agentId }, orderBy: { createdAt: 'desc' }, take: 25, skip: (runPage - 1) * 25,
      select: { id: true, status: true, total: true, error: true, createdAt: true, finishedAt: true, filters: true,
        reviews: { select: { id: true, status: true } } } }),
    prisma.improvementSuggestion.findMany({ where: { workspaceId, agentId, status: history ? { not: 'PENDING' } : 'PENDING' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 25, skip: (page - 1) * 25,
      include: { evidence: { take: 30, select: { reviewId: true, messageId: true, review: { select: { conversationId: true, runId: true, run: { select: { createdAt: true } } } },
        message: { select: { content: true, role: true } } } }, changes: { orderBy: { createdAt: 'desc' }, take: 10 } } }),
    prisma.improvementSuggestion.count({ where: { workspaceId, agentId, status: 'PENDING' } }),
    prisma.improvementSuggestion.count({ where: { workspaceId, agentId, status: history ? { not: 'PENDING' } : 'PENDING' } }),
    prisma.improvementRun.count({ where: { workspaceId, agentId } }),
    prisma.improvementRun.findFirst({ where: { workspaceId, agentId, status: { in: ['QUEUED', 'RUNNING'] } }, select: { id: true, status: true, total: true, error: true, createdAt: true, filters: true, reviews: { select: { id: true, status: true } } } }),
  ])
  const knowledge = await prisma.knowledgeBase.findMany({ where: { workspaceId, agentId, id: { in: suggestions.flatMap((s) => s.changes.flatMap((c) => c.kind === 'KNOWLEDGE' && c.targetId ? [c.targetId] : [])) } }, select: { id: true, status: true } })
  // Observation, not a causal claim: denominator is newly reviewed conversations
  // since the change; recurrence requires the same diagnosed topic and kind.
  const monitoring = history ? await prisma.$queryRaw<Array<{ suggestionId: string; reviewed: bigint; recurring: bigint }>>`
    SELECT s.id AS "suggestionId",
      COUNT(DISTINCT r."conversationId") AS reviewed,
      COUNT(DISTINCT CASE WHEN EXISTS (
        SELECT 1 FROM "ImprovementEvidence" e JOIN "ImprovementSuggestion" other ON other.id = e."suggestionId"
        WHERE e."reviewId" = r.id AND other."agentId" = s."agentId" AND other.kind = s.kind AND other."topicKey" = s."topicKey"
      ) THEN r."conversationId" END) AS recurring
    FROM "ImprovementSuggestion" s
    JOIN "ImprovementChange" change ON change."suggestionId" = s.id AND change."revertedAt" IS NULL
    LEFT JOIN "ImprovementRun" run ON run."agentId" = s."agentId" AND run."workspaceId" = s."workspaceId" AND run."createdAt" > change."createdAt"
    LEFT JOIN "ImprovementReview" r ON r."runId" = run.id AND r.status = 'DONE'
    WHERE s."workspaceId" = ${workspaceId} AND s."agentId" = ${agentId} AND s.status = 'APPLIED'
    GROUP BY s.id` : []
  const evidenceCounts = suggestions.length ? await prisma.$queryRaw<Array<{ id: string; conversations: bigint }>>`SELECT e."suggestionId" AS id, COUNT(DISTINCT r."conversationId") AS conversations FROM "ImprovementEvidence" e JOIN "ImprovementReview" r ON r.id = e."reviewId" WHERE e."suggestionId" IN (${Prisma.join(suggestions.map((s) => s.id))}) GROUP BY e."suggestionId"` : []
  const runIds = [...new Set([...runs.map((run) => run.id), ...(activeRun ? [activeRun.id] : [])])]
  const usage = runIds.length ? await prisma.$queryRaw<Array<{ runId: string; chargedIRR: bigint; requestCount: bigint }>>`
    SELECT run.id AS "runId", COALESCE(SUM(log."chargedIRR"), 0) AS "chargedIRR", COUNT(log.id) AS "requestCount"
    FROM "ImprovementRun" run
    LEFT JOIN "UsageLog" log ON log."workspaceId" = run."workspaceId"
      AND log.type = 'LEARNING' AND log.status = 'CAPTURED'
      AND log."idempotencyKey" LIKE ('improvement:run:' || run.id || ':%')
    WHERE run.id IN (${Prisma.join(runIds)})
    GROUP BY run.id` : []
  const withUsage = <T extends { id: string }>(run: T) => {
    const row = usage.find((item) => item.runId === run.id)
    return {
      ...run,
      source: (run as T & { filters?: unknown }).filters && Boolean(((run as T & { filters?: Record<string, unknown> }).filters)?.scheduled) ? 'automatic' : 'manual',
      chargedIRR: Number(row?.chargedIRR ?? 0),
      requestCount: Number(row?.requestCount ?? 0),
    }
  }
  return { runs: runs.map(withUsage), runTotal, activeRun: activeRun ? withUsage(activeRun) : null, suggestionTotal, suggestions: suggestions.map((s) => ({ ...s, conversationCount: Number(evidenceCounts.find((e) => e.id === s.id)?.conversations ?? 0), monitoring: monitoring.some((m) => m.suggestionId === s.id) ? { reviewed: Number(monitoring.find((m) => m.suggestionId === s.id)!.reviewed), recurring: Number(monitoring.find((m) => m.suggestionId === s.id)!.recurring) } : null, knowledgeStatus: knowledge.find((k) => s.changes.some((c) => !c.revertedAt && c.targetId === k.id))?.status ?? null, evidence: s.evidence.map((e) => ({ ...e, message: { ...e.message, content: e.message.content.slice(0, 1200) } })) })), pendingCount }
}

export function publicError(error: unknown) {
  const code = error instanceof Error ? error.message : 'FAILED'
  const allowed = ['NOT_FOUND', 'RUN_ACTIVE', 'NO_CONVERSATIONS', 'SELECTION_CHANGED', 'QUEUE_UNAVAILABLE', 'CONFLICT', 'AI_UNAVAILABLE', 'NO_CREDIT', 'MISSING_INFORMATION', 'INVALID_BEHAVIOR', 'KNOWLEDGE_CHANGED', 'BEHAVIOR_CHANGED', 'UNSUPPORTED_KNOWLEDGE', 'TEST_REQUIRED', 'INGESTION_UNAVAILABLE', 'INVALID_CONTENT', 'NO_TEST_MESSAGE', 'TOOL_MANUAL', 'EVIDENCE_REQUIRED']
  return allowed.includes(code) ? code : error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' ? 'CONFLICT' : 'FAILED'
}
