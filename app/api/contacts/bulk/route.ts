import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'

export const dynamic = 'force-dynamic'

/**
 * Bulk-delete endpoints for contacts.
 *
 * GET  → returns { count } for the confirm dialog.
 *
 * DELETE → soft-deletes the supplied contact ids, or all Contact rows when no
 * JSON body is supplied. Every delete remains scoped to the current workspace.
 * The response contains the ids that were trashed — the UI feeds them to the
 * /restore endpoint for the «بازگردانی» (undo) snackbar. Rows are physically
 * removed by the worker's purge sweeper after 7 days.
 *
 * Because rows are only trashed, the "conversations become anonymous" cascade
 * (Contact→Conversation SetNull) never fires — restoring a contact brings its
 * conversation links back exactly as they were.
 */

const BATCH_SIZE = 1000
const MAX_DELETE_IDS = 20_000
const deleteSchema = z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(MAX_DELETE_IDS) })

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const count = await prisma.contact.count({ where: { workspaceId: user.workspaceId } })
  return NextResponse.json({ count })
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed) {
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  }

  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const parsed = deleteSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
    }

    // Only ids that currently belong to a LIVE row in this workspace get
    // trashed — the soft-delete extension hides already-trashed rows from
    // this findMany, so re-deleting trash is a no-op.
    const targets = await prisma.contact.findMany({
      where: {
        workspaceId: user.workspaceId,
        id: { in: parsed.data.ids },
      },
      select: { id: true },
    })
    const ids = targets.map((row) => row.id)
    if (ids.length > 0) {
      await prisma.contact.deleteMany({ where: { id: { in: ids } } })
    }
    return NextResponse.json({ ok: true, deleted: ids.length, ids })
  }

  const ids: string[] = []
  let batch = 0
  do {
    const rows = await prisma.contact.findMany({
      where: { workspaceId: user.workspaceId },
      select: { id: true },
      take: BATCH_SIZE,
    })
    if (rows.length === 0) break
    const batchIds = rows.map((r) => r.id)
    await prisma.contact.deleteMany({ where: { id: { in: batchIds } } })
    ids.push(...batchIds)
    batch = rows.length
  } while (batch === BATCH_SIZE)

  return NextResponse.json({ ok: true, deleted: ids.length, ids })
}
