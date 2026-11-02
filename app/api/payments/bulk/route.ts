import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { deletablePaymentsWhere } from '@/lib/payments/card/fulfilment'
import { PAYMENT_BULK_SCOPES, countBulkScopes, parseBulkScope, paymentBulkWhere } from '@/lib/bulk-delete/scopes'

export const dynamic = 'force-dynamic'

/**
 * Bulk delete of gateway payments, for the «حذف گروهی» menu on /payments.
 *
 * GET    → { count, counts }: how many each preset would remove.
 * DELETE → trashes the payments of `?scope=` (default: the failed ones) and
 *          returns their ids for the undo snackbar; the worker purges them
 *          after 7 days. Open payments are never touched; see paymentBulkWhere.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const now = new Date()
  const base = deletablePaymentsWhere(user.workspaceId)
  const counts = await countBulkScopes(PAYMENT_BULK_SCOPES, (scope) =>
    prisma.cardPayment.count({ where: { AND: [base, paymentBulkWhere(scope, now)] } }),
  )
  return NextResponse.json({ count: counts.all, counts })
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const scope = parseBulkScope(request, PAYMENT_BULK_SCOPES)
  if (!scope) return NextResponse.json({ error: 'INVALID_SCOPE' }, { status: 400 })
  const where = { AND: [deletablePaymentsWhere(user.workspaceId), paymentBulkWhere(scope)] }
  const ids = (await prisma.cardPayment.findMany({ where, select: { id: true } })).map((row) => row.id)
  if (ids.length) await prisma.cardPayment.deleteMany({ where: { AND: [where, { id: { in: ids } }] } })
  return NextResponse.json({ ok: true, ids })
}
