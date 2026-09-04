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
 * DELETE → deletes the supplied contact ids, or all Contact rows when no JSON
 * body is supplied. Every delete remains scoped to the current workspace.
 * Cascades:
 *   • Conversation.contactId has onDelete: SetNull — so conversations
 *     are preserved, but their contactId is set to NULL. This means
 *     chat history is NOT lost; it just becomes "anonymous" until a
 *     new contact is matched to the conversation.
 *   • CampaignRecipient has onDelete: Cascade — campaign sends to
 *     deleted contacts are removed automatically.
 *   • Appointment has onDelete: Cascade — appointments with deleted
 *     contacts are removed automatically.
 *
 * We deliberately DO NOT touch Conversations, Messages, or
 * Appointments directly here. The cascade / set-null behavior above
 * is the desired semantic: deleting a customer should NOT delete
 * their support history.
 *
 * Deleted in batches of 1000 to stay under Postgres' parameter limit.
 */

const BATCH_SIZE = 1000
const deleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(BATCH_SIZE) })

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

    const result = await prisma.contact.deleteMany({
      where: {
        workspaceId: user.workspaceId,
        id: { in: parsed.data.ids },
      },
    })
    return NextResponse.json({ ok: true, deleted: result.count })
  }

  let deleted = 0
  let batch = 0
  do {
    const ids = await prisma.contact.findMany({
      where: { workspaceId: user.workspaceId },
      select: { id: true },
      take: BATCH_SIZE,
    })
    if (ids.length === 0) break
    const result = await prisma.contact.deleteMany({
      where: { id: { in: ids.map((r) => r.id) } },
    })
    deleted += result.count
    batch = ids.length
  } while (batch === BATCH_SIZE)

  return NextResponse.json({ ok: true, deleted })
}
