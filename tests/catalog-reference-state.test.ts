import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ findProducts: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: { product: { findMany: mocks.findProducts } },
}))

import {
  fetchCatalogProducts,
  findAssignedCatalogReference,
  planProductRequest,
  productRequestFromCatalogReference,
} from '@/lib/ai/conversation'
import {
  advanceConversationWorkingState,
  createEmptyConversationWorkingState,
  promoteConversationStateToProduct,
  startCatalogProductGoal,
} from '@/lib/ai/conversation-state'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.findProducts.mockResolvedValue([
    { id: 'p-shahdad-90', name: 'پاف ۹۰ شهداد', sku: null, tags: ['شهداد'], category: { name: 'پاف' } },
    { id: 'p-shahdad-70', name: 'پاف ۷۰ شهداد', sku: null, tags: ['شهداد'], category: { name: 'پاف' } },
  ])
})

describe('assigned-catalog entity recognition', () => {
  it('recognizes a real store-specific product absent from the global noun list', async () => {
    const message = 'پاف ۹۰ شهداد'
    const raw = planProductRequest(message, [])
    expect(raw.isProductTurn).toBe(false)

    const reference = await findAssignedCatalogReference('agent-1', message)
    expect(reference).toEqual({
      productIds: ['p-shahdad-90'],
      searchTerms: ['پاف', 'شهداد', '90'],
      match: 'EXACT',
    })
    const promoted = productRequestFromCatalogReference(raw, message, reference!)
    expect(promoted).toMatchObject({
      isProductTurn: true,
      explicitShowcase: true,
      resetProductContext: false,
      inventoryMode: 'AVAILABLE',
    })
  })

  it('does not turn an existing consultation plan into a forced showcase', () => {
    const message = 'جلومبلی میخواستم'
    const raw = planProductRequest(message, [])
    expect(raw).toMatchObject({ isProductTurn: true, explicitShowcase: false })
    const promoted = productRequestFromCatalogReference(raw, message, {
      productIds: ['coffee-table'],
      searchTerms: ['جلومبلی'],
      match: 'EXACT',
    })
    expect(promoted).toMatchObject({ isProductTurn: true, explicitShowcase: false })
  })

  it('promotes the working goal and keeps the catalog evidence IDs', async () => {
    const message = 'پاف ۹۰ شهداد'
    let state = advanceConversationWorkingState({
      state: createEmptyConversationWorkingState('s'),
      sessionStartId: 's',
      message,
      messageId: 'real-ig-message',
      createdAt: new Date(),
      productPlan: planProductRequest(message, []),
    })
    expect(state.activeGoal?.intent).toBe('GENERAL')
    const reference = await findAssignedCatalogReference('agent-1', message)
    state = promoteConversationStateToProduct(state, reference!.searchTerms, reference!.productIds, true)
    expect(state.activeGoal?.intent).toBe('PRODUCT')
    expect(state.lastTurn?.intent).toBe('PRODUCT')
    expect(state.searchAnchors).toEqual(['پاف', 'شهداد', '90'])
    expect(state.candidateEntityIds).toEqual(['p-shahdad-90'])
    expect(state.activeEntity).toMatchObject({ id: 'p-shahdad-90', source: 'CATALOG' })
  })

  it('can start a clean goal for a newly named store-specific product', () => {
    let state = advanceConversationWorkingState({
      state: createEmptyConversationWorkingState('s'),
      sessionStartId: 's',
      message: 'جلومبلی میخوام',
      messageId: 'old',
      createdAt: new Date(),
      productPlan: planProductRequest('جلومبلی میخوام', []),
    })
    state = advanceConversationWorkingState({
      state,
      sessionStartId: 's',
      message: 'نه، پاف ۹۰ شهداد',
      messageId: 'new',
      createdAt: new Date(),
      productPlan: planProductRequest('نه، پاف ۹۰ شهداد', []),
    })
    expect(state.lastTurn?.relation).toBe('CORRECTION')

    state = startCatalogProductGoal(
      state,
      'نه، پاف ۹۰ شهداد',
      'new',
      ['پاف', 'شهداد', '90'],
      ['p-shahdad-90'],
      true,
    )
    expect(state.lastTurn).toMatchObject({ relation: 'NEW_GOAL', intent: 'PRODUCT' })
    expect(state.activeGoal).toMatchObject({ intent: 'PRODUCT', sourceMessageId: 'new' })
    expect(state.searchAnchors).toEqual(['پاف', 'شهداد', '90'])
    expect(state.constraints).toEqual([])
    expect(state.candidateEntityIds).toEqual(['p-shahdad-90'])
  })

  it('recognizes an unavailable variant as a partial product reference', async () => {
    mocks.findProducts.mockResolvedValue([
      { id: 'wrong', name: 'پاف ۷۰ کویر', sku: null, tags: [], category: { name: 'پاف' } },
      { id: 'closest', name: 'پاف ۱۲۰ شهداد', sku: null, tags: ['شهداد'], category: { name: 'پاف' } },
    ])
    const reference = await findAssignedCatalogReference('agent-1', 'پاف ۹۰ شهداد')
    expect(reference).toEqual({
      productIds: ['closest'],
      searchTerms: ['پاف', 'شهداد', '90'],
      match: 'PARTIAL',
    })
    const plan = productRequestFromCatalogReference(
      planProductRequest('پاف ۹۰ شهداد', []),
      'پاف ۹۰ شهداد',
      reference!,
    )
    expect(plan.explicitShowcase).toBe(false)
  })

  it('rejects a phrase that does not identify even a partial catalog subject', async () => {
    mocks.findProducts.mockResolvedValue([
      { id: 'unrelated', name: 'میز تلویزیون ایوان', sku: null, tags: [], category: { name: 'میز' } },
    ])
    expect(await findAssignedCatalogReference('agent-1', 'پاف ۹۰ شهداد')).toBeNull()
  })

  it('rejects an ambiguous one-word modifier and a tags-only coincidence', async () => {
    mocks.findProducts.mockResolvedValue([
      { id: 'green-1', name: 'مبل مدرن سبز', sku: null, tags: ['زغالی'], category: { name: 'مبل' } },
      { id: 'green-2', name: 'صندلی سبز', sku: null, tags: ['زغالی'], category: { name: 'صندلی' } },
    ])
    expect(await findAssignedCatalogReference('agent-1', 'سبز')).toBeNull()
    expect(await findAssignedCatalogReference('agent-1', 'زغالی')).toBeNull()
  })

  it('accepts a one-word exact assigned category as a broad product subject', async () => {
    mocks.findProducts.mockResolvedValue([
      { id: 'pouf-1', name: 'پاف شهداد', sku: null, tags: [], category: { name: 'پاف نیمکتی' } },
      { id: 'pouf-2', name: 'پاف کویر', sku: null, tags: [], category: { name: 'پاف نیمکتی' } },
    ])
    expect(await findAssignedCatalogReference('agent-1', 'پاف')).toEqual({
      productIds: ['pouf-1', 'pouf-2'],
      searchTerms: ['پاف'],
      match: 'EXACT',
    })
  })

  it('is scoped to active products assigned to the current agent', async () => {
    await findAssignedCatalogReference('agent-private', 'پاف ۹۰ شهداد')
    expect(mocks.findProducts).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        active: true,
        catalogItems: { some: { agentId: 'agent-private' } },
      }),
      take: 40,
    }))
  })

  it('keeps a rare exact-name candidate ahead of a capped broad category pool', async () => {
    const product = (id: string, name: string, description = '') => ({
      id,
      name,
      description,
      price: 100,
      stock: null,
      images: [],
      externalUrl: null,
      sku: null,
      tags: [],
      attributes: {},
      queryCount: 0,
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      category: { name: 'پیراهن' },
    })
    mocks.findProducts
      // Priority lane: the rare identity term «شراره».
      .mockResolvedValueOnce([product('target', 'پیراهن شراره 0054', 'جنس حریر')])
      // Broad lane: imagine the first 160 popular «پیراهن» rows omitted it.
      .mockResolvedValueOnce([product('popular', 'پیراهن دیگر')])

    const history = [
      { role: 'user' as const, content: 'پیراهن شراره طرح شش' },
      { role: 'assistant' as const, content: 'طرح 10 و 11 موجودند.' },
    ]
    const plan = planProductRequest('پارچش چه پارچه ای', history)
    const results = await fetchCatalogProducts('agent-1', [], plan)

    expect(results.map((item) => item.id)).toEqual(['target'])
    expect(mocks.findProducts).toHaveBeenCalledTimes(2)
  })

  it.each([
    'آدرس فروشگاه کجاست؟',
    'هزینه ارسال چقدره؟',
    'شماره پیگیری سفارش ۱۲۳۴',
    'خدمات موجود رو بگو',
    'موضوع قبلی رو فراموش کن',
  ])('never probes catalog for a clear non-product request: %s', async (message) => {
    expect(await findAssignedCatalogReference('agent-1', message)).toBeNull()
  })
})
