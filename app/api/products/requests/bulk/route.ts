import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { REQUEST_CLOSED_STATUSES } from '@/lib/commerce/request-states'
import { REQUEST_BULK_SCOPES, countBulkScopes, parseBulkScope, requestBulkWhere } from '@/lib/bulk-delete/scopes'

export const dynamic = 'force-dynamic'

/**
 * Bulk delete of chat pre-orders, for the «حذف گروهی» menu on «درخواست‌ها».
 *
 * GET    → { count, counts }: how many each preset would remove.
 * DELETE → trashes the pre-orders of `?scope=` and returns their ids for the
 *          undo snackbar; the worker purges them after 7 days. Only closed
 *          ones are touched: an open pre-order is still a live cart.
 */
function deletable(workspaceId: string): Prisma.OrderDraftWhereInput {
  return { workspaceId, submittedAt: { not: null }, status: { in: [...REQUEST_CLOSED_STATUSES] } }
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const now = new Date()
  const counts = await countBulkScopes(REQUEST_BULK_SCOPES, (scope) =>
    prisma.orderDraft.count({ where: { AND: [deletable(user.workspaceId), requestBulkWhere(scope, now)] } }),
  )
  return NextResponse.json({ count: counts.all, counts })
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const scope = parseBulkScope(request, REQUEST_BULK_SCOPES)
  if (!scope) return NextResponse.json({ error: 'INVALID_SCOPE' }, { status: 400 })
  const where = { AND: [deletable(user.workspaceId), requestBulkWhere(scope)] }
  const ids = (await prisma.orderDraft.findMany({ where, select: { id: true } })).map((row) => row.id)
  if (ids.length) await prisma.orderDraft.deleteMany({ where: { AND: [where, { id: { in: ids } }] } })
  return NextResponse.json({ ok: true, ids })
}
