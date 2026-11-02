import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { restoreIdsSchema, restoreSoftDeleted } from '@/lib/soft-delete'

export const dynamic = 'force-dynamic'

/**
 * Undo endpoint for bulk-deleted orders: store orders and gateway orders.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const parsed = restoreIdsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  }

  // The orders list also carries orders paid through the gateway (payments).
  const [stores, gateway] = await Promise.all([
    restoreSoftDeleted('storeOrder', user.workspaceId, parsed.data.ids),
    restoreSoftDeleted('cardPayment', user.workspaceId, parsed.data.ids),
  ])
  const restored = stores.restored + gateway.restored
  return NextResponse.json({ ok: true, restored, skipped: parsed.data.ids.length - restored })
}
