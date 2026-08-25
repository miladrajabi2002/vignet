import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'

export const dynamic = 'force-dynamic'

/**
 * Bulk-delete endpoints for conversations.
 *
 * GET  → returns { count } for the confirm dialog.
 *
 * DELETE → wipes ALL Conversation rows in the workspace. Cascades:
 *   • Message → onDelete: Cascade (chat history is destroyed)
 *   • HandoffAlert → onDelete: Cascade
 *   • ConversationSalesInsight → onDelete: Cascade
 *   • ConversationTurnLease → onDelete: Cascade (we own the conversation)
 *
 * ⚠️ This is the most destructive of the four bulk-delete operations.
 * Unlike contacts (which preserve chat history via SetNull), deleting
 * a conversation also destroys every message in it. The confirm dialog
 * warns the user about this explicitly.
 *
 * The Contact records themselves are NOT touched — a customer who
 * messaged us before will still appear in the contacts list, just
 * without their chat history.
 *
 * Deleted in batches of 500 (not 1000) because conversations carry
 * more cascade work per row — Messages + HandoffAlerts + Insights all
 * need to be deleted too, and 500 keeps each batch's transaction size
 * bounded.
 */

const BATCH_SIZE = 500

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const count = await prisma.conversation.count({ where: { workspaceId: user.workspaceId } })
  return NextResponse.json({ count })
}

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed) {
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  }

  let deleted = 0
  let batch = 0
  do {
    const ids = await prisma.conversation.findMany({
      where: { workspaceId: user.workspaceId },
      select: { id: true },
      take: BATCH_SIZE,
    })
    if (ids.length === 0) break
    const result = await prisma.conversation.deleteMany({
      where: { id: { in: ids.map((r) => r.id) } },
    })
    deleted += result.count
    batch = ids.length
  } while (batch === BATCH_SIZE)

  return NextResponse.json({ ok: true, deleted })
}
