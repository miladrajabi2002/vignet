import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  mode: vi.fn(),
  understand: vi.fn(),
  cart: vi.fn(async () => null),
  candidates: vi.fn(),
  log: vi.fn(),
}))
vi.mock('@/lib/agent/understand/mode', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/agent/understand/mode')>()),
  resolveUnderstandingMode: mocks.mode,
}))
vi.mock('@/lib/agent/understand/understand', () => ({ understandTurn: mocks.understand }))
vi.mock('@/lib/commerce/order-service', () => ({ loadCartForUnderstanding: mocks.cart }))
vi.mock('@/lib/agent/understand/candidates', () => ({ buildTurnCandidates: mocks.candidates }))
vi.mock('@/lib/agent/understand/log', () => ({ writeUnderstandingLog: mocks.log }))

import { runUnderstandingStage, agentCapabilities, needsUnderstanding } from '@/lib/agent/turn/understand-stage'
import { planProductRequest } from '@/lib/ai/conversation'
import { createEmptyConversationWorkingState } from '@/lib/ai/conversation-state'
import { DEFAULT_UNDERSTANDING_CONFIG } from '@/lib/agent/understand/mode'
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

function input(message: string, extra: Partial<Parameters<typeof runUnderstandingStage>[0]> = {}) {
  return {
    workspaceId: 'w', agent, conversationId: 'c', inboundMessageId: 'm', message,
    history: [], planningHistory: [], state: createEmptyConversationWorkingState('s'),
    serviceNames: [], legacyPlan: planProductRequest(message, []), turnLang: 'fa' as const,
    ...extra,
  }
}

describe('understanding stage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.candidates.mockResolvedValue(candidates)
  })

  it('mode on: routes each enabled domain from the verified reading and logs both readings', async () => {
    mocks.mode.mockResolvedValue({ mode: 'on', domains: { ...DEFAULT_UNDERSTANDING_CONFIG.domains, orders: false }, timeoutMs: 6000 })
    mocks.understand.mockResolvedValue({
      ok: true,
      raw: {},
      verified: {
        v: 1, language: 'fa', relation: 'new_goal', acts: [{ type: 'policy_question', topic: 'delivery_time' }], answersPending: false,
        customer: { mood: 'neu', buy: 1, cues: [] }, confidence: 0.9, refs: {}, notes: [], unavailable: [],
      },
      model: 'm', latencyMs: 420, usage: { promptTokens: 1, completionTokens: 1, reasoningTokens: 0, cachedTokens: 0, costUSD: 0.0002, providerRequestId: null },
    })
    const stage = await runUnderstandingStage(input('فردا میرسه دستم؟'))
    expect(stage.route?.booking).toBeNull()
    expect(stage.routes('products')).toBe(true)
    expect(stage.routes('orders')).toBe(false)
    stage.finalize(['products'])
    stage.finalize(['products'])
    expect(mocks.log).toHaveBeenCalledTimes(1)
    expect(mocks.log.mock.calls[0][0]).toMatchObject({ mode: 'on', routedDomains: ['products'], legacy: expect.objectContaining({ acts: expect.any(Array) }) })
  })

  it('a failed reading routes nothing (the engine keeps the legacy decision)', async () => {
    mocks.mode.mockResolvedValue({ mode: 'on', domains: DEFAULT_UNDERSTANDING_CONFIG.domains, timeoutMs: 6000 })
    mocks.understand.mockResolvedValue({ ok: false, errorCode: 'TIMEOUT', latencyMs: 6000 })
    const stage = await runUnderstandingStage(input('قیمتش؟'))
    expect(stage.route).toBeNull()
    expect(stage.routes('products')).toBe(false)
  })

  it('shadow mode reads and logs but never routes; off mode makes no call', async () => {
    mocks.mode.mockResolvedValue({ mode: 'shadow', domains: DEFAULT_UNDERSTANDING_CONFIG.domains, timeoutMs: 6000 })
    mocks.understand.mockResolvedValue({ ok: false, errorCode: 'MALFORMED', latencyMs: 10 })
    const shadow = await runUnderstandingStage(input('سلام قیمت مبل'))
    expect(shadow.routes('products')).toBe(false)
    expect(mocks.understand).toHaveBeenCalledTimes(1)
    mocks.mode.mockResolvedValue({ mode: 'off', domains: DEFAULT_UNDERSTANDING_CONFIG.domains, timeoutMs: 6000 })
    const off = await runUnderstandingStage(input('سلام قیمت مبل'))
    expect(off.outcome).toBeNull()
    expect(mocks.understand).toHaveBeenCalledTimes(1)
    off.finalize([])
    expect(mocks.log).not.toHaveBeenCalled()
  })

  it('a deterministic fast path (pure closing) skips the model call', async () => {
    mocks.mode.mockResolvedValue({ mode: 'on', domains: DEFAULT_UNDERSTANDING_CONFIG.domains, timeoutMs: 6000 })
    const stage = await runUnderstandingStage(input('ممنون', { skip: true }))
    expect(mocks.understand).not.toHaveBeenCalled()
    stage.finalize([])
    expect(mocks.log.mock.calls[0][0]).toMatchObject({ status: 'skipped' })
  })

  it('an agent with nothing to route (knowledge only) never calls the model', async () => {
    mocks.mode.mockResolvedValue({ mode: 'on', domains: DEFAULT_UNDERSTANDING_CONFIG.domains, timeoutMs: 6000 })
    const knowledgeOnly: ChatAgent = { ...agent, productAccessEnabled: false, orderCaptureEnabled: false, orderTrackingEnabled: false }
    const stage = await runUnderstandingStage(input('کارمزد نقد کردن درآمد چقدره؟', { agent: knowledgeOnly, capabilityGates: { bookings: false, courses: false } }))
    expect(mocks.understand).not.toHaveBeenCalled()
    expect(mocks.candidates).not.toHaveBeenCalled()
    expect(stage.route).toBeNull()
    expect(stage.routes('handoff')).toBe(false)
    stage.finalize([])
    expect(mocks.log.mock.calls[0][0]).toMatchObject({ status: 'skipped' })

    expect(needsUnderstanding(['handoff'])).toBe(false)
    expect(needsUnderstanding([])).toBe(false)
    expect(needsUnderstanding(['order_tracking', 'handoff'])).toBe(true)
    expect(needsUnderstanding(['bookings'])).toBe(true)
  })

  it('capabilities reflect the agent switches exactly', () => {
    expect(agentCapabilities({ agent, serviceNames: ['کوتاهی مو'], capabilityGates: { bookings: true, courses: false } }))
      .toEqual(['products', 'order_capture', 'restock', 'order_tracking', 'bookings', 'handoff'])
    expect(agentCapabilities({ agent: { ...agent, productAccessEnabled: false }, serviceNames: [], capabilityGates: { courses: true } }))
      .toEqual(['order_tracking', 'courses', 'handoff'])
  })
})
