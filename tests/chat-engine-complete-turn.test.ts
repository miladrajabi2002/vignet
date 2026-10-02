import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const tx = {
    message: {
      create: vi.fn(async () => ({ id: 'msg-1', createdAt: new Date('2026-10-02T10:00:00Z') })),
    },
    conversation: { update: vi.fn(async () => ({})) },
  }
  return {
    tx,
    shouldHandoff: vi.fn(),
    capture: vi.fn(async () => {}),
    release: vi.fn(async () => {}),
    stream: vi.fn(),
    completion: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: vi.fn(async (operation: (tx: unknown) => unknown) => operation(mocks.tx)) },
}))
vi.mock('@/lib/ai/handoff', () => ({
  shouldHandoff: mocks.shouldHandoff,
  handoffReplyText: () => 'به همکارم وصلتون می‌کنم.',
  notifyHandoff: vi.fn(async () => {}),
  detectUnanswered: () => false,
}))
vi.mock('@/lib/billing/ai-credits', () => ({
  captureChatCredit: mocks.capture,
  releaseChatCredit: mocks.release,
  reserveChatCredit: vi.fn(),
}))
vi.mock('@/lib/ai/openrouter', () => ({
  streamChatWithRetry: mocks.stream,
  chatCompletion: mocks.completion,
  getPlatformOpenRouterKey: () => 'key',
}))
vi.mock('@/lib/ai/conversation-state', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai/conversation-state')>()),
  persistConversationWorkingState: vi.fn(async () => {}),
}))
vi.mock('@/lib/crm/contact-activity', () => ({ bumpContactActivity: vi.fn() }))
vi.mock('@/lib/onboarding', () => ({ syncOnboarding: vi.fn(async () => {}) }))
vi.mock('@/lib/ai/sales-intelligence', () => ({
  refreshConversationSalesInsight: vi.fn(async () => {}),
  salesGuidanceForModel: () => '',
}))
vi.mock('@/lib/billing/trial-quota-alert', () => ({ processTrialQuotaAlert: vi.fn(async () => {}) }))
vi.mock('@/lib/redis', () => ({
  getRedis: () => ({ del: async () => 1, incr: async () => 1, expire: async () => 1 }),
}))
vi.mock('@/lib/notifications/create', () => ({ notifyWorkspace: vi.fn(async () => {}) }))
vi.mock('@/lib/errors/capture', () => ({ captureError: vi.fn() }))

import { completeTurn, TurnPreparationError, type PreparedTurn } from '@/lib/ai/chat-engine'
import { compileAgentSkillPlan } from '@/lib/agent-kernel/registry'
import { buildConversationStateTrace, createEmptyConversationWorkingState } from '@/lib/ai/conversation-state'
import type { StartChatParams } from '@/lib/ai/chat-types'

const agent = {
  id: 'agent-1',
  systemPrompt: '',
  language: 'fa',
  model: null,
  temperature: 0.5,
  maxTokens: 700,
  fallbackMessage: 'الان مشکل فنی داریم.',
  handoffEnabled: false,
  handoffMessage: null,
  handoffKeywords: [],
  promptConfig: null,
  roleTemplate: null,
  requireCustomerInfo: false,
  customerInfoPrompt: null,
  productAccessEnabled: false,
  orderTrackingEnabled: false,
} satisfies StartChatParams['agent']

function turn(message: string): { params: StartChatParams; prep: PreparedTurn } {
  const state = createEmptyConversationWorkingState()
  return {
    params: { workspaceId: 'ws-1', agent, message, channel: 'WEB_WIDGET' },
    prep: {
      model: 'provider/model',
      modelAlias: 'smart',
      reservation: { usageLogId: 'usage-1', chargeIRR: 1000, balanceAfterIRR: 0, modelAlias: 'smart' },
      conversationId: 'conv-1',
      contactId: null,
      contactName: null,
      contactPhone: null,
      messages: [{ role: 'system', content: 'system' }],
      retrievedChunks: [],
      catalogProducts: [],
      productRequest: { isProductTurn: false, explicitShowcase: false, includeProductCards: false, requestNewTopic: false },
      skillPlan: compileAgentSkillPlan({ language: 'fa', userMessage: message, history: [] }),
      canBypassDeterministicReply: false,
      closingReply: null,
      turnLang: 'fa',
      orderContext: '',
      workingState: state,
      stateExpectedRevision: null,
      stateTrace: buildConversationStateTrace({ state, historyLoaded: 0, historySent: 0, resetReason: null, retrievalQuery: '' }),
      analyzerHandoffSignal: false,
      recentCardIds: [],
      commerceTurn: { kind: 'none' },
      catalogToolReason: null,
      restockOffer: null,
      orderCaptureEnabled: false,
    } as unknown as PreparedTurn,
  }
}

function streamOf(deltas: string[], failAfter = false) {
  return async function* () {
    for (const delta of deltas) yield delta
    if (failAfter) throw new Error('OPENROUTER_STREAM_ERROR')
  }
}

describe('completeTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.shouldHandoff.mockResolvedValue({ handoff: false, recommended: false, reasonCodes: [], reason: '', salesInsight: null })
  })

  it('streams guarded text, captures the credit and persists the reply', async () => {
    mocks.stream.mockImplementation(streamOf(['سلام! ', 'جنس میز ', 'چوب گردوئه. ', 'در خدمتم']))
    const { params, prep } = turn('جنسش چیه؟')
    const shown: string[] = []
    const onFinal = vi.fn()

    const result = await completeTurn(params, prep, { stream: true, show: (text) => shown.push(text), onFinal })

    expect(shown.at(-1)).toBe('سلام! جنس میز چوب گردوئه.')
    expect(onFinal).toHaveBeenCalledWith('سلام! جنس میز چوب گردوئه. در خدمتم')
    expect(result).toEqual({ reply: 'سلام! جنس میز چوب گردوئه. در خدمتم', messageId: 'msg-1' })
    expect(mocks.capture).toHaveBeenCalledTimes(1)
    expect(mocks.release).not.toHaveBeenCalled()
  })

  it('never shows a fabricated payment link and strips it from the final reply', async () => {
    mocks.stream.mockImplementation(streamOf(['حتماً. ', 'پرداخت: https://shop.ir/checkout/order-pay/9?pay_for_order=true ', 'ممنون. ']))
    const { params, prep } = turn('لینک پرداخت بده')
    const shown: string[] = []
    let final = ''

    await completeTurn(params, prep, { stream: true, show: (text) => shown.push(text), onFinal: (text) => { final = text } })

    expect(shown.some((text) => text.includes('order-pay'))).toBe(false)
    expect(final).not.toContain('order-pay')
  })

  it('releases the credit and reports the failure after the final text on a broken stream', async () => {
    mocks.stream.mockImplementation(streamOf(['نیمه‌کاره. '], true))
    const { params, prep } = turn('سلام')
    const events: string[] = []

    const result = await completeTurn(params, prep, {
      stream: true,
      onFinal: (text) => events.push(`final:${text}`),
      onProviderStatus: (status) => events.push(`status:${status}`),
    })

    // The Persian polish drops the closing period, as on every reply.
    expect(events).toEqual(['final:نیمه‌کاره', 'status:STREAM_FAILED'])
    expect(result.reply).toBe('نیمه‌کاره')
    expect(mocks.release).toHaveBeenCalledWith(prep.reservation, 'Provider reply failed')
    expect(mocks.capture).not.toHaveBeenCalled()
  })

  it('answers an empty completion with the fallback text and no charge', async () => {
    mocks.completion.mockResolvedValue({ content: '   ', usage: null, toolCalls: [] })
    const { params, prep } = turn('سلام')
    const status = vi.fn()

    const result = await completeTurn(params, prep, { stream: false, onProviderStatus: status })

    expect(result.reply).toBe('الان مشکل فنی داریم')
    expect(status).toHaveBeenCalledWith('EMPTY_RESPONSE')
    expect(mocks.release).toHaveBeenCalledTimes(1)
    expect(mocks.capture).not.toHaveBeenCalled()
  })

  it('releases the credit and signals a preparation failure when the handoff check throws', async () => {
    mocks.shouldHandoff.mockRejectedValue(new Error('db down'))
    const { params, prep } = turn('سلام')

    await expect(completeTurn(params, prep, { stream: true })).rejects.toBeInstanceOf(TurnPreparationError)
    expect(mocks.release).toHaveBeenCalledWith(prep.reservation, 'Handoff policy check failed')
    expect(mocks.stream).not.toHaveBeenCalled()
  })

  it('starts typing only once the model will really answer', async () => {
    mocks.shouldHandoff.mockResolvedValue({ handoff: true, recommended: true, reasonCodes: ['MANUAL'], reason: 'x', salesInsight: null })
    const { params, prep } = turn('اپراتور')
    const onGenerationStart = vi.fn()

    const result = await completeTurn(params, prep, { stream: true, onGenerationStart })

    expect(result.reply).toBe('به همکارم وصلتون می‌کنم.')
    expect(onGenerationStart).not.toHaveBeenCalled()
    expect(mocks.stream).not.toHaveBeenCalled()
  })
})
