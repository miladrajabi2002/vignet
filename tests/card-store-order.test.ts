import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { isFinalStoreError, nextStoreSyncAt, pluginPlacesCardOrders, STORE_SYNC_BACKOFF_MS } from '@/lib/payments/card/store-order'
import { StoreApiError } from '@/lib/commerce/store-api'
import { gatewaySetupState } from '@/lib/payments/card/setup'
import { readPayGatewaySettings } from '@/lib/payments/card/settings'

describe('card-to-card order → WooCommerce', () => {
  it('needs plugin 5.2 or newer', () => {
    expect(pluginPlacesCardOrders('5.2.0')).toBe(true)
    expect(pluginPlacesCardOrders('5.10.1')).toBe(true)
    expect(pluginPlacesCardOrders('5.1.4')).toBe(false)
    expect(pluginPlacesCardOrders(null)).toBe(false)
  })

  it('backs off, then gives up after the last wait', () => {
    const now = new Date('2026-10-15T10:00:00Z')
    expect(nextStoreSyncAt(1, now)?.getTime()).toBe(now.getTime() + STORE_SYNC_BACKOFF_MS[0])
    expect(nextStoreSyncAt(STORE_SYNC_BACKOFF_MS.length, now)).not.toBeNull()
    expect(nextStoreSyncAt(STORE_SYNC_BACKOFF_MS.length + 1, now)).toBeNull()
  })

  it('retries a store that is down, not one that refused the order', () => {
    expect(isFinalStoreError(new StoreApiError('STORE_UNREACHABLE', 0))).toBe(false)
    expect(isFinalStoreError(new StoreApiError('STORE_HTTP_500', 500))).toBe(false)
    expect(isFinalStoreError(new StoreApiError('busy', 409))).toBe(false)
    expect(isFinalStoreError(new StoreApiError('STORE_ROUTE_NOT_FOUND', 404))).toBe(true)
    expect(isFinalStoreError(new StoreApiError('no products', 422))).toBe(true)
    expect(isFinalStoreError(new Error('x'))).toBe(false)
  })
})

describe('gateway activation', () => {
  const card = { id: 'c', bankKey: 'mellat', bin: '610433', last4: '5675', holderName: 'n', active: true, dailyCap: null, verified: false, receivedToday: 0 }
  const device = { id: 'd', name: 'p', platform: 'ANDROID' as const, method: 'SMS' as const, phone: null, url: '', active: true, connectedAt: '2026-10-15T00:00:00Z', verifiedAt: '2026-10-15T00:01:00Z', lastSmsAt: null }

  it('is complete only after all four steps', () => {
    expect(gatewaySetupState({ cards: [card], devices: [{ ...device, verifiedAt: null }], enabled: true, platformEnabled: true }).current).toBe('test')
    expect(gatewaySetupState({ cards: [card], devices: [device], enabled: false, platformEnabled: true }).current).toBe('switch')
    expect(gatewaySetupState({ cards: [card], devices: [device], enabled: true, platformEnabled: true }).complete).toBe(true)
  })

  it('keeps the activation date through a settings round-trip', () => {
    const stored = { manualClaim: false, showHolderName: true, activatedAt: '2026-10-15T10:00:00.000Z' }
    expect(readPayGatewaySettings(stored).activatedAt).toBe(stored.activatedAt)
    expect(readPayGatewaySettings({ ...readPayGatewaySettings(stored), manualClaim: true }).activatedAt).toBe(stored.activatedAt)
    expect(readPayGatewaySettings(null).activatedAt).toBeNull()
  })
})
