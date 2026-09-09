import { describe, expect, it } from 'vitest'
import { behaviorValue, changeBehavior, conversationWhere, draftSchema, normalizedTopic, selectionSchema, restoreBehavior, transcriptSegments, validateFinding } from '@/lib/improvement/types'

describe('conversation improvement boundaries', () => {
  it('keeps workspace and agent scope with search, selection and handoff filters', () => {
    const input = selectionSchema.parse({ mode: 'selected', ids: ['own', 'own'], search: 'ارسال', attention: 'handoff' })
    const where = conversationWhere('workspace', 'agent', input)
    expect(where).toMatchObject({ workspaceId: 'workspace', agentId: 'agent', id: { in: ['own'] }, handedOff: true })
    expect(where.OR).toHaveLength(3)
    expect(input.includeReviewed).toBe(false)
  })
  it('rejects empty selections, excessive batches and inverted dates', () => {
    expect(selectionSchema.safeParse({ mode: 'selected', ids: [] }).success).toBe(false)
    expect(selectionSchema.safeParse({ count: 501 }).success).toBe(false)
    expect(selectionSchema.safeParse({ from: '2026-09-09T00:00:00Z', to: '2026-09-08T00:00:00Z' }).success).toBe(false)
  })
  it('reviews every character of long messages, including the last segment', () => {
    const messages = [{ id: 'a', role: 'USER', content: 'x'.repeat(33000) }, { id: 'b', role: 'ASSISTANT', content: 'the final answer' }]
    const segments = transcriptSegments(messages)
    expect(segments).toHaveLength(3)
    expect(segments.flat().filter((m) => m.id === 'a').map((m) => m.content).join('')).toBe(messages[0].content)
    expect(segments.at(-1)?.at(-1)?.content).toBe('the final answer')
    expect(segments.every((s) => s.reduce((n, m) => n + m.content.length, 0) <= 16000)).toBe(true)
  })
  it('changes only the selected setting and rejects unsupported values', () => {
    const config = { personality: 'Keep this role', tone: 'Keep this tone', format: { length: 'long' }, conversation: { empathy: 'warm' } }
    const changed = changeBehavior(config, 'format.length', 'short')
    expect(changed.personality).toBe(config.personality)
    expect(changed.conversation.empathy).toBe('warm')
    expect(behaviorValue(changed, 'format.length')).toBe('short')
    expect(config.format.length).toBe('long')
    expect(() => changeBehavior(config, 'format.length', 'ignore safety')).toThrow('INVALID_BEHAVIOR')
  })
  it('rejects invented message/source references from the model', () => {
    const finding = { kind: 'KNOWLEDGE' as const, scope: 'AGENT' as const, topicKey: 'returns', title: 'Returns', diagnosis: 'Missing policy', priority: 'HIGH' as const,
      messageIds: ['invented'], draft: draftSchema.parse({}) }
    expect(() => validateFinding(finding, new Set(['real']), new Set())).toThrow('INVALID_EVIDENCE')
    finding.messageIds = ['real']; finding.draft.targetKnowledgeId = 'foreign'
    expect(() => validateFinding(finding, new Set(['real']), new Set(['own']))).toThrow('INVALID_KNOWLEDGE')
  })
  it('appends and reverts a flow instruction without replacing existing rules', () => {
    const config = { personality: 'Support', doSay: ['Keep the existing rule'], tone: 'Warm' }
    const changed = changeBehavior(config, 'doSay', 'Do not ask for information the customer already provided')
    expect(changed.doSay).toEqual(['Keep the existing rule', 'Do not ask for information the customer already provided'])
    expect(restoreBehavior(changed, 'doSay', config.doSay).doSay).toEqual(config.doSay)
    expect(changed.tone).toBe('Warm')
  })
  it('normalizes Persian topic variants for deduplication', () => {
    expect(normalizedTopic('پيگيري_كالا')).toBe(normalizedTopic('پیگیری کالا'))
  })
})
