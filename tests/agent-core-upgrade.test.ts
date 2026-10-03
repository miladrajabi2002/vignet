import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  completion: vi.fn(),
  usageCreate: vi.fn(async () => ({})),
}))
vi.mock('@/lib/ai/openrouter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai/openrouter')>()),
  chatCompletion: mocks.completion,
  getPlatformOpenRouterKey: () => 'key',
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    usageLog: { create: mocks.usageCreate },
    platformAiSettings: { findUnique: vi.fn(async () => null) },
  },
}))
vi.mock('@/lib/ai/platform-config', () => ({
  getPlatformAiConfig: async () => ({ providerModels: {}, enabledModels: ['fast', 'smart'], defaultModel: 'fast' }),
  hasPlatformAiBudget: async () => true,
  applyPlatformModelPolicy: () => 'fast',
}))

import { auxCompletion, TurnLedger } from '@/lib/ai/llm/aux'
import {
  advanceConversationWorkingState,
  createEmptyConversationWorkingState,
  parseConversationWorkingState,
  recordShowcase,
  rememberDiscussedEntities,
  setPending,
} from '@/lib/ai/conversation-state'
import { contactBuyerScore, outcomesFromDrafts, recencyFactor } from '@/lib/crm/buyer-score'
import { buildLiveSummary } from '@/lib/conversations/live-summary'
import { analyzeSalesConversation, exchangeSignals, EMPTY_SALES_FACTS } from '@/lib/ai/sales-intelligence'
import { readStoredReading } from '@/lib/agent/turn/customer-reading'
import { extractTurnSignal } from '@/lib/ai/turn-signal'

describe('cost accounting: auxCompletion + per-turn ledger', () => {
  beforeEach(() => vi.clearAllMocks())

  it('records purpose and turnKey on the usage row and sums the turn', async () => {
    mocks.completion.mockResolvedValue({
      content: '',
      toolCalls: [],
      usage: { promptTokens: 1800, completionTokens: 120, reasoningTokens: 0, cachedTokens: 900, costUSD: 0.00019, providerRequestId: 'r1' },
    })
    const ledger = new TurnLedger('evt-1')
    await auxCompletion({ purpose: 'understand', workspaceId: 'w', agentId: 'a', conversationId: 'c', messages: [{ role: 'user', content: 'x' }], ledger })
    expect(mocks.usageCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ purpose: 'understand', turnKey: 'evt-1', type: 'SUMMARY', cost: 0.00019 }) })
    ledger.setReply('provider/reply', { promptTokens: 6000, completionTokens: 300, reasoningTokens: 0, cachedTokens: 4000, costUSD: 0.0008, providerRequestId: null })
    const summary = ledger.summary()
    expect(summary.auxUSD).toBe(0.00019)
    expect(summary.replyUSD).toBe(0.0008)
    expect(summary.totalUSD).toBe(0.00099)
    expect(summary.calls).toEqual([expect.objectContaining({ purpose: 'understand', in: 1800, out: 120, ok: true })])
  })

  it('a failed call is in the ledger with its error and is not written as usage', async () => {
    mocks.completion.mockRejectedValue(Object.assign(new Error('timeout'), { name: 'TimeoutError' }))
    const ledger = new TurnLedger('evt-2')
    await expect(auxCompletion({ purpose: 'understand', workspaceId: 'w', messages: [], ledger })).rejects.toThrow()
    expect(ledger.summary().calls[0]).toMatchObject({ ok: false, error: 'TIMEOUT' })
    expect(mocks.usageCreate).not.toHaveBeenCalled()
  })
})

describe('product memory in the conversation state', () => {
  it('remembers discussed products newest-first, one entry per parent product', () => {
    let state = createEmptyConversationWorkingState('s')
    state = rememberDiscussedEntities(state, [{ id: 'apadana', name: 'میز تلویزیون آپادانا' }], 'named', 'm1')
    state = rememberDiscussedEntities(state, [{ id: 'puff#v20', name: 'پاف مراکشی — کرم' }], 'card', 'm2')
    state = rememberDiscussedEntities(state, [{ id: 'apadana#v14', name: 'میز تلویزیون آپادانا — آبی' }], 'card', 'm3')
    expect(state.discussedEntities?.map((entity) => entity.id)).toEqual(['apadana#v14', 'puff#v20'])
    const restored = parseConversationWorkingState(JSON.parse(JSON.stringify(recordShowcase(state, [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]))), 's')
    expect(restored.lastShowcase).toEqual([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }])
    expect(restored.discussedEntities?.length).toBe(2)
  })

  it('the agent\'s pending offer is consumed by the next customer turn', () => {
    const offered = setPending(createEmptyConversationWorkingState('s'), { kind: 'restock_offer', sourceMessageId: 'a1' })
    const next = advanceConversationWorkingState({ state: offered, sessionStartId: 's', message: 'آره', messageId: 'u2', createdAt: new Date() })
    expect(next.pending).toBeNull()
  })

  it('understanding-driven transitions: new goal, side question keeps the goal, reset keeps product memory', () => {
    let state = advanceConversationWorkingState({
      state: createEmptyConversationWorkingState('s'), sessionStartId: 's', message: 'میز تلویزیون ۱۶۰ میخوام', messageId: 'u1', createdAt: new Date(),
      understood: { relation: 'NEW_GOAL', intent: 'PRODUCT', searchTerms: ['میز', 'تلویزیون', '160'], slots: { size: '160' } },
    })
    expect(state.activeGoal?.intent).toBe('PRODUCT')
    expect(state.searchAnchors).toEqual(['میز', 'تلویزیون', '160'])
    expect(state.slots.size.value).toBe('160')
    state = rememberDiscussedEntities(state, [{ id: 'apadana', name: 'آپادانا' }], 'card', 'a1')
    state = advanceConversationWorkingState({
      state, sessionStartId: 's', message: 'ارسال به شیراز چند روزه؟', messageId: 'u2', createdAt: new Date(),
      understood: { relation: 'SIDE_QUESTION', intent: 'BUSINESS_INFO', searchTerms: [], slots: { location: 'شیراز' } },
    })
    expect(state.activeGoal?.label).toBe('میز تلویزیون ۱۶۰ میخوام')
    expect(state.slots.location.value).toBe('شیراز')
    state = advanceConversationWorkingState({
      state, sessionStartId: 's', message: 'بی‌خیال', messageId: 'u3', createdAt: new Date(),
      understood: { relation: 'RESET', intent: 'GENERAL', searchTerms: [], slots: {} },
    })
    expect(state.activeGoal).toBeNull()
    expect(state.discussedEntities?.[0].id).toBe('apadana')
  })
})

describe('buyer score across conversations and real outcomes', () => {
  const now = new Date('2026-10-03T00:00:00Z')
  it('a paid order, a booking or an enrollment is a customer', () => {
    expect(contactBuyerScore([], { paidOrders: 1, filedOrders: 0, openCheckouts: 0, activeCarts: 0, bookings: 0, enrollments: 0 }, now)).toEqual({ score: 100, level: 'customer', reason: 'paid_order' })
    expect(contactBuyerScore([], { paidOrders: 0, filedOrders: 0, openCheckouts: 0, activeCarts: 0, bookings: 2, enrollments: 0 }, now).reason).toBe('booking')
  })

  it('reads the strongest recent conversation, fades old ones, ignores UNCLEAR', () => {
    const insights = [
      { buyerProbability: 90, leadType: 'BUYER' as const, stage: 'PURCHASE_INTENT' as const, analyzedAt: new Date('2026-06-01T00:00:00Z') },
      { buyerProbability: 64, leadType: 'BUYER' as const, stage: 'CONSIDERATION' as const, analyzedAt: new Date('2026-09-30T00:00:00Z') },
      { buyerProbability: 99, leadType: 'UNCLEAR' as const, stage: 'UNKNOWN' as const, analyzedAt: now },
    ]
    const score = contactBuyerScore(insights, undefined, now)
    expect(score.score).toBe(64)
    expect(score.level).toBe('warm')
    expect(recencyFactor(new Date('2026-06-01T00:00:00Z'), now)).toBeLessThan(0.6)
    expect(contactBuyerScore([{ ...insights[2] }], undefined, now)).toEqual({ score: null, level: null, reason: null })
  })

  it('an unpaid payment link or a cart in progress lifts the score', () => {
    const outcomes = outcomesFromDrafts([{ contactId: 'c1', status: 'LINK_SENT' }, { contactId: 'c2', status: 'COLLECTING' }, { contactId: null, status: 'PAID' }])
    expect(contactBuyerScore([], outcomes.get('c1'), now)).toMatchObject({ score: 92, reason: 'checkout' })
    expect(contactBuyerScore([], outcomes.get('c2'), now)).toMatchObject({ score: 85, reason: 'cart' })
  })
})

describe('live conversation summary', () => {
  it('states goal, product, cart, stated details and the open question', () => {
    let state = advanceConversationWorkingState({
      state: createEmptyConversationWorkingState('s'), sessionStartId: 's', message: 'میز تلویزیون ۱۶۰ آبی میخوام', messageId: 'u1', createdAt: new Date(),
      understood: { relation: 'NEW_GOAL', intent: 'PRODUCT', searchTerms: ['میز', 'تلویزیون'], slots: { color: 'آبی', budget: '20000000' } },
    })
    state = { ...state, activeEntity: { type: 'PRODUCT', id: 'apadana', label: 'میز تلویزیون آپادانا ۱۶۰', sourceMessageId: 'u1', source: 'CATALOG' } }
    state = rememberDiscussedEntities(state, [{ id: 'arta', name: 'میز تلویزیون آرتا ۱۹۰' }], 'card', 'a1')
    const summary = buildLiveSummary({
      state,
      draft: { code: 'A7K2Q9', status: 'COLLECTING', expecting: 'address', items: [{ name: 'میز تلویزیون آپادانا ۱۶۰', variant: 'آبی', quantity: 1 }], customerName: 'رضا', city: null },
      language: 'fa',
    })
    expect(summary).toContain('هدف: میز تلویزیون ۱۶۰ آبی میخوام')
    expect(summary).toContain('محصول مورد بحث: میز تلویزیون آپادانا ۱۶۰')
    expect(summary).toContain('محصولات دیگری که دیده: میز تلویزیون آرتا ۱۹۰')
    expect(summary).toContain('سفارش A7K2Q9')
    expect(summary).toContain('منتظر آدرس')
    expect(summary).toContain('رنگ: آبی')
    expect(buildLiveSummary({ state: null, draft: null, language: 'fa' })).toBeNull()
  })
})

describe('sales reading: customer-side signals and conversation facts', () => {
  it('uses the understanding reading of the customer message, aligned to its own exchange', () => {
    const signals = exchangeSignals([
      { role: 'USER', content: 'گرونه، تخفیف ندارین؟', metadata: { understanding: { v: 1, mood: 'neg', buy: 2, cues: ['pricey'], acts: ['product_question'], confidence: 0.8 } } },
      { role: 'ASSISTANT', content: 'ببخشید', metadata: { turnSignal: { v: 1, mood: 'pos', buy: 0, answered: 'p', topic: 'price', cues: [] } } },
    ])
    expect(signals).toEqual([expect.objectContaining({ mood: 'neg', buy: 2, answered: 'p', topic: 'price', cues: ['pricey'] })])
    // A positive mood without the customer's own thanks/praise is not trusted.
    expect(exchangeSignals([{ role: 'USER', content: 'قیمتش؟', metadata: { understanding: { v: 1, mood: 'pos', buy: 2, cues: [], acts: [], confidence: 0.8 } } }])[0].mood).toBe('neu')
    expect(readStoredReading({ understanding: { mood: 'x', buy: 9 } })).toBeNull()
  })

  it('facts outrank wording: a paid cart is a customer, an open link is purchase intent', () => {
    const messages = [{ role: 'USER' as const, content: 'سلام' }]
    const paid = analyzeSalesConversation({ messages, facts: { ...EMPTY_SALES_FACTS, paidOrder: true } })
    expect(paid.stage).toBe('POST_PURCHASE')
    expect(paid.buyerProbability).toBe(100)
    expect(paid.leadType).toBe('EXISTING_CUSTOMER')
    const link = analyzeSalesConversation({ messages: [{ role: 'USER', content: 'باشه' }], facts: { ...EMPTY_SALES_FACTS, openCheckout: true } })
    expect(link.stage).toBe('PURCHASE_INTENT')
    expect(link.buyerProbability).toBeGreaterThanOrEqual(85)
    expect(link.evidence.map((item) => item.code)).toContain('FACT_CHECKOUT_OPEN')
  })
})

describe('reply status line: structured offer', () => {
  it('parses the offer field and keeps old lines unchanged', () => {
    expect(extractTurnSignal('جواب\n[[st:m=neu;b=1;a=y;t=stock;c=-;o=restock]]').signal).toMatchObject({ offer: 'restock' })
    expect(extractTurnSignal('جواب\n[[st:m=neu;b=1;a=y;t=stock;c=-;o=-]]').signal).not.toHaveProperty('offer')
  })
})
