import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  integrationFindMany: vi.fn(),
  integrationUpdate: vi.fn(),
  syncLogCreate: vi.fn(),
  capacity: vi.fn(),
  requestStoreResync: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    storeIntegration: { findMany: mocks.integrationFindMany, update: mocks.integrationUpdate },
    storeSyncLog: { create: mocks.syncLogCreate },
  },
}))

vi.mock('@/lib/billing/entitlements', () => ({
  checkWorkspaceResourceCreateAllowed: mocks.capacity,
}))

vi.mock('@/lib/commerce/store-api', () => ({
  requestStoreResync: mocks.requestStoreResync,
}))

import {
  markWooProductResyncStarted,
  pluginSupportsResync,
  requestWooProductResync,
  wooResyncHint,
} from '@/lib/integrations/woo-resync'

const store = (pluginVersion: string | null, storeUrl = 'https://shop.test') => ({
  storeUrl,
  webhookSecret: 'secret',
  pluginVersion,
})

describe('WooCommerce catalog resync after a plan upgrade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.capacity.mockResolvedValue({ allowed: true })
    mocks.requestStoreResync.mockResolvedValue({ ok: true, scheduled: true })
    mocks.syncLogCreate.mockResolvedValue({})
  })

  it('needs a plugin that can resend in the background', () => {
    expect(pluginSupportsResync('5.1.0')).toBe(true)
    expect(pluginSupportsResync('5.2')).toBe(true)
    expect(pluginSupportsResync('5.0.1')).toBe(false)
    expect(pluginSupportsResync(null)).toBe(false)
  })

  it('hints only when products were refused and the plan now has room', async () => {
    const flagged = { workspaceId: 'ws', productResyncNeededAt: new Date() }

    expect(await wooResyncHint(flagged, '5.1.0')).toEqual(['products'])
    expect(await wooResyncHint({ ...flagged, productResyncNeededAt: null }, '5.1.0')).toBeNull()
    expect(await wooResyncHint(flagged, '5.0.1')).toBeNull()

    mocks.capacity.mockResolvedValue({ allowed: false })
    expect(await wooResyncHint(flagged, '5.1.0')).toBeNull()
  })

  it('asks only the stores that lost products, and only capable plugins', async () => {
    mocks.integrationFindMany.mockResolvedValue([store('5.1.0'), store('5.0.1', 'https://old.test')])

    expect(await requestWooProductResync('ws')).toBe(1)
    expect(mocks.integrationFindMany.mock.calls[0][0].where).toMatchObject({
      workspaceId: 'ws',
      active: true,
      productResyncNeededAt: { not: null },
    })
    expect(mocks.requestStoreResync).toHaveBeenCalledTimes(1)
    expect(mocks.requestStoreResync).toHaveBeenCalledWith(
      { storeUrl: 'https://shop.test', webhookSecret: 'secret' },
      ['products'],
    )
  })

  it('does not disturb the store while the plan is still full', async () => {
    mocks.integrationFindMany.mockResolvedValue([store('5.1.0')])
    mocks.capacity.mockResolvedValue({ allowed: false })

    expect(await requestWooProductResync('ws')).toBe(0)
    expect(mocks.requestStoreResync).not.toHaveBeenCalled()
  })

  it('lets the owner force a resend of one store from the panel', async () => {
    mocks.integrationFindMany.mockResolvedValue([store('5.1.0')])
    mocks.capacity.mockResolvedValue({ allowed: false })

    expect(await requestWooProductResync('ws', { integrationId: 'int', force: true })).toBe(1)
    const where = mocks.integrationFindMany.mock.calls[0][0].where
    expect(where.id).toBe('int')
    expect(where).not.toHaveProperty('productResyncNeededAt')
  })

  it('leaves an unreachable or busy store to the webhook hint', async () => {
    mocks.integrationFindMany.mockResolvedValue([store('5.1.0'), store('5.1.0', 'https://busy.test')])
    mocks.requestStoreResync
      .mockRejectedValueOnce(new Error('STORE_HTTP_403'))
      .mockResolvedValueOnce({ ok: true, scheduled: false })

    expect(await requestWooProductResync('ws')).toBe(0)
  })

  it('stops asking once the plugin announces the resend', async () => {
    await markWooProductResyncStarted({ id: 'int', workspaceId: 'ws' })

    expect(mocks.integrationUpdate).toHaveBeenCalledWith({
      where: { id: 'int' },
      data: { productResyncNeededAt: null },
    })
  })
})
