import { describe, expect, it } from 'vitest'
import {
  APPOINTMENT_BULK_SCOPES,
  CONVERSATION_BULK_SCOPES,
  PRODUCT_BULK_SCOPES,
  appointmentBulkWhere,
  contactBulkWhere,
  conversationBulkWhere,
  orderBulkWhere,
  parseBulkScope,
  productBulkWhere,
} from '@/lib/bulk-delete/scopes'

const NOW = new Date('2026-10-15T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000

describe('bulk-delete scopes', () => {
  it('treats a missing scope as the first preset and rejects unknown ones', () => {
    expect(parseBulkScope(new Request('http://x/api/products/bulk'), PRODUCT_BULK_SCOPES)).toBe('all')
    expect(parseBulkScope(new Request('http://x/api/products/bulk?scope=out_of_stock'), PRODUCT_BULK_SCOPES)).toBe('out_of_stock')
    // An unknown preset must never widen to «all».
    expect(parseBulkScope(new Request('http://x/api/products/bulk?scope=everything'), PRODUCT_BULK_SCOPES)).toBeNull()
    expect(parseBulkScope(new Request('http://x/api/conversations/bulk?scope=resolved'), CONVERSATION_BULK_SCOPES)).toBe('resolved')
  })

  it('keeps «all» as an empty filter and narrows every other preset', () => {
    expect(productBulkWhere('all')).toEqual({})
    expect(productBulkWhere('out_of_stock')).toEqual({ stock: { lte: 0 } })
    expect(productBulkWhere('hidden')).toEqual({ active: false })
    expect(productBulkWhere('synced')).toEqual({ sourceIntegrationId: { not: null } })
    expect(conversationBulkWhere('resolved', NOW)).toEqual({ status: 'RESOLVED' })
    expect(orderBulkWhere('cancelled', NOW)).toEqual({ status: { in: ['cancelled', 'refunded', 'failed'] } })
  })

  it('dates the age presets from the same clock', () => {
    const month = new Date(NOW.getTime() - 30 * DAY)
    expect(conversationBulkWhere('idle_30d', NOW)).toEqual({
      OR: [{ lastMessageAt: { lt: month } }, { lastMessageAt: null, updatedAt: { lt: month } }],
    })
    const quarter = new Date(NOW.getTime() - 90 * DAY)
    expect(orderBulkWhere('older_90d', NOW)).toEqual({
      OR: [{ orderDate: { lt: quarter } }, { orderDate: null, createdAt: { lt: quarter } }],
    })
    expect(appointmentBulkWhere('past_30d', NOW)).toEqual({ endsAt: { lt: month } })
  })

  it('ignores trashed conversations when looking for customers without one', () => {
    expect(contactBulkWhere('no_conversations', NOW)).toEqual({ conversations: { none: { deletedAt: null } } })
  })

  it('offers no «all» preset for hard-deleted appointments', () => {
    expect(APPOINTMENT_BULK_SCOPES).not.toContain('all')
  })
})
