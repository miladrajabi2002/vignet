import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'

export const dynamic = 'force-dynamic'

/**
 * Bulk-delete endpoints for store orders.
 *
 * GET  → returns { count } for the confirm dialog.
 *
 * DELETE → soft-deletes ALL StoreOrder rows in the workspace and returns the
 * trashed ids for the undo snackbar («بازگردانی»). Rows are physically
 * removed by the worker's purge sweeper after 7 days.
 *
 * We trash in batches of 1000 to stay well under Postgres' parameter limit on
 * huge stores (the panel caps retention at 2000 per integration, so this is
 * rarely needed, but defensive coding is cheap).
 */

const BATCH_SIZE = 1000

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const count = await prisma.storeOrder.count({ where: { workspaceId: user.workspaceId } })
  return NextResponse.json({ count })
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed) {
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  }

  // Scoped mode: when the body supplies ids, ONLY those orders are trashed
  // (the selection bar on the orders page). Without a body the delete covers
  // the whole workspace (the «حذف همه» button).
  const contentType = request.headers.get('content-type') ?? ''
  let scopedIds: string[] | null = null
  if (contentType.includes('application/json')) {
    const parsed = z
      .object({ ids: z.array(z.string().min(1).max(64)).min(1).max(20_000) })
      .safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
    }
    scopedIds = parsed.data.ids
  }

  const ids: string[] = []
  let batch = 0
  do {
    // Fetch a batch of IDs — we have to know which rows to trash because
    // deleteMany with just workspaceId would try to update ALL rows in one
    // SQL statement, which can exceed the parameter limit on huge stores.
    const rows = await prisma.storeOrder.findMany({
      where: {
        workspaceId: user.workspaceId,
        ...(scopedIds ? { id: { in: scopedIds } } : {}),
      },
      select: { id: true },
      take: BATCH_SIZE,
    })
    if (rows.length === 0) break
    const batchIds = rows.map((r) => r.id)
    await prisma.storeOrder.deleteMany({ where: { id: { in: batchIds } } })
    ids.push(...batchIds)
    batch = rows.length
  } while (batch === BATCH_SIZE)

  // Reset order tracking for agents that never had it configured — only when
  // no live orders remain (mirrors the products bulk route).
  const remainingOrders = await prisma.storeOrder.count({ where: { workspaceId: user.workspaceId } })
  if (remainingOrders === 0) {
    await prisma.agent.updateMany({
      where: { workspaceId: user.workspaceId, orderTrackingConfigured: false },
      data: { orderTrackingEnabled: false },
    })
  }

  return NextResponse.json({ ok: true, deleted: ids.length, ids })
}
