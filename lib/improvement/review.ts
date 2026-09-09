import { autoApplyRun } from './automation'
import crypto from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { retrieveContext } from '@/lib/ai/rag'
import { improvementCompletion, parseModelJson } from './model'
import { conversationReviewSkillPrompt } from './conversation-review-skill'
import { behaviorValue, draftSchema, json, normalizedTopic, reviewSchema, transcriptSegments, validateFinding, validateReviewEvidence, type ReviewResult } from './types'

export async function processImprovement({ runId }: { runId: string }) {
  const run = await prisma.improvementRun.findUnique({ where: { id: runId } })
  if (!run || !['QUEUED', 'RUNNING'].includes(run.status)) return
  const claimed = await prisma.improvementRun.updateMany({ where: { id: runId, status: { in: ['QUEUED', 'RUNNING'] } }, data: { status: 'RUNNING', error: null } })
  if (!claimed.count) return
  const snapshot = run.snapshot as Record<string, unknown>
  const reviews = await prisma.improvementReview.findMany({ where: { runId, status: { not: 'DONE' } }, orderBy: { id: 'asc' } })
  let consecutiveErrors = 0
  let terminalError: string | null = null
  for (const review of reviews) {
    if ((await prisma.improvementRun.findUnique({ where: { id: runId }, select: { status: true } }))?.status !== 'RUNNING') return
    try {
      const claimedReview = await prisma.improvementReview.updateMany({ where: { id: review.id, status: 'PENDING' }, data: { status: 'PROCESSING', error: null } })
      if (!claimedReview.count) continue
      const [conversation, messages] = await Promise.all([
        prisma.conversation.findFirst({
          where: { id: review.conversationId, agentId: run.agentId, workspaceId: run.workspaceId },
          select: { contactId: true },
        }),
        prisma.message.findMany({
          where: { conversationId: review.conversationId, createdAt: { lte: run.createdAt }, role: { in: ['USER', 'ASSISTANT'] },
            conversation: { agentId: run.agentId, workspaceId: run.workspaceId } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, role: true, content: true, metadata: true },
        }),
      ])
      if (!conversation) throw new Error('CONVERSATION_NOT_FOUND')
      const segments = transcriptSegments(messages.map((m) => ({ id: m.id, role: m.role, content: m.content, operator: (m.metadata as Record<string, unknown> | null)?.operator === true })))
      const known = await prisma.improvementSuggestion.findMany({ where: { agentId: run.agentId }, orderBy: { updatedAt: 'desc' }, take: 100,
        select: { kind: true, topicKey: true, title: true, status: true } })
      const checkpoint = review.checkpoint as { next?: number; total?: number; result?: ReviewResult } | null
      let result: ReviewResult = checkpoint?.result ?? { intent: '', intentMessageIds: [], outcome: 'UNKNOWN', outcomeMessageIds: [], summary: '', strengths: [], findings: [] }
      const seen = new Set(segments.slice(0, checkpoint?.next ?? 0).flatMap((segment) => segment.map((m) => m.id)))
      for (let i = checkpoint?.next ?? 0; i < segments.length; i++) {
        if ((await prisma.improvementRun.findUnique({ where: { id: runId }, select: { status: true } }))?.status !== 'RUNNING') return
        for (const message of segments[i]) seen.add(message.id)
        const query = segments[i].filter((m) => m.role === 'USER').map((m) => m.content).join('\n').slice(0, 4000)
        const retrieved = query ? await retrieveContext({ workspaceId: run.workspaceId, agentId: run.agentId, query }) : { chunks: [] }
        // Only ready, current-version sources predating this run may ground analysis.
        const sources = await prisma.knowledgeBase.findMany({ where: {
          workspaceId: run.workspaceId, agentId: run.agentId, status: 'READY', updatedAt: { lte: run.createdAt },
          chunks: { some: { id: { in: retrieved.chunks.map((c) => c.id) } } },
        }, select: { id: true, name: true, type: true, updatedAt: true, approval: { select: { question: true, answer: true, knowledgeVersion: true } },
          chunks: { where: { id: { in: retrieved.chunks.map((c) => c.id) } }, select: { content: true } } } })
        const knowledgeIds = new Set(sources.map((s) => s.id))
        // Previous findings may reference sources retrieved in previous segments.
        for (const f of result.findings) if (f.draft.targetKnowledgeId) knowledgeIds.add(f.draft.targetKnowledgeId)
        const raw = await improvementCompletion(run.workspaceId, run.agentId, [
          { role: 'system', content: conversationReviewSkillPrompt(snapshot.language === 'en' ? 'en' : 'fa') },
          { role: 'user', content: JSON.stringify({ segment: i + 1, segments: segments.length, settingsAtRunStart: snapshot,
            relevantKnowledge: sources, knowledgeCoverage: 'Semantic retrieval of relevant ready sources; absence in this sample does not prove absence in the whole knowledge base.',
            contactAvailable: Boolean(conversation.contactId), knownTopics: known, previousAssessment: result, messages: segments[i] }) },
        ], typeof snapshot.model === 'string' ? snapshot.model : null, {
          // Every actual provider request owns a unique wallet reservation. A
          // user-requested retry is a new AI request and is therefore visible
          // and charged independently in the run ledger.
          idempotencyKey: `improvement:run:${runId}:review:${review.id}:segment:${i}:attempt:${crypto.randomUUID()}`,
          conversationId: review.conversationId,
        })
        const previousResult = result
        result = reviewSchema.parse(parseModelJson(raw))
        validateReviewEvidence(result, seen, messages.some((message) => message.role === 'USER'))
        for (const finding of result.findings) {
          validateFinding(finding, seen, knowledgeIds, conversation.contactId)
          finding.draft.scope = finding.scope
          finding.draft.contactId = finding.scope === 'CUSTOMER' ? conversation.contactId : null
          if (finding.draft.targetKnowledgeId) {
            const source = sources.find((s) => s.id === finding.draft.targetKnowledgeId)
            finding.draft.baseline = source?.approval ? { knowledgeVersion: source.approval.knowledgeVersion, question: source.approval.question, answer: source.approval.answer } : previousResult.findings.find((f) => f.draft.targetKnowledgeId === finding.draft.targetKnowledgeId)?.draft.baseline
          }
        }
        await prisma.improvementReview.updateMany({ where: { id: review.id, status: 'PROCESSING' }, data: { checkpoint: json({ next: i + 1, total: segments.length, result }) } })
      }
      if (!segments.length) result.summary = snapshot.language === 'en' ? 'No text messages available for review.' : 'پیام متنی برای بررسی موجود نیست.'
      // Atomically publish independent findings and mark the conversation complete.
      // Agent lock serializes topic merging with other runs and applying changes.
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Agent" WHERE id = ${run.agentId} FOR UPDATE`
        const currentRun = await tx.improvementRun.findUnique({ where: { id: runId } })
        if (currentRun?.status !== 'RUNNING') return
        const currentReview = await tx.improvementReview.findUnique({ where: { id: review.id } })
        if (!currentReview || currentReview.status === 'DONE') return
        for (const finding of result.findings) {
          const draft = { ...finding.draft }
          draft.scope = finding.scope
          draft.contactId = finding.scope === 'CUSTOMER' ? conversation.contactId : null
          if (finding.kind === 'BEHAVIOR' && finding.scope === 'AGENT' && draft.behaviorPath) {
            // Legacy freeform prompts cannot be silently replaced with an empty structured config.
            if (!snapshot.promptConfig) {
              finding.kind = 'TOOL'
              draft.missing = snapshot.language === 'en' ? 'Configure structured behavior first; the current agent uses a freeform prompt.' : 'ایجنت از دستور متنی استفاده می‌کند؛ ابتدا رفتار و لحن را در تنظیمات ساختاریافته تنظیم کنید.'
            } else {
              draft.baseline = behaviorValue(snapshot.promptConfig, draft.behaviorPath)
              if (draft.baseline === draft.behaviorValue || (draft.behaviorPath === 'doSay' && Array.isArray(draft.baseline) && draft.baseline.includes(draft.behaviorValue))) continue
            }
          }
          if (draft.targetKnowledgeId) {
            const kb = await tx.knowledgeBase.findFirst({ where: { id: draft.targetKnowledgeId, agentId: run.agentId, workspaceId: run.workspaceId, updatedAt: { lte: run.createdAt } }, include: { approval: true } })
            if (!kb?.approval) { draft.targetKnowledgeId = null; draft.answer = ''; draft.missing = snapshot.language === 'en' ? 'The source changed; verify the correct information.' : 'منبع تغییر کرده؛ اطلاعات صحیح را مشخص کنید.' }
            else if ((draft.baseline as { knowledgeVersion?: number } | undefined)?.knowledgeVersion !== kb.approval.knowledgeVersion) { draft.answer = ''; draft.missing = snapshot.language === 'en' ? 'Source changed. Run a fresh analysis.' : 'منبع تغییر کرده است؛ دوباره تحلیل کنید.' }
          }
          const topicKey = normalizedTopic(finding.topicKey)
          const candidates = await tx.improvementSuggestion.findMany({ where: { agentId: run.agentId, status: 'PENDING', kind: finding.kind, topicKey } })
          const existing = candidates.find((c) => {
            const d = c.draft as Record<string, unknown>
            return (d.scope ?? 'AGENT') === draft.scope && (d.contactId ?? null) === draft.contactId && d.targetKnowledgeId === draft.targetKnowledgeId && d.behaviorPath === draft.behaviorPath && d.behaviorValue === draft.behaviorValue && (draft.scope !== 'CUSTOMER' || d.answer === draft.answer)
          })
          if (existing && finding.kind === 'KNOWLEDGE') {
            const existingDraft = draftSchema.parse(existing.draft)
            if (existingDraft.answer && draft.answer && normalizedTopic(existingDraft.answer) !== normalizedTopic(draft.answer)) {
              const conflict = await tx.improvementSuggestion.updateMany({ where: { id: existing.id, version: existing.version, status: 'PENDING' }, data: {
                draft: json({ ...existingDraft, missing: snapshot.language === 'en' ? 'The source conversations contain different answers. Verify the correct answer using the evidence.' : 'گفتگوهای مرجع پاسخ‌های متفاوتی دارند؛ پاسخ صحیح را با بررسی شواهد مشخص کنید.' }),
                version: { increment: 1 }, preview: Prisma.DbNull, priority: 'HIGH',
              } })
              if (!conflict.count) throw new Error('CONFLICT')
            }
          }
          const suggestion = existing ?? await tx.improvementSuggestion.create({ data: {
            workspaceId: run.workspaceId, agentId: run.agentId, kind: finding.kind, topicKey,
            title: finding.title, diagnosis: finding.diagnosis, priority: finding.priority, draft: json(draft),
          } })
          for (const messageId of new Set(finding.messageIds)) {
            // Source may have been deleted while the model was running.
            if (!(await tx.message.count({ where: { id: messageId, conversationId: review.conversationId } }))) continue
            await tx.improvementEvidence.upsert({ where: { suggestionId_reviewId_messageId: { suggestionId: suggestion.id, reviewId: review.id, messageId } },
              create: { suggestionId: suggestion.id, reviewId: review.id, messageId }, update: {} })
          }
        }
        await tx.improvementReview.update({ where: { id: review.id }, data: { status: 'DONE', result: json(result), checkpoint: Prisma.DbNull, error: null } })
        await tx.conversation.updateMany({
          where: {
            id: review.conversationId,
            OR: [
              { lastImprovementReviewAt: null },
              { lastImprovementReviewAt: { lt: run.createdAt } },
            ],
          },
          data: { lastImprovementReviewAt: run.createdAt },
        })
      }, { timeout: 20000 })
      consecutiveErrors = 0
    } catch (error) {
      const code = error instanceof Error ? error.message : 'FAILED'
      console.error('[improvement] review failed', { runId, reviewId: review.id, code: code.slice(0, 80) })
      await prisma.improvementReview.updateMany({ where: { id: review.id, status: { not: 'DONE' } }, data: { status: 'ERROR', error: code === 'NO_CREDIT' ? 'NO_CREDIT' : 'ANALYSIS_FAILED' } })
      if (code === 'NO_CREDIT') {
        terminalError = code
        break
      }
      // Avoid spending an entire large batch on a provider outage. Remaining
      // conversations stay pending and the run can be resumed by the owner.
      consecutiveErrors++
      if (consecutiveErrors >= 3) break
    }
  }
  const errors = await prisma.improvementReview.count({ where: { runId, status: { not: 'DONE' } } })
  await prisma.improvementRun.updateMany({ where: { id: runId, status: 'RUNNING' }, data: { status: errors ? 'PARTIAL' : 'DONE', error: terminalError, finishedAt: new Date() } })
  if (!terminalError) await autoApplyRun(runId)
}
