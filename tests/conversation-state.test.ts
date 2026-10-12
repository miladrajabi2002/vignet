import { describe, expect, it } from 'vitest'
import { createEmptyConversationWorkingState, parseConversationWorkingState } from '@/lib/ai/conversation-state'
import { enforceConversationContinuity } from '@/lib/agent-kernel/skills/conversation-state'

describe('generic conversation working state', () => {

  it('fails closed on corrupt persisted JSON and bounds every collection', () => {
    expect(parseConversationWorkingState({ version: 999, activeGoal: { label: 'bad' } }, 's'))
      .toEqual(createEmptyConversationWorkingState('s'))
    const malformed = parseConversationWorkingState({
      version: 1,
      status: 'ACTIVE',
      searchAnchors: Array.from({ length: 100 }, (_, index) => `term-${index}`),
      candidateEntityIds: Array.from({ length: 100 }, (_, index) => `id-${index}`),
      constraints: [{ value: 12 }],
    }, 's')
    expect(malformed.searchAnchors).toHaveLength(10)
    expect(malformed.candidateEntityIds).toHaveLength(10)
    expect(malformed.constraints).toEqual([])
  })
})

describe('conversation continuity response guard', () => {

  it('does not alter a valid first-turn greeting', () => {
    const state = createEmptyConversationWorkingState('s')
    const reply = 'سلام! چطور می‌تونم کمکتون کنم؟'
    expect(enforceConversationContinuity({ reply, state, isFa: true }))
      .toEqual({ reply, codes: [] })
  })
})
