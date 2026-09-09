import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { promptConfigSchema } from '@/lib/validations/agent'

export const selectionSchema = z.object({
  mode: z.enum(['latest', 'selected']).default('latest'),
  // Re-reviewing an unchanged conversation is an explicit opt-in because every
  // model request is billable. Updated conversations remain eligible by default.
  includeReviewed: z.boolean().default(false),
  count: z.number().int().min(1).max(500).default(100),
  ids: z.array(z.string().min(1).max(100)).max(500).default([]),
  search: z.string().trim().max(200).default(''),
  channel: z.enum(['TELEGRAM', 'WHATSAPP', 'INSTAGRAM', 'RUBIKA', 'BALE', 'WEB_WIDGET', 'CHAT_LINK', 'API']).optional(),
  attention: z.enum(['all', 'unanswered', 'handoff', 'low_rating']).default('all'),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  contactId: z.string().max(100).optional(),
}).refine((v) => v.mode !== 'selected' || v.ids.length > 0)
  .refine((v) => !v.from || !v.to || v.from <= v.to)
export type Selection = z.infer<typeof selectionSchema>

export const behaviorValues = {
  doSay: [] as string[],
  'format.length': ['short', 'medium', 'long'],
  'conversation.formality': ['formal', 'balanced', 'casual'],
  'conversation.followUp': ['rare', 'when_needed', 'often'],
  'conversation.empathy': ['neutral', 'balanced', 'warm'],
  'conversation.initiative': ['answer_only', 'guided', 'proactive'],
  'conversation.avoidRepeatedGreetings': [true, false],
  'conversation.mirrorCustomerTone': [true, false],
} as const
export type BehaviorPath = keyof typeof behaviorValues
export const draftSchema = z.object({
  question: z.string().trim().max(2000).default(''),
  answer: z.string().trim().max(8000).default(''),
  missing: z.string().trim().max(1500).default(''),
  targetKnowledgeId: z.string().max(100).nullable().default(null),
  behaviorPath: z.enum(Object.keys(behaviorValues) as [BehaviorPath, ...BehaviorPath[]]).nullable().default(null),
  behaviorValue: z.union([z.string().max(500), z.boolean()]).nullable().default(null),
  // Scope and customer identity are server-owned. The model chooses only the
  // finding scope; processImprovement binds CUSTOMER findings to the reviewed
  // conversation's real contact before anything can be previewed or applied.
  scope: z.enum(['AGENT', 'CUSTOMER']).default('AGENT'),
  contactId: z.string().max(100).nullable().default(null),
  // Baseline is injected by the server, never accepted as model authority.
  baseline: z.unknown().optional(),
})
export type Draft = z.infer<typeof draftSchema>
export const findingSchema = z.object({
  kind: z.enum(['KNOWLEDGE', 'BEHAVIOR', 'TOOL']),
  scope: z.enum(['AGENT', 'CUSTOMER']).default('AGENT'),
  topicKey: z.string().trim().min(2).max(120),
  title: z.string().trim().min(3).max(200),
  diagnosis: z.string().trim().min(3).max(1600),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  messageIds: z.array(z.string().min(1)).min(1).max(8),
  draft: draftSchema,
})
const strengthSchema = z.union([
  // Read old checkpoints defensively. New model output always uses the
  // evidence-bearing object form below.
  z.string().trim().min(1).max(400).transform((title) => ({ title, messageIds: [] as string[] })),
  z.object({
    title: z.string().trim().min(1).max(400),
    messageIds: z.array(z.string().min(1)).min(1).max(8),
  }),
])
export const reviewSchema = z.object({
  intent: z.string().max(1200),
  intentMessageIds: z.array(z.string().min(1)).max(8).default([]),
  outcome: z.enum(['RESOLVED', 'UNRESOLVED', 'UNKNOWN']),
  outcomeMessageIds: z.array(z.string().min(1)).max(8).default([]),
  summary: z.string().max(2400),
  strengths: z.array(strengthSchema).max(5),
  findings: z.array(findingSchema).max(8),
}).superRefine((value, ctx) => {
  if (value.outcome !== 'UNKNOWN' && value.outcomeMessageIds.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['outcomeMessageIds'], message: 'OUTCOME_EVIDENCE_REQUIRED' })
  }
})
export type ReviewResult = z.infer<typeof reviewSchema>

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function boundedString(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function evidenceIds(value: unknown, knownMessageIds: Set<string>, max = 8) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && knownMessageIds.has(id)))].slice(0, max)
}

/**
 * Models occasionally return one malformed or unsupported finding while the
 * rest of the review is valid. Treat model output as untrusted data and keep
 * only contract-valid, evidence-backed items instead of failing (and charging)
 * the entire conversation because of one bad array member.
 */
export function normalizeReviewResult(
  value: unknown,
  context: { messageIds: Set<string>; knowledgeIds: Set<string>; contactId?: string | null; hasCustomerMessages: boolean },
): ReviewResult {
  const input = record(value)
  const intentMessageIds = evidenceIds(input.intentMessageIds, context.messageIds)
  const requestedOutcome = input.outcome === 'RESOLVED' || input.outcome === 'UNRESOLVED' || input.outcome === 'UNKNOWN'
    ? input.outcome
    : 'UNKNOWN'
  const outcomeMessageIds = evidenceIds(input.outcomeMessageIds, context.messageIds)

  const strengths = (Array.isArray(input.strengths) ? input.strengths : []).flatMap((raw) => {
    const item = record(raw)
    const title = boundedString(item.title, 400)
    const messageIds = evidenceIds(item.messageIds, context.messageIds)
    return title && messageIds.length ? [{ title, messageIds }] : []
  }).slice(0, 5)

  const findings = (Array.isArray(input.findings) ? input.findings : []).flatMap((raw) => {
    const parsed = findingSchema.safeParse(raw)
    if (!parsed.success) return []
    try {
      validateFinding(parsed.data, context.messageIds, context.knowledgeIds, context.contactId)
      return [parsed.data]
    } catch {
      return []
    }
  }).slice(0, 8)

  const intent = boundedString(input.intent, 1200)
  return reviewSchema.parse({
    intent: context.hasCustomerMessages && intent && !intentMessageIds.length ? '' : intent,
    intentMessageIds,
    outcome: requestedOutcome !== 'UNKNOWN' && !outcomeMessageIds.length ? 'UNKNOWN' : requestedOutcome,
    outcomeMessageIds: requestedOutcome !== 'UNKNOWN' && outcomeMessageIds.length ? outcomeMessageIds : [],
    summary: boundedString(input.summary, 2400),
    strengths,
    findings,
  })
}
export const settingsSchema = z.object({
  daily: z.boolean().default(false),
  count: z.number().int().min(1).max(100).default(50),
  autoBehavior: z.boolean().default(false),
  // Automatic scope is deliberately exact and visible in the UI.
  allowedPaths: z.array(z.enum(['format.length', 'conversation.avoidRepeatedGreetings'])).max(2).default([]),
})
export function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}
export function normalizedTopic(value: string) {
  return value.normalize('NFKC').replace(/ي/g, 'ی').replace(/ك/g, 'ک').toLowerCase().replace(/[\s‌_-]+/g, ' ').trim()
}
export function conversationWhere(workspaceId: string, agentId: string, input: Selection): Prisma.ConversationWhereInput {
  // Search and filters help discover conversations. Once the owner explicitly
  // selects rows, those ids are the source of truth and must not disappear just
  // because the search term changes while they pick another page of results.
  if (input.mode === 'selected') {
    return { workspaceId, agentId, id: { in: [...new Set(input.ids)] } }
  }
  return {
    workspaceId, agentId,
    ...(input.contactId ? { contactId: input.contactId } : {}),
    ...(input.channel ? { channel: input.channel } : {}),
    ...(input.from || input.to ? { lastMessageAt: { ...(input.from ? { gte: new Date(input.from) } : {}), ...(input.to ? { lte: new Date(input.to) } : {}) } } : {}),
    ...(input.attention === 'unanswered' ? { messages: { some: { unanswered: true } } } : {}),
    ...(input.attention === 'handoff' ? { handedOff: true } : {}),
    ...(input.attention === 'low_rating' ? { rating: { lte: 2 } } : {}),
    ...(input.search ? { OR: [
      { contact: { name: { contains: input.search, mode: 'insensitive' } } },
      { contact: { phone: { contains: input.search } } },
      { messages: { some: { content: { contains: input.search, mode: 'insensitive' } } } },
    ] } : {}),
  }
}

/** Server-side eligibility layer. Kept separate from conversationWhere because
 * Prisma field references are provided by the generated client instance and the
 * shared schemas in this module are also imported by client components. */
export function withImprovementFreshness(
  where: Prisma.ConversationWhereInput,
  includeReviewed: boolean,
  lastReviewField: Prisma.FieldRef<'Conversation', 'DateTime'>,
): Prisma.ConversationWhereInput {
  if (includeReviewed) return where
  return {
    AND: [
      where,
      {
        OR: [
          { lastImprovementReviewAt: null },
          { lastMessageAt: { gt: lastReviewField } },
        ],
      },
    ],
  }
}
export function behaviorValue(config: unknown, path: BehaviorPath) {
  const parsed = promptConfigSchema.parse(config ?? {})
  if (path === 'doSay') return parsed.doSay
  const [section, field] = path.split('.')
  return (parsed[section as 'format' | 'conversation'] as unknown as Record<string, unknown>)[field]
}
export function changeBehavior(config: unknown, path: BehaviorPath, value: unknown) {
  if (path === 'doSay') {
    if (typeof value !== 'string' || value.trim().length < 3 || value.length > 500) throw new Error('INVALID_BEHAVIOR')
    const parsed = promptConfigSchema.parse(config ?? {})
    return promptConfigSchema.parse({ ...parsed, doSay: [...new Set([...parsed.doSay, value.trim()])] })
  }
  if (!(behaviorValues[path] as readonly unknown[]).includes(value)) throw new Error('INVALID_BEHAVIOR')
  const parsed = promptConfigSchema.parse(config ?? {})
  const [section, field] = path.split('.')
  return promptConfigSchema.parse({ ...parsed, [section]: { ...parsed[section as 'format' | 'conversation'], [field]: value } })
}

export type TranscriptMessage = { id: string; role: string; content: string; operator?: boolean }
/** Split without dropping messages or the tail of an oversized message. */
export function transcriptSegments(messages: TranscriptMessage[], limit = 16000) {
  const segments: TranscriptMessage[][] = []
  let current: TranscriptMessage[] = [], size = 0
  for (const message of messages) {
    for (let offset = 0; offset < Math.max(1, message.content.length); offset += limit) {
      const part = { ...message, content: message.content.slice(offset, offset + limit) }
      if (size + part.content.length > limit && current.length) { segments.push(current); current = []; size = 0 }
      current.push(part); size += part.content.length
    }
  }
  if (current.length) segments.push(current)
  return segments
}
export function validateFinding(
  finding: Omit<z.infer<typeof findingSchema>, 'scope'> & { scope?: 'AGENT' | 'CUSTOMER' },
  messageIds: Set<string>,
  knowledgeIds: Set<string>,
  contactId?: string | null,
) {
  if (finding.messageIds.some((id) => !messageIds.has(id))) throw new Error('INVALID_EVIDENCE')
  if (finding.draft.targetKnowledgeId && !knowledgeIds.has(finding.draft.targetKnowledgeId)) throw new Error('INVALID_KNOWLEDGE')
  if ((finding.scope ?? 'AGENT') === 'CUSTOMER') {
    if (!contactId || finding.kind !== 'BEHAVIOR' || finding.draft.answer.trim().length < 3 ||
      finding.draft.targetKnowledgeId || finding.draft.behaviorPath || finding.draft.behaviorValue !== null) {
      throw new Error('INVALID_CUSTOMER_SCOPE')
    }
    return
  }
  if (finding.kind === 'BEHAVIOR' && (!finding.draft.behaviorPath ||
    (finding.draft.behaviorPath === 'doSay' ? typeof finding.draft.behaviorValue !== 'string' || finding.draft.behaviorValue.trim().length < 3 : !(behaviorValues[finding.draft.behaviorPath] as readonly unknown[]).includes(finding.draft.behaviorValue)))) throw new Error('INVALID_BEHAVIOR')
}

export function validateReviewEvidence(result: ReviewResult, messageIds: Set<string>, hasCustomerMessages: boolean) {
  const ids = [
    ...result.intentMessageIds,
    ...result.outcomeMessageIds,
    ...result.strengths.flatMap((strength) => strength.messageIds),
  ]
  if (ids.some((id) => !messageIds.has(id))) throw new Error('INVALID_EVIDENCE')
  if (hasCustomerMessages && result.intent.trim() && result.intentMessageIds.length === 0) throw new Error('INVALID_EVIDENCE')
}

export function restoreBehavior(config: unknown, path: BehaviorPath, value: unknown) {
  if (path === 'doSay') return promptConfigSchema.parse({ ...promptConfigSchema.parse(config), doSay: value })
  return changeBehavior(config, path, value)
}
