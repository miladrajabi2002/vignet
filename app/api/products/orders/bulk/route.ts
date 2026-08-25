import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'

export const dynamic = 'force-dynamic'

/**
 * Bulk-delete endpoints for store orders.
 *
 * GET  → returns { count } for the confirm dialog.
 *
 * DELETE → wipes ALL StoreOrder rows in the workspace. StoreOrders have
 * no downstream FKs that need manual cleanup — they reference a
 * Contact and an Integration but neither cascades back. So a simple
 * `deleteMany({ where: { workspaceId } })` is enough.
 *
 * We delete in batches of 1000 to stay well under Postgres' parameter
 * limit on stores with tens of thousands of historical orders (the
 * panel caps retention at 2000 per integration, so this is rarely
 * needed, but defensive coding is cheap).
 */

const BATCH_SIZE = 1000

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const count = await prisma.storeOrder.count({ where: { workspaceId: user.workspaceId } })
  return NextResponse.json({ count })
}

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed) {
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  }

  // Order IDs aren't needed for any downstream cleanup (StoreOrder has
  // no FK pointing AT it that doesn't already cascade), but we delete
  // in batches to stay under the Postgres parameter limit on huge
  // stores. We use the integrationId index implicitly by filtering on
  // workspaceId, which keeps the count + delete fast.
  let deleted = 0
  let batch = 0
  do {
    // Fetch a batch of IDs — we have to know which rows to delete
    // because deleteMany with just workspaceId would try to delete
    // ALL rows in one SQL statement, which can exceed the parameter
    // limit on stores with ~32k+ orders.
    const ids = await prisma.storeOrder.findMany({
      where: { workspaceId: user.workspaceId },
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
