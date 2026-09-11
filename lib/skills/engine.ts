/**
 * Admin-only improvement skills — execution engine.
 *
 * One durable SkillRun row drives a whole pass. FREE mode is pure database
 * analysis (scheduler-safe, zero AI cost); DEEP mode additionally samples
 * conversations and knowledge bases through the PLATFORM AI budget — never a
 * workspace wallet, so store owners neither pay for nor ever see this.
 *
 * REVIEW WINDOW POLICY (owner, 2026-09-12): only TODAY's conversations are
 * reviewed. Old conversations are deliberately skipped — the agent has
 * changed a lot since then, so findings derived from them are stale. The
 * window starts at midnight Asia/Tehran (the platform's operating timezone;
 * Iran keeps a fixed UTC+03:30 offset, no DST since 2022). Findings that are
 * not re-observed during today's pass are auto-resolved as stale.
 *
 * Every query is bounded (caps + window) so a sweep stays cheap even on a busy
 * platform, and every write is idempotent through the (skillKey, dedupeKey)
 * uniqueness contract in lib/skills/findings.ts.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { chatCompletion, getPlatformOpenRouterKey, type ChatMessage } from '@/lib/ai/openrouter'
import { applyPlatformModelPolicy, getPlatformAiConfig, hasPlatformAiBudget } from '@/lib/ai/platform-config'
import { resolveModelAlias, resolveModelId } from '@/lib/ai/models'
import { readCustomerAgentPreferences } from '@/lib/ai/customer-agent-preferences'
import {
  candidateConflictPairs,
  conflictPrompt,
  detectKnowledgeGaps,
  detectPostChanges,
  detectPreferenceViolations,
  detectToolFailures,
  normalizeKnowledgeConflicts,
  normalizeToneReview,
  parseModelJsonSafe,
  toneReviewPrompt,
  type FindingDraft,
  type KnowledgeGapAgentInput,
  type MetricWindow,
  type PostChangeInput,
  type PreferenceContactInput,
  type ReceiptTurnInput,
} from './detectors'
import { markClean, persistFindings, type PersistStats } from './findings'
import { DEEP_SKILL_KEYS, FREE_SKILL_KEYS, type SkillKey } from './registry'

// Only the post-change "before" baseline still uses a 7-day look-back; every
// conversation scanned by the skills themselves comes from today only.
const WINDOW_DAYS = 7
const DAY_MS = 86_400_000

/** Iran's fixed offset (UTC+03:30, no DST since 2022). The server and Postgres
 * both run in Asia/Tehran, and the platform's display timezone is the same. */
const TEHRAN_OFFSET_MS = 3.5 * 3_600_000

/** Start of the current day (midnight) in Asia/Tehran, independent of the host
 * machine's local timezone. All conversation review windows start here. */
function startOfToday(): Date {
  const wall = new Date(Date.now() + TEHRAN_OFFSET_MS)
  return new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()) - TEHRAN_OFFSET_MS)
}

// Caps — one sweep must stay bounded on a busy platform.
const MAX_RECEIPT_MESSAGES = 1500
const MAX_PAIRING_USER_MESSAGES = 4000
const MAX_UNANSWERED = 600
const MAX_SUGGESTIONS = 200
const MAX_EVIDENCE_ROWS = 3000
const MAX_PREFERENCE_CONTACTS = 60
const DEEP_MAX_AGENTS = 6
const DEEP_TONE_CONVERSATIONS_PER_AGENT = 3
const DEEP_TONE_TRANSCRIPT_MESSAGES = 16
const DEEP_TONE_TRANSCRIPT_SLICE = 400
const DEEP_CONFLICT_SOURCES_PER_AGENT = 40
const DEEP_CONFLICT_PAIRS_PER_AGENT = 12
const DEEP_MAX_LLM_REQUESTS = 30

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function parseReceipts(value: unknown): Array<{ kind: string; count?: number }> {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const row = asRecord(item)
    return typeof row.kind === 'string' ? [{ kind: row.kind, count: typeof row.count === 'number' ? row.count : undefined }] : []
  })
}

/** Platform-funded completion (NOT improvementCompletion: no workspace billing). */
async function platformCompletion(messages: ChatMessage[]): Promise<string | null> {
  try {
    const config = await getPlatformAiConfig()
    if (!getPlatformOpenRouterKey() || !(await hasPlatformAiBudget(config))) return null
    const alias = applyPlatformModelPolicy(resolveModelAlias(null), config)
    const model = resolveModelId(alias, config.providerModels)
    const result = await chatCompletion({ model, task: 'learning-review', temperature: 0.1, maxTokens: 3000, messages })
    return result.content
  } catch (error) {
    console.error('[skills] platform completion failed', error)
    return null
  }
}

interface AgentRow {
  agentId: string
  workspaceId: string
  name: string
  workspaceName: string
  language: string
}

interface RunStats extends PersistStats {
  agentsScanned: number
  conversationsScanned: number
  llmRequests: number
  resolved: number
  deepSkipped?: string | null
}

// ─── Data collection ─────────────────────────────────────────────────────────

async function activeAgents(since: Date): Promise<AgentRow[]> {
  // NOTE on raw Date parameters: our DateTime columns are naive UTC wall
  // clocks, but $queryRaw Date params arrive as timestamptz — comparing them
  // directly lets the session timezone shift the boundary by 3.5h. Wrapping
  // the parameter in (… AT TIME ZONE 'UTC') keeps raw queries in exact
  // agreement with Prisma typed queries, whatever the session timezone is.
  return prisma.$queryRaw<AgentRow[]>`
    SELECT a.id AS "agentId", a."workspaceId", a.name, w.name AS "workspaceName", a.language,
           MAX(c."lastMessageAt") AS "lastActiveAt"
    FROM "Agent" a
    JOIN "Workspace" w ON w.id = a."workspaceId"
    JOIN "Conversation" c ON c."agentId" = a.id AND c."lastMessageAt" > (${since} AT TIME ZONE 'UTC')
    WHERE w."excludeFromAdminReports" = false
    GROUP BY a.id, a."workspaceId", a.name, w.name, a.language
    ORDER BY "lastActiveAt" DESC`
}

interface ReceiptRow {
  id: string
  conversationId: string
  agentId: string
  workspaceId: string
  createdAt: Date
  content: string
  receipts: unknown
}

async function receiptTurns(since: Date): Promise<ReceiptTurnInput[]> {
  const rows = await prisma.$queryRaw<ReceiptRow[]>`
    SELECT m.id, m."conversationId", c."agentId", c."workspaceId", m."createdAt",
           LEFT(m.content, 2000) AS content, m.metadata->'vigentoReceipts' AS receipts
    FROM "Message" m
    JOIN "Conversation" c ON c.id = m."conversationId"
    JOIN "Workspace" w ON w.id = c."workspaceId"
    WHERE m.role = 'ASSISTANT' AND m."createdAt" > (${since} AT TIME ZONE 'UTC')
      AND m.metadata ? 'vigentoReceipts'
      AND w."excludeFromAdminReports" = false
    ORDER BY m."createdAt" DESC
    LIMIT ${MAX_RECEIPT_MESSAGES}`
  if (!rows.length) return []
  const conversationIds = [...new Set(rows.map((r) => r.conversationId))]
  const userRows = await prisma.$queryRaw<Array<{ id: string; conversationId: string; createdAt: Date; content: string }>>`
    SELECT m.id, m."conversationId", m."createdAt", LEFT(m.content, 300) AS content
    FROM "Message" m
    WHERE m.role = 'USER' AND m."createdAt" > (${since} AT TIME ZONE 'UTC')
      AND m."conversationId" IN (${Prisma.join(conversationIds)})
    ORDER BY m."createdAt" ASC
    LIMIT ${MAX_PAIRING_USER_MESSAGES}`
  const byConversation = new Map<string, Array<{ id: string; createdAt: Date; content: string }>>()
  for (const row of userRows) {
    const list = byConversation.get(row.conversationId) ?? []
    list.push({ id: row.id, createdAt: row.createdAt, content: row.content })
    byConversation.set(row.conversationId, list)
  }
  return rows.map((row) => {
    const candidates = (byConversation.get(row.conversationId) ?? []).filter((u) => u.createdAt <= row.createdAt)
    const preceding = candidates[candidates.length - 1]
    return {
      messageId: row.id,
      conversationId: row.conversationId,
      agentId: row.agentId,
      workspaceId: row.workspaceId,
      createdAt: row.createdAt,
      content: row.content ?? '',
      receipts: parseReceipts(row.receipts),
      userContent: preceding?.content,
    }
  })
}

interface UnansweredRow {
  id: string
  conversationId: string
  agentId: string
  workspaceId: string
  createdAt: Date
  content: string
}

async function unansweredMessages(since: Date): Promise<UnansweredRow[]> {
  return prisma.$queryRaw<UnansweredRow[]>`
    SELECT m.id, m."conversationId", c."agentId", c."workspaceId", m."createdAt", LEFT(m.content, 300) AS content
    FROM "Message" m
    JOIN "Conversation" c ON c.id = m."conversationId"
    JOIN "Workspace" w ON w.id = c."workspaceId"
    WHERE m.role = 'USER' AND m.unanswered = true AND m."createdAt" > (${since} AT TIME ZONE 'UTC')
      AND w."excludeFromAdminReports" = false
    ORDER BY m."createdAt" DESC
    LIMIT ${MAX_UNANSWERED}`
}

/** Pending suggestions feed the knowledge-gap and tool-failure skills. Owner
 * policy: only suggestions raised from TODAY's improvement runs are in scope —
 * suggestions derived from old conversations are finished and no longer
 * reviewed. */
async function pendingSuggestions(since: Date) {
  return prisma.improvementSuggestion.findMany({
    where: { status: 'PENDING', createdAt: { gte: since }, agent: { workspace: { excludeFromAdminReports: false } } },
    take: MAX_SUGGESTIONS,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, kind: true, topicKey: true, title: true, diagnosis: true, draft: true,
      agentId: true, workspaceId: true,
      agent: { select: { name: true } },
      evidence: { select: { review: { select: { conversationId: true } } } },
    },
  })
}

async function unresolvedReviewCounts(since: Date): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ agentId: string; n: bigint }>>`
    SELECT run."agentId" AS "agentId", COUNT(*) AS n
    FROM "ImprovementReview" r
    JOIN "ImprovementRun" run ON run.id = r."runId"
    JOIN "Agent" a ON a.id = run."agentId"
    JOIN "Workspace" w ON w.id = a."workspaceId"
    WHERE r.status = 'DONE' AND run."createdAt" > (${since} AT TIME ZONE 'UTC')
      AND r.result->>'outcome' = 'UNRESOLVED'
      AND w."excludeFromAdminReports" = false
    GROUP BY run."agentId"`
  return new Map(rows.map((r) => [r.agentId, Number(r.n)]))
}

interface EvidenceRow {
  reviewId: string
  conversationId: string
  reviewedAt: Date
  suggestionId: string
  kind: string
  topicKey: string
}

/** Recurrence evidence comes ONLY from today's improvement reviews — the
 * post-change guard answers "did the problem come back in today's
 * conversations?", never "did it ever come back?". */
async function appliedChangesWithEvidence(since: Date) {
  const changes = await prisma.improvementChange.findMany({
    where: { revertedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true, createdAt: true, suggestionId: true,
      suggestion: { select: { kind: true, topicKey: true, title: true, agentId: true, workspaceId: true } },
    },
  })
  if (!changes.length) return { changes, evidence: [] as EvidenceRow[] }
  const evidence = await prisma.$queryRaw<EvidenceRow[]>`
    SELECT e."reviewId", r."conversationId", run."createdAt" AS "reviewedAt", s.id AS "suggestionId", s.kind, s."topicKey"
    FROM "ImprovementEvidence" e
    JOIN "ImprovementReview" r ON r.id = e."reviewId"
    JOIN "ImprovementRun" run ON run.id = r."runId"
    JOIN "ImprovementSuggestion" s ON s.id = e."suggestionId"
    WHERE run."createdAt" >= (${since} AT TIME ZONE 'UTC') AND r.status = 'DONE'
    ORDER BY run."createdAt" ASC
    LIMIT ${MAX_EVIDENCE_ROWS}`
  return { changes, evidence }
}

async function windowMetrics(agentId: string, from: Date, to: Date): Promise<MetricWindow> {
  const [messageRow] = await prisma.$queryRaw<Array<{ userMessages: bigint; unanswered: bigint; assistantMessages: bigint; modelErrors: bigint }>>`
    SELECT COUNT(*) FILTER (WHERE m.role = 'USER') AS "userMessages",
           COUNT(*) FILTER (WHERE m.role = 'USER' AND m.unanswered) AS "unanswered",
           COUNT(*) FILTER (WHERE m.role = 'ASSISTANT') AS "assistantMessages",
           COUNT(*) FILTER (WHERE m.role = 'ASSISTANT' AND m.metadata->'vigentoReceipts' @> '[{"kind":"model_error"}]') AS "modelErrors"
    FROM "Message" m
    JOIN "Conversation" c ON c.id = m."conversationId"
    WHERE c."agentId" = ${agentId} AND m."createdAt" >= (${from} AT TIME ZONE 'UTC') AND m."createdAt" < (${to} AT TIME ZONE 'UTC')`
  const reviewRows = await prisma.$queryRaw<Array<{ outcome: string; n: bigint }>>`
    SELECT r.result->>'outcome' AS outcome, COUNT(*) AS n
    FROM "ImprovementReview" r
    JOIN "ImprovementRun" run ON run.id = r."runId"
    WHERE run."agentId" = ${agentId} AND r.status = 'DONE' AND run."createdAt" >= (${from} AT TIME ZONE 'UTC') AND run."createdAt" < (${to} AT TIME ZONE 'UTC')
    GROUP BY 1`
  const resolved = Number(reviewRows.find((r) => r.outcome === 'RESOLVED')?.n ?? 0)
  const reviews = reviewRows.reduce((sum, r) => sum + Number(r.n), 0)
  return {
    reviews,
    resolved,
    userMessages: Number(messageRow?.userMessages ?? 0),
    unanswered: Number(messageRow?.unanswered ?? 0),
    assistantMessages: Number(messageRow?.assistantMessages ?? 0),
    modelErrors: Number(messageRow?.modelErrors ?? 0),
  }
}

async function preferenceContacts(since: Date): Promise<PreferenceContactInput[]> {
  const rows = await prisma.$queryRaw<Array<{ contactId: string; workspaceId: string; name: string | null; metadata: unknown }>>`
    SELECT ct.id AS "contactId", ct."workspaceId", ct.name, ct.metadata
    FROM "Contact" ct
    JOIN "Workspace" w ON w.id = ct."workspaceId"
    WHERE ct.metadata ? 'agentInteractionPreferences' AND w."excludeFromAdminReports" = false
    ORDER BY ct."updatedAt" DESC
    LIMIT 200`
  const contacts: PreferenceContactInput[] = []
  for (const row of rows.slice(0, MAX_PREFERENCE_CONTACTS)) {
    const byAgent = asRecord(asRecord(row.metadata).agentInteractionPreferences)
    for (const agentId of Object.keys(byAgent)) {
      const preferences = readCustomerAgentPreferences(row.metadata, agentId)
      if (!preferences.length) continue
      const earliest = preferences.reduce((min, p) => Math.min(min, p.createdAt ? new Date(p.createdAt).getTime() || Date.now() : Date.now()), Date.now())
      // Preference guard checks only today's product suggestions (owner
      // policy: old conversations are finished and no longer reviewed).
      const from = new Date(Math.max(earliest, since.getTime()))
      const messages = await prisma.$queryRaw<Array<{ messageId: string; conversationId: string; createdAt: Date; content: string }>>`
        SELECT m.id AS "messageId", m."conversationId", m."createdAt", LEFT(m.content, 1200) AS content
        FROM "Message" m
        JOIN "Conversation" c ON c.id = m."conversationId"
        WHERE c."contactId" = ${row.contactId} AND c."agentId" = ${agentId}
          AND m.role = 'ASSISTANT' AND m."createdAt" > (${from} AT TIME ZONE 'UTC')
          AND m.content LIKE '%[[product:%'
        ORDER BY m."createdAt" DESC
        LIMIT 40`
      contacts.push({
        contactId: row.contactId,
        workspaceId: row.workspaceId,
        agentId,
        contactName: row.name ?? undefined,
        preferences: preferences.map((p) => ({ id: p.id, text: p.text, createdAt: new Date(p.createdAt || Date.now()) })),
        productMessages: messages.map((m) => ({ messageId: m.messageId, conversationId: m.conversationId, content: m.content ?? '', createdAt: m.createdAt })),
      })
    }
  }
  return contacts
}

// ─── FREE pass ───────────────────────────────────────────────────────────────

async function runFree(): Promise<RunStats> {
  // Owner policy: review only TODAY's conversations (midnight Asia/Tehran
  // onward). Yesterday and older are finished — the agent changed too much
  // since then for their findings to still be actionable.
  const since = startOfToday()
  const [agents, turns, unanswered, suggestions, unresolved, changesBundle, contacts] = await Promise.all([
    activeAgents(since),
    receiptTurns(since),
    unansweredMessages(since),
    pendingSuggestions(since),
    unresolvedReviewCounts(since),
    appliedChangesWithEvidence(since),
    preferenceContacts(since),
  ])
  const agentById = new Map(agents.map((a) => [a.agentId, a]))

  // ── Knowledge Gap Curator
  const gapAgents: KnowledgeGapAgentInput[] = agents.map((agent) => ({
    agentId: agent.agentId,
    workspaceId: agent.workspaceId,
    agentName: agent.name,
    unanswered: unanswered
      .filter((u) => u.agentId === agent.agentId)
      .map((u) => ({ messageId: u.id, conversationId: u.conversationId, content: u.content ?? '', createdAt: u.createdAt })),
    pendingKnowledge: [],
    unresolvedReviews: unresolved.get(agent.agentId) ?? 0,
  }))
  const gapAgentById = new Map(gapAgents.map((g) => [g.agentId, g]))
  for (const suggestion of suggestions) {
    if (suggestion.kind !== 'KNOWLEDGE') continue
    const draft = asRecord(suggestion.draft)
    const gap = gapAgentById.get(suggestion.agentId)
    const entry = {
      suggestionId: suggestion.id,
      topicKey: suggestion.topicKey,
      title: suggestion.title,
      diagnosis: suggestion.diagnosis,
      draftQuestion: typeof draft.question === 'string' ? draft.question : '',
      draftAnswer: typeof draft.answer === 'string' ? draft.answer : '',
      evidenceConversations: new Set(suggestion.evidence.map((e) => e.review.conversationId)).size,
    }
    if (gap) gap.pendingKnowledge.push(entry)
    else gapAgents.push({
      agentId: suggestion.agentId,
      workspaceId: suggestion.workspaceId,
      agentName: suggestion.agent?.name,
      unanswered: [],
      pendingKnowledge: [entry],
      unresolvedReviews: 0,
    })
  }
  const gapResult = detectKnowledgeGaps(gapAgents)

  // ── Tool Failure Investigator
  const toolResult = detectToolFailures(
    agents.map((a) => ({ agentId: a.agentId, workspaceId: a.workspaceId, agentName: a.name })),
    turns,
    suggestions
      .filter((s) => s.kind === 'TOOL')
      .map((s) => ({
        suggestionId: s.id,
        agentId: s.agentId,
        workspaceId: s.workspaceId,
        title: s.title,
        diagnosis: s.diagnosis,
        evidenceConversations: new Set(s.evidence.map((e) => e.review.conversationId)).size,
      })),
  )

  // ── Post-change Monitor + Before/After Evaluation
  const reviewsByChange: PostChangeInput[] = []
  for (const change of changesBundle.changes) {
    const afterRows = changesBundle.evidence.filter((e) => e.reviewedAt > change.createdAt)
    // One entry per review (a review may evidence several suggestions).
    const byReview = new Map<string, { reviewId: string; conversationId: string; createdAt: Date; topics: Array<{ kind: string; topicKey: string }> }>()
    for (const row of afterRows) {
      const entry = byReview.get(row.reviewId) ?? {
        reviewId: row.reviewId, conversationId: row.conversationId, createdAt: row.reviewedAt, topics: [],
      }
      entry.topics.push({ kind: row.kind, topicKey: row.topicKey })
      byReview.set(row.reviewId, entry)
    }
    const agent = agentById.get(change.suggestion.agentId)
    const appliedAt = change.createdAt
    // "Before" keeps its 7-day baseline; "after" counts only today's
    // conversations (owner policy: old traffic is no longer reviewed).
    const [before, after] = await Promise.all([
      windowMetrics(change.suggestion.agentId, new Date(appliedAt.getTime() - WINDOW_DAYS * DAY_MS), appliedAt),
      windowMetrics(change.suggestion.agentId, new Date(Math.max(appliedAt.getTime(), since.getTime())), new Date()),
    ])
    reviewsByChange.push({
      changeId: change.id,
      suggestionId: change.suggestionId,
      agentId: change.suggestion.agentId,
      workspaceId: change.suggestion.workspaceId,
      agentName: agent?.name,
      kind: change.suggestion.kind,
      topicKey: change.suggestion.topicKey,
      title: change.suggestion.title,
      appliedAt,
      reviewsAfter: [...byReview.values()],
      before,
      after,
    })
  }
  const postChangeResult = detectPostChanges(reviewsByChange)

  // ── Customer Preference Guard
  const preferenceResult = detectPreferenceViolations(contacts)

  const allFindings: FindingDraft[] = [
    ...gapResult.findings,
    ...toolResult.findings,
    ...postChangeResult.findings,
    ...preferenceResult.findings,
  ]
  const persist = await persistFindings(allFindings)
  let resolved = 0
  resolved += await markClean('knowledge-gap', gapResult.clean, gapResult.cleanNote ?? 'خودکار: همه پیام‌های امروز پاسخ گرفته‌اند')
  resolved += await markClean('tool-failure', toolResult.clean, toolResult.cleanNote ?? 'خودکار: خطای سرویس در مکالمات امروز دیده نشد')
  resolved += await markClean('post-change', postChangeResult.clean, postChangeResult.cleanNote ?? 'خودکار: پس از اصلاح، در مکالمات امروز تکرار نشد')
  // Owner policy (2026-09-12): only today's conversations are reviewed, so an
  // OPEN finding that this pass did not re-observe (lastSeenAt still before
  // today's midnight) is finished and is auto-resolved instead of lingering on
  // the board. DISMISSED/ACKNOWLEDGED rows keep their owner-set status; a real
  // recurrence in today's traffic reopens the finding via persistFindings.
  const stale = await prisma.skillFinding.updateMany({
    where: { status: 'OPEN', lastSeenAt: { lt: since } },
    data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedNote: 'خودکار: قدیمی — فقط مکالمات امروز بررسی می‌شود' },
  })
  resolved += stale.count

  const conversationsScanned = new Set([...turns.map((t) => t.conversationId), ...unanswered.map((u) => u.conversationId)])
  return {
    ...persist,
    agentsScanned: agents.length,
    conversationsScanned: conversationsScanned.size,
    llmRequests: 0,
    resolved,
  }
}

// ─── DEEP pass ───────────────────────────────────────────────────────────────

async function runDeep(freeStats: RunStats): Promise<RunStats> {
  const stats: RunStats = { ...freeStats, deepSkipped: null }
  // Owner policy: DEEP tone review samples only TODAY's conversations too.
  const since = startOfToday()
  const agents = await activeAgents(since)
  const deepAgents = agents.slice(0, DEEP_MAX_AGENTS)
  const findings: FindingDraft[] = []
  let llmRequests = 0
  let aiAvailable = true

  // ── Tone & Conversation Flow Coach
  for (const agent of deepAgents) {
    if (llmRequests >= DEEP_MAX_LLM_REQUESTS) break
    const conversations = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT c.id
      FROM "Conversation" c
      WHERE c."agentId" = ${agent.agentId} AND c."lastMessageAt" > (${since} AT TIME ZONE 'UTC') AND c."handedOff" = false
        AND (SELECT COUNT(*) FROM "Message" m WHERE m."conversationId" = c.id AND m.role IN ('USER','ASSISTANT')) >= 6
      ORDER BY c."lastMessageAt" DESC
      LIMIT ${DEEP_TONE_CONVERSATIONS_PER_AGENT}`
    for (const conversation of conversations) {
      if (llmRequests >= DEEP_MAX_LLM_REQUESTS) break
      const messages = await prisma.message.findMany({
        where: { conversationId: conversation.id, role: { in: ['USER', 'ASSISTANT'] } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, role: true, content: true, metadata: true },
        take: 80,
      })
      const transcript = messages
        .filter((m) => asRecord(m.metadata).operator !== true)
        .slice(-DEEP_TONE_TRANSCRIPT_MESSAGES)
        .map((m) => ({ id: m.id, role: m.role, text: m.content.slice(0, DEEP_TONE_TRANSCRIPT_SLICE) }))
      if (transcript.filter((m) => m.role === 'USER').length < 2) continue
      llmRequests++
      const raw = await platformCompletion([
        { role: 'system', content: toneReviewPrompt(agent.language) },
        { role: 'user', content: JSON.stringify({ transcript }) },
      ])
      if (raw === null) { aiAvailable = false; continue }
      findings.push(...normalizeToneReview(parseModelJsonSafe(raw), {
        agentId: agent.agentId,
        workspaceId: agent.workspaceId,
        agentName: agent.name,
        conversationId: conversation.id,
        transcriptMessageIds: new Set(transcript.map((m) => m.id)),
      }))
    }
  }

  // ── Knowledge Conflict Resolver
  const kbs = await prisma.knowledgeBase.findMany({
    where: { status: 'READY', agent: { workspace: { excludeFromAdminReports: false } } },
    select: { id: true, agentId: true, workspaceId: true, name: true, approval: { select: { question: true, answer: true } } },
    take: 400,
  })
  const kbByAgent = new Map<string, typeof kbs>()
  for (const kb of kbs) {
    if (!kb.approval || !kb.approval.question || !kb.approval.answer) continue
    const list = kbByAgent.get(kb.agentId) ?? []
    list.push(kb)
    kbByAgent.set(kb.agentId, list)
  }
  for (const agent of deepAgents) {
    if (llmRequests >= DEEP_MAX_LLM_REQUESTS) break
    const sources = (kbByAgent.get(agent.agentId) ?? []).slice(0, DEEP_CONFLICT_SOURCES_PER_AGENT)
    if (sources.length < 2) continue
    const pairs = candidateConflictPairs(
      sources.map((s) => ({ id: s.id, question: s.approval!.question, answer: s.approval!.answer })),
      DEEP_CONFLICT_PAIRS_PER_AGENT,
    )
    if (!pairs.length) continue
    llmRequests++
    const raw = await platformCompletion([
      { role: 'system', content: conflictPrompt(pairs, agent.language) },
      { role: 'user', content: JSON.stringify({ note: 'Judge these pairs. Return only the JSON.', pairs: pairs.length }) },
    ])
    if (raw === null) { aiAvailable = false; continue }
    findings.push(...normalizeKnowledgeConflicts(parseModelJsonSafe(raw), {
      agentId: agent.agentId,
      workspaceId: agent.workspaceId,
      sources: new Map(sources.map((s) => [s.id, { question: s.approval!.question, answer: s.approval!.answer, name: s.name }])),
    }))
  }

  if (!aiAvailable) stats.deepSkipped = 'AI_UNAVAILABLE'
  stats.llmRequests = llmRequests
  const persist = await persistFindings(findings)
  stats.created += persist.created
  stats.updated += persist.updated
  stats.reopened += persist.reopened
  return stats
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function startSkillsRun(mode: 'FREE' | 'DEEP', source: 'manual' | 'scheduled'): Promise<string> {
  const run = await prisma.skillRun.create({
    data: {
      mode,
      source,
      status: 'RUNNING',
      skills: json(mode === 'DEEP' ? [...FREE_SKILL_KEYS, ...DEEP_SKILL_KEYS] : [...FREE_SKILL_KEYS]),
    },
  })
  return run.id
}

export async function runSkillsRun(runId: string): Promise<void> {
  const run = await prisma.skillRun.findUnique({ where: { id: runId } })
  if (!run || run.status !== 'RUNNING') return
  const startedAt = Date.now()
  try {
    const claimed = await prisma.skillRun.updateMany({ where: { id: runId, status: 'RUNNING' }, data: { status: 'RUNNING' } })
    if (!claimed.count) return
    const freeStats = await runFree()
    const stats = run.mode === 'DEEP' ? await runDeep(freeStats) : freeStats
    await prisma.skillRun.update({
      where: { id: runId },
      data: {
        status: 'DONE',
        error: stats.deepSkipped ?? null,
        agentsScanned: stats.agentsScanned,
        conversationsScanned: stats.conversationsScanned,
        findingsCreated: stats.created,
        findingsUpdated: stats.updated + stats.reopened,
        findingsResolved: stats.resolved,
        llmRequests: stats.llmRequests,
        durationMs: Date.now() - startedAt,
        finishedAt: new Date(),
      },
    })
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 200) : 'FAILED'
    console.error('[skills] run failed', { runId, code })
    await prisma.skillRun.update({
      where: { id: runId },
      data: { status: 'ERROR', error: code, durationMs: Date.now() - startedAt, finishedAt: new Date() },
    }).catch(() => {})
  }
}

export const SKILL_KEYS_BY_MODE: Record<'FREE' | 'DEEP', readonly SkillKey[]> = {
  FREE: FREE_SKILL_KEYS,
  DEEP: [...FREE_SKILL_KEYS, ...DEEP_SKILL_KEYS],
}
