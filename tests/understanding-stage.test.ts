import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  understand: vi.fn(),
  cart: vi.fn(async () => null),
  candidates: vi.fn(),
  log: vi.fn(),
}))
vi.mock('@/lib/agent/understand/understand', () => ({ understandTurn: mocks.understand }))
vi.mock('@/lib/commerce/order-service', () => ({ loadCartForUnderstanding: mocks.cart }))
vi.mock('@/lib/agent/understand/candidates', () => ({ buildTurnCandidates: mocks.candidates }))
vi.mock('@/lib/agent/understand/log', () => ({ writeUnderstandingLog: mocks.log }))

import { runUnderstandingStage, agentCapabilities } from '@/lib/agent/turn/understand-stage'
import { createEmptyConversationWorkingState } from '@/lib/ai/conversation-state'
import type { ChatAgent } from '@/lib/ai/chat-types'
import type { TurnCandidates } from '@/lib/agent/understand/types'

const agent: ChatAgent = {
  id: 'a', systemPrompt: '', language: 'fa', model: null, temperature: 0.5, maxTokens: 700, fallbackMessage: null,
  handoffEnabled: true, handoffMessage: null, handoffKeywords: [], promptConfig: null, roleTemplate: null,
  requireCustomerInfo: false, customerInfoPrompt: null, productAccessEnabled: true, orderTrackingEnabled: true,
  orderCaptureEnabled: true, restockAlertsEnabled: true,
}

const candidates: TurnCandidates = {
  capabilities: ['products', 'order_capture'], pending: null, task: null, shownCards: [], cart: [], active: null, seen: [],
  services: [], courses: [], vocabulary: [], categories: [],
}

const reading = (acts: Array<Record<string, unknown>>) => ({
  ok: true,
  raw: {},
  verified: {
    v: 1, language: 'fa', relation: 'new_goal', acts, answersPending: false,
    customer: { mood: 'neu', buy: 1, cues: [] }, confidence: 0.9, refs: {}, notes: [], unavailable: [],
  },
  model: 'm', latencyMs: 420, usage: { promptTokens: 1, completionTokens: 1, reasoningTokens: 0, cachedTokens: 0, costUSD: 0.0002, providerRequestId: null },
})

function input(message: string, extra: Partial<Parameters<typeof runUnderstandingStage>[0]> = {}) {
  return {
    workspaceId: 'w', agent, conversationId: 'c', inboundMessageId: 'm', message,
    history: [], state: createEmptyConversationWorkingState('s'),
    serviceNames: [], turnLang: 'fa' as const,
    ...extra,
  }
}

describe('understanding stage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.candidates.mockResolvedValue(candidates)
  })

  it('turns the verified reading into the route of the turn and logs it once', async () => {
    mocks.understand.mockResolvedValue(reading([{ type: 'policy_question', topic: 'delivery_time' }]))
    const stage = await runUnderstandingStage(input('فردا میرسه دستم؟'))
    expect(stage.route).not.toBeNull()
    expect(stage.route?.booking).toBeNull()
    stage.finalize(['products'])
    stage.finalize(['products'])
    expect(mocks.log).toHaveBeenCalledTimes(1)
    expect(mocks.log.mock.calls[0][0]).toMatchObject({ routedDomains: ['products'], outcome: expect.objectContaining({ ok: true }) })
  })

  it('a reading that could not be obtained routes nothing: the turn has no route at all', async () => {
    mocks.understand.mockResolvedValue({ ok: false, errorCode: 'TIMEOUT', latencyMs: 24000 })
    const stage = await runUnderstandingStage(input('قیمتش؟'))
    expect(stage.outcome).toMatchObject({ ok: false, errorCode: 'TIMEOUT' })
    expect(stage.route).toBeNull()
  })

  it('reads every turn: a bare «ممنون» is read like any other message', async () => {
    mocks.understand.mockResolvedValue(reading([{ type: 'thanks' }]))
    const stage = await runUnderstandingStage(input('ممنون'))
    expect(mocks.understand).toHaveBeenCalledTimes(1)
    expect(stage.route?.closing).toBeTruthy()
  })

  it('reads the turns of an agent that only answers from its knowledge too', async () => {
    mocks.understand.mockResolvedValue(reading([{ type: 'knowledge_question' }]))
    const knowledgeOnly: ChatAgent = { ...agent, productAccessEnabled: false, orderCaptureEnabled: false, orderTrackingEnabled: false, handoffEnabled: false }
    const stage = await runUnderstandingStage(input('کارمزد نقد کردن درآمد چقدره؟', { agent: knowledgeOnly, capabilityGates: { bookings: false, courses: false } }))
    expect(mocks.understand).toHaveBeenCalledTimes(1)
    expect(mocks.candidates.mock.calls[0][0]).toMatchObject({ capabilities: [] })
    expect(mocks.cart).not.toHaveBeenCalled()
    expect(stage.route).not.toBeNull()
  })

  it('a message with no text has nothing to read', async () => {
    const stage = await runUnderstandingStage(input('   '))
    expect(mocks.understand).not.toHaveBeenCalled()
    expect(stage.outcome).toBeNull()
    expect(stage.route).toBeNull()
    stage.finalize([])
    expect(mocks.log.mock.calls[0][0]).toMatchObject({ outcome: null, routedDomains: [] })
  })

  it('capabilities reflect the agent switches exactly', () => {
    expect(agentCapabilities({ agent, serviceNames: ['کوتاهی مو'], capabilityGates: { bookings: true, courses: false } }))
      .toEqual(['products', 'order_capture', 'restock', 'order_tracking', 'bookings', 'handoff'])
    expect(agentCapabilities({ agent: { ...agent, productAccessEnabled: false }, serviceNames: [], capabilityGates: { courses: true } }))
      .toEqual(['order_tracking', 'courses', 'handoff'])
  })
})
