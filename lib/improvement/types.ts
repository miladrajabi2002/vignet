import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { promptConfigSchema } from '@/lib/validations/agent'

export const selectionSchema = z.object({
  mode: z.enum(['latest', 'selected']).default('latest'),
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
  // Baseline is injected by the server, never accepted as model authority.
  baseline: z.unknown().optional(),
})
export type Draft = z.infer<typeof draftSchema>
export const findingSchema = z.object({
  kind: z.enum(['KNOWLEDGE', 'BEHAVIOR', 'TOOL']),
  topicKey: z.string().trim().min(2).max(120),
  title: z.string().trim().min(3).max(200),
  diagnosis: z.string().trim().min(3).max(1600),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  messageIds: z.array(z.string().min(1)).min(1).max(8),
  draft: draftSchema,
})
export const reviewSchema = z.object({
  intent: z.string().max(1200),
  outcome: z.enum(['RESOLVED', 'UNRESOLVED', 'UNKNOWN']),
  summary: z.string().max(2400),
  strengths: z.array(z.string().max(400)).max(5),
  findings: z.array(findingSchema).max(8),
})
export type ReviewResult = z.infer<typeof reviewSchema>
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
  return {
    workspaceId, agentId,
    ...(input.mode === 'selected' ? { id: { in: [...new Set(input.ids)] } } : {}),
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
export function validateFinding(finding: z.infer<typeof findingSchema>, messageIds: Set<string>, knowledgeIds: Set<string>) {
  if (finding.messageIds.some((id) => !messageIds.has(id))) throw new Error('INVALID_EVIDENCE')
  if (finding.draft.targetKnowledgeId && !knowledgeIds.has(finding.draft.targetKnowledgeId)) throw new Error('INVALID_KNOWLEDGE')
  if (finding.kind === 'BEHAVIOR' && (!finding.draft.behaviorPath ||
    (finding.draft.behaviorPath === 'doSay' ? typeof finding.draft.behaviorValue !== 'string' || finding.draft.behaviorValue.trim().length < 3 : !(behaviorValues[finding.draft.behaviorPath] as readonly unknown[]).includes(finding.draft.behaviorValue)))) throw new Error('INVALID_BEHAVIOR')
}

export function restoreBehavior(config: unknown, path: BehaviorPath, value: unknown) {
  if (path === 'doSay') return promptConfigSchema.parse({ ...promptConfigSchema.parse(config), doSay: value })
  return changeBehavior(config, path, value)
}
