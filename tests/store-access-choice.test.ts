import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  workspaceFindUnique: vi.fn(),
  storeFindFirst: vi.fn(),
  agentFindMany: vi.fn(),
  agentUpdateMany: vi.fn(),
  findCheckoutIntegration: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findUnique: mocks.workspaceFindUnique },
    storeIntegration: { findFirst: mocks.storeFindFirst },
    agent: { findMany: mocks.agentFindMany, updateMany: mocks.agentUpdateMany },
  },
}))
vi.mock('@/lib/commerce/checkout-service', () => ({ findCheckoutIntegration: mocks.findCheckoutIntegration }))

import { loadStoreAccessChoice, saveStoreAccessChoice } from '@/lib/agents/store-access-choice'

const undecidedAgent = {
  productAccessEnabled: false,
  orderTrackingEnabled: false,
  orderCaptureEnabled: false,
  payLinkEnabled: false,
  productAccessConfigured: false,
  orderTrackingConfigured: false,
  orderCaptureConfigured: false,
  payLinkConfigured: false,
}
const checkoutStore = { id: 'store-1', storeUrl: 'https://shop.example.com/', webhookSecret: 's', pluginVersion: '5.0.0', checkoutFlow: 'AUTO' }

describe('store access choice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.workspaceFindUnique.mockResolvedValue({ businessType: 'COMMERCE', businessProfile: null })
    mocks.storeFindFirst.mockResolvedValue({ storeUrl: 'https://shop.example.com/' })
    mocks.findCheckoutIntegration.mockResolvedValue({ integration: null, fallback: null })
    mocks.agentFindMany.mockResolvedValue([undecidedAgent])
  })

  it('asks nothing until a store is connected', async () => {
    mocks.storeFindFirst.mockResolvedValue(null)

    expect((await loadStoreAccessChoice('ws-1')).pending).toBe(false)
    expect(mocks.agentFindMany).not.toHaveBeenCalled()
  })

  it('asks once a store is connected, starting from products and order tracking on', async () => {
    const choice = await loadStoreAccessChoice('ws-1')

    expect(choice).toMatchObject({ pending: true, checkoutReady: false, storeHost: 'shop.example.com', agentCount: 1 })
    expect(choice.values).toEqual({
      productAccessEnabled: true,
      orderTrackingEnabled: true,
      orderCaptureEnabled: false,
      payLinkEnabled: false,
    })
  })

  it('offers in-chat selling by default when the plugin takes payments, and keeps an owner’s own answer', async () => {
    mocks.findCheckoutIntegration.mockResolvedValue({ integration: checkoutStore, fallback: checkoutStore })
    mocks.agentFindMany.mockResolvedValue([{ ...undecidedAgent, productAccessConfigured: true }])

    const { checkoutReady, values } = await loadStoreAccessChoice('ws-1')

    expect(checkoutReady).toBe(true)
    expect(values).toEqual({
      productAccessEnabled: false,
      orderTrackingEnabled: true,
      orderCaptureEnabled: true,
      payLinkEnabled: true,
    })
  })

  it('is settled once every agent has an answer', async () => {
    mocks.agentFindMany.mockResolvedValue([])

    expect((await loadStoreAccessChoice('ws-1')).pending).toBe(false)
  })

  it('records the answer as the owner’s choice and leaves the payment link open without a checkout store', async () => {
    mocks.agentFindMany.mockResolvedValue([{ id: 'agent-1' }])

    const ids = await saveStoreAccessChoice('ws-1', {
      productAccessEnabled: true,
      orderTrackingEnabled: false,
      orderCaptureEnabled: true,
      payLinkEnabled: true,
    })

    expect(ids).toEqual(['agent-1'])
    expect(mocks.agentUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['agent-1'] }, workspaceId: 'ws-1' },
      data: {
        productAccessEnabled: true,
        productAccessConfigured: true,
        orderTrackingEnabled: false,
        orderTrackingConfigured: true,
        orderCaptureEnabled: true,
        orderCaptureConfigured: true,
      },
    })
  })

  it('switches selling off with product access, payment link included', async () => {
    mocks.findCheckoutIntegration.mockResolvedValue({ integration: checkoutStore, fallback: checkoutStore })
    mocks.agentFindMany.mockResolvedValue([{ id: 'agent-1' }])

    await saveStoreAccessChoice('ws-1', {
      productAccessEnabled: false,
      orderTrackingEnabled: true,
      orderCaptureEnabled: true,
      payLinkEnabled: true,
    })

    expect(mocks.agentUpdateMany.mock.calls[0][0].data).toMatchObject({
      orderCaptureEnabled: false,
      payLinkEnabled: false,
      payLinkConfigured: true,
    })
  })
})
