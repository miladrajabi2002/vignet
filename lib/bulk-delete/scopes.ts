import type { Prisma } from '@prisma/client'
import { stockFilterWhere } from '@/lib/products/stock-filter'

/**
 * Categorized bulk deletes — the «حذف گروهی» menu on each list offers a few
 * presets («محصولات ناموجود», «گفتگوهای حل‌شده», …) instead of one blunt
 * «حذف همه». Each preset is a named scope; the bulk routes accept it as
 * `?scope=` and turn it into a Prisma where clause here, so the count shown
 * in the menu and the rows actually trashed come from the same filter.
 *
 * Every where clause is ANDed with the caller's workspaceId by the route —
 * the scopes only narrow, never widen.
 */

const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS)
}

export const PRODUCT_BULK_SCOPES = ['all', 'out_of_stock', 'hidden', 'no_price', 'no_image', 'synced'] as const
export type ProductBulkScope = (typeof PRODUCT_BULK_SCOPES)[number]

export function productBulkWhere(scope: ProductBulkScope): Prisma.ProductWhereInput {
  switch (scope) {
    case 'out_of_stock':
      return stockFilterWhere('out_of_stock', 0)
    case 'hidden':
      return stockFilterWhere('hidden', 0)
    case 'no_price':
      return { OR: [{ price: null }, { price: { lte: 0 } }] }
    case 'no_image':
      return { images: { isEmpty: true } }
    case 'synced':
      return { sourceIntegrationId: { not: null } }
    default:
      return {}
  }
}

export const CONVERSATION_BULK_SCOPES = ['all', 'resolved', 'idle_30d', 'idle_90d', 'empty'] as const
export type ConversationBulkScope = (typeof CONVERSATION_BULK_SCOPES)[number]

/** No message for `days` days; a thread that never got one counts from its last update. */
function conversationIdleSince(cutoff: Date): Prisma.ConversationWhereInput {
  return {
    OR: [
      { lastMessageAt: { lt: cutoff } },
      { lastMessageAt: null, updatedAt: { lt: cutoff } },
    ],
  }
}

export function conversationBulkWhere(scope: ConversationBulkScope, now = new Date()): Prisma.ConversationWhereInput {
  switch (scope) {
    case 'resolved':
      return { status: 'RESOLVED' }
    case 'idle_30d':
      return conversationIdleSince(daysAgo(now, 30))
    case 'idle_90d':
      return conversationIdleSince(daysAgo(now, 90))
    case 'empty':
      // A day of grace so a thread that was just opened is not swept away
      // before its first message lands.
      return { messageCount: 0, createdAt: { lt: daysAgo(now, 1) } }
    default:
      return {}
  }
}

export const CONTACT_BULK_SCOPES = ['all', 'no_conversations', 'inactive_180d', 'anonymous'] as const
export type ContactBulkScope = (typeof CONTACT_BULK_SCOPES)[number]

export function contactBulkWhere(scope: ContactBulkScope, now = new Date()): Prisma.ContactWhereInput {
  switch (scope) {
    case 'no_conversations':
      // The soft-delete extension only filters top-level reads, so the
      // relation filter has to skip trashed conversations itself.
      return { conversations: { none: { deletedAt: null } } }
    case 'inactive_180d': {
      const cutoff = daysAgo(now, 180)
      return {
        OR: [
          { lastActivityAt: { lt: cutoff } },
          { lastActivityAt: null, createdAt: { lt: cutoff } },
        ],
      }
    }
    case 'anonymous':
      return {
        AND: [
          { OR: [{ name: null }, { name: '' }] },
          { OR: [{ phone: null }, { phone: '' }] },
        ],
      }
    default:
      return {}
  }
}

export const ORDER_BULK_SCOPES = ['all', 'cancelled', 'completed', 'older_90d'] as const
export type OrderBulkScope = (typeof ORDER_BULK_SCOPES)[number]

export function orderBulkWhere(scope: OrderBulkScope, now = new Date()): Prisma.StoreOrderWhereInput {
  switch (scope) {
    case 'cancelled':
      return { status: { in: ['cancelled', 'refunded', 'failed'] } }
    case 'completed':
      return { status: 'completed' }
    case 'older_90d': {
      const cutoff = daysAgo(now, 90)
      return {
        OR: [
          { orderDate: { lt: cutoff } },
          { orderDate: null, createdAt: { lt: cutoff } },
        ],
      }
    }
    default:
      return {}
  }
}

// Appointments are hard-deleted (no undo), so there is deliberately no «all»
// preset: only bookings that are over or never happened can be swept.
export const APPOINTMENT_BULK_SCOPES = ['cancelled', 'no_show', 'past_30d'] as const
export type AppointmentBulkScope = (typeof APPOINTMENT_BULK_SCOPES)[number]

export function appointmentBulkWhere(scope: AppointmentBulkScope, now = new Date()): Prisma.AppointmentWhereInput {
  switch (scope) {
    case 'cancelled':
      return { status: 'CANCELLED' }
    case 'no_show':
      return { status: 'NO_SHOW' }
    case 'past_30d':
      return { endsAt: { lt: daysAgo(now, 30) } }
  }
}

/**
 * Reads `?scope=` from a bulk route's URL. A missing scope means «all» (what
 * the old single «حذف همه» button sent); an unknown one is null so the route
 * can answer 400 instead of silently widening the delete to everything.
 */
export function parseBulkScope<T extends string>(request: Request, scopes: readonly T[]): T | null {
  const raw = new URL(request.url).searchParams.get('scope')
  if (raw === null || raw === '') return scopes[0]
  return (scopes as readonly string[]).includes(raw) ? (raw as T) : null
}

/** Counts every scope at once, for the menu's per-option badges. */
export async function countBulkScopes<T extends string>(
  scopes: readonly T[],
  count: (scope: T) => Promise<number>,
): Promise<Record<T, number>> {
  const values = await Promise.all(scopes.map((scope) => count(scope)))
  return Object.fromEntries(scopes.map((scope, i) => [scope, values[i]])) as Record<T, number>
}
