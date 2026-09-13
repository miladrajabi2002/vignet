import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'

export const dynamic = 'force-dynamic'

/**
 * Bulk-delete endpoints for conversations.
 *
 * GET  → returns { count } for the confirm dialog.
 *
 * DELETE → soft-deletes ALL Conversation rows in the workspace and returns
 * the trashed ids for the undo snackbar. Because the soft-delete extension
 * replaces the row removal with a `deletedAt` stamp, the Message/HandoffAlert/
 * SalesInsight cascades never fire — chat history survives untouched and the
 * «بازگردانی» (undo) endpoint brings everything back within the window. The
 * worker's purge sweeper physically removes rows (and their messages) after
 * 7 days.
 */

const BATCH_SIZE = 500

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const count = await prisma.conversation.count({ where: { workspaceId: user.workspaceId } })
  return NextResponse.json({ count })
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed) {
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  }

  // Scoped mode: when the body supplies ids, ONLY those conversations are
  // trashed (the selection bar on the conversations page). Without a body the
  // delete covers the whole workspace (the «حذف همه» button).
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
    const rows = await prisma.conversation.findMany({
      where: {
        workspaceId: user.workspaceId,
        ...(scopedIds ? { id: { in: scopedIds } } : {}),
      },
      select: { id: true },
      take: BATCH_SIZE,
    })
    if (rows.length === 0) break
    const batchIds = rows.map((r) => r.id)
    await prisma.conversation.deleteMany({ where: { id: { in: batchIds } } })
    ids.push(...batchIds)
    batch = rows.length
  } while (batch === BATCH_SIZE)

  return NextResponse.json({ ok: true, deleted: ids.length, ids })
}
