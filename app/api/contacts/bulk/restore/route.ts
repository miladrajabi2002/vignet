import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { restoreIdsSchema, restoreSoftDeleted } from '@/lib/soft-delete'

export const dynamic = 'force-dynamic'

/**
 * Undo endpoint for bulk-deleted contacts.
 * The bulk DELETE route returns the soft-deleted ids; the client posts them
 * back here within the undo window to bring the contacts back.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const parsed = restoreIdsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  }

  const result = await restoreSoftDeleted('contact', user.workspaceId, parsed.data.ids)
  return NextResponse.json(result)
}
