/**
 * Product memory across topic drift, end to end through the real state,
 * candidate, verify and route code (only the catalog query is mocked):
 *
 *   agent shows 3 cards → customer asks about shipping → starts a new topic
 *   → «همون پاف کرم که اول نشون دادی قیمتش چند بود؟»
 *
 * must land on the exact puff row, on the understanding path and on the
 * legacy fallback path alike.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ products: vi.fn(), courses: vi.fn(async () => []) }))
vi.mock('@/lib/prisma', () => ({ prisma: { product: { findMany: mocks.products }, course: { findMany: mocks.courses } } }))

import {
  advanceConversationWorkingState,
  createEmptyConversationWorkingState,
  recordShowcase,
  rememberDiscussedEntities,
  type ConversationWorkingState,
} from '@/lib/ai/conversation-state'
import { buildTurnCandidates } from '@/lib/agent/understand/candidates'
import { verifyUnderstanding } from '@/lib/agent/understand/verify'
import { routeFromUnderstanding } from '@/lib/agent/turn/route'
import type { TurnUnderstanding } from '@/lib/agent/understand/types'

const CATALOG = [
  { id: 'p-sofa', name: 'مبل راحتی ونیز', price: 48_000_000, stock: 2, attributes: null, active: true },
  { id: 'p-table', name: 'میز جلومبلی آپادانا', price: 9_500_000, stock: 5, attributes: null, active: true },
  { id: 'p-puff', name: 'پاف مراکشی کرم', price: 3_200_000, stock: 0, attributes: null, active: true },
  { id: 'p-rug', name: 'فرش ماشینی کاشان', price: 12_000_000, stock: 4, attributes: null, active: true },
]
const CARDS = CATALOG.slice(0, 3).map(({ id, name }) => ({ id, name }))

function shownCards(): ConversationWorkingState {
  let state = createEmptyConversationWorkingState('m0')
  state = recordShowcase(state, CARDS)
  return rememberDiscussedEntities(state, CARDS, 'card', 'a1')
}

async function candidatesFor(state: ConversationWorkingState) {
  return buildTurnCandidates({
    agentId: 'agent', workspaceId: 'ws', history: [], state,
    capabilities: ['products', 'order_capture', 'restock'], serviceNames: [], coursesEnabled: false,
  })
}

const ask = 'همون پاف کرم که اول نشون دادی قیمتش چند بود؟'

describe('product memory survives topic drift', () => {
  beforeEach(() => {
    mocks.products.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) => CATALOG.filter((row) => where.id.in.includes(row.id)))
  })

  it('understanding path: side question, then a new topic, then «همون پاف اولی» → the exact puff row', async () => {
    let state = shownCards()
    state = advanceConversationWorkingState({
      state, sessionStartId: 'm0', message: 'هزینه ارسال به شیراز چقدره؟', messageId: 'm2', createdAt: new Date(),
      understood: { relation: 'SIDE_QUESTION', intent: 'BUSINESS_INFO', searchTerms: [], slots: { city: 'شیراز' } },
    })
    state = advanceConversationWorkingState({
      state, sessionStartId: 'm0', message: 'بی‌خیال، یه فرش هم میخوام', messageId: 'm3', createdAt: new Date(),
      understood: { relation: 'NEW_GOAL', intent: 'PRODUCT', searchTerms: ['فرش'], slots: {} },
    })
    state = rememberDiscussedEntities(recordShowcase(state, [{ id: 'p-rug', name: 'فرش ماشینی کاشان' }]), [{ id: 'p-rug', name: 'فرش ماشینی کاشان' }], 'card', 'a3')

    const candidates = await candidatesFor(state)
    const puff = [...candidates.shownCards, ...candidates.seen].find((item) => item.id === 'p-puff')
    expect(puff, JSON.stringify(candidates)).toBeDefined()
    expect(puff).toMatchObject({ name: 'پاف مراکشی کرم', price: 3_200_000, unavailable: true })

    // The model only has to name the ref; the server checks it exists.
    const reading: TurnUnderstanding = {
      v: 1, language: 'fa', relation: 'reference', answersPending: false, confidence: 0.86,
      acts: [{ type: 'product_question', target: puff!.ref, field: 'price' }],
      customer: { mood: 'neu', buy: 2, cues: [] },
    }
    const verified = verifyUnderstanding({ understanding: reading, candidates, message: ask, recentText: '', vocabulary: new Set() })
    expect(verified.acts).toHaveLength(1)
    expect(verified.refs[puff!.ref]).toMatchObject({ kind: 'product', id: 'p-puff' })

    const route = routeFromUnderstanding({ verified, candidates, message: ask, state, lang: 'fa' })
    expect(route.productIds).toEqual(['p-puff'])
    expect(route.productPlan?.isProductTurn).toBe(true)
    expect(route.booking).toBeNull()
  })

  it('a ref the conversation never had is refused instead of guessed', async () => {
    const candidates = await candidatesFor(shownCards())
    const verified = verifyUnderstanding({
      understanding: {
        v: 1, language: 'fa', relation: 'reference', answersPending: false, confidence: 0.9,
        acts: [{ type: 'product_question', target: 'seen:9', field: 'price' }],
        customer: { mood: 'neu', buy: 2, cues: [] },
      },
      candidates, message: ask, recentText: '', vocabulary: new Set(),
    })
    const route = routeFromUnderstanding({ verified, candidates, message: ask, state: shownCards(), lang: 'fa' })
    expect(route.productIds).toEqual([])
    expect(verified.notes.length).toBeGreaterThan(0)
  })

  it('legacy fallback path: a regex topic reset keeps the remembered products too', async () => {
    let state = shownCards()
    state = advanceConversationWorkingState({ state, sessionStartId: 'm0', message: 'بی خیال', messageId: 'm2', createdAt: new Date() })
    expect(state.status).toBe('RESET')
    expect(state.discussedEntities?.map((entity) => entity.id)).toEqual(['p-sofa', 'p-table', 'p-puff'])
    state = advanceConversationWorkingState({ state, sessionStartId: 'm0', message: 'موضوع جدید: فرش ماشینی میخوام', messageId: 'm3', createdAt: new Date() })
    expect(state.discussedEntities?.map((entity) => entity.id)).toContain('p-puff')
    const candidates = await candidatesFor(state)
    expect([...candidates.shownCards, ...candidates.seen].map((item) => item.id)).toContain('p-puff')
  })
})
