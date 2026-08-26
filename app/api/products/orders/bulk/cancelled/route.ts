import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'

export const dynamic = 'force-dynamic'

/**
 * Bulk-delete endpoint for CANCELLED store orders.
 *
 * GET  → returns { count } of cancelled orders in the workspace, for the
 *        confirm dialog ("N سفارش لغو شده حذف می‌شود؟").
 *
 * DELETE → deletes ONLY orders with status='cancelled'. Non-cancelled
 *          orders (pending, processing, completed, refunded, failed) are
 *          left untouched.
 *
 * Sibling to /api/products/orders/bulk (which wipes ALL orders). The
 * "delete all" button stays untouched; this new endpoint powers the
 * "delete only cancelled" button next to it.
 *
 * Implementation notes:
 *   • We delete in batches of 1000 to stay well under Postgres' parameter
 *     limit on stores with tens of thousands of cancelled orders.
 *   • We filter by `workspaceId` AND `status='cancelled'` so the query
 *     can use the existing `@@index([workspaceId])` for fast lookup.
 *   • The WooCommerce plugin sends `status` as the no-prefix form
 *     (`'cancelled'`, not `'wc-cancelled'`) — see WC_Order::get_status()
 *     in the WP plugin's order_to_payload(). So we match against the
 *     no-prefix form here. If a future plugin version changes this, the
 *     filter will simply match zero rows (safe — nothing gets deleted
 *     by mistake).
 */

const BATCH_SIZE = 1000

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const count = await prisma.storeOrder.count({
    where: {
      workspaceId: user.workspaceId,
      status: 'cancelled',
    },
  })
  return NextResponse.json({ count })
}

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed) {
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  }

  // Same batched-delete pattern as the wipe-all endpoint above. We filter
  // on both workspaceId and status='cancelled' so the query uses the
  // workspaceId index and only returns the rows we want to delete.
  let deleted = 0
  let batch = 0
  do {
    const ids = await prisma.storeOrder.findMany({
      where: {
        workspaceId: user.workspaceId,
        status: 'cancelled',
      },
      select: { id: true },
      take: BATCH_SIZE,
    })
    if (ids.length === 0) break
    const result = await prisma.storeOrder.deleteMany({
      where: { id: { in: ids.map((r) => r.id) } },
    })
    deleted += result.count
    batch = ids.length
  } while (batch === BATCH_SIZE)

  return NextResponse.json({ ok: true, deleted })
}
