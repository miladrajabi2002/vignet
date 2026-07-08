import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { dispatchSummary } from '@/lib/queue/jobs'
import { captureError } from '@/lib/errors/capture'

type Params = { params: Promise<{ conversationId: string }> }

const updateSchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'HANDED_OFF']).optional(),
  rating: z.number().int().min(1).max(5).nullish(),
})

export async function PATCH(req: Request, props: Params) {
  const params = await props.params;
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const existing = await prisma.conversation.findFirst({
    where: { id: params.conversationId, workspaceId: user.workspaceId },
    select: { id: true, status: true, summary: true },
  })
  if (!existing) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const json = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(json)
  if (!parsed.success)
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const conversation = await prisma.conversation.update({
    where: { id: params.conversationId },
    data: parsed.data,
    select: { id: true, status: true, rating: true, summary: true },
  })

  // When a conversation is freshly resolved and has no summary, generate one.
  const becameResolved =
    parsed.data.status === 'RESOLVED' && existing.status !== 'RESOLVED'
  if (becameResolved && !existing.summary) {
    await dispatchSummary({ conversationId: conversation.id })
  }

  return NextResponse.json({ conversation })
}

/**
 * DELETE /api/conversations/:conversationId — permanently remove a
 * conversation, its messages, and its handoff alerts from the workspace.
 *
 * Auth: the caller must own the workspace. Messages are deleted explicitly
 * because the Message→Conversation FK has no `onDelete: Cascade` (see
 * prisma/schema.prisma). HandoffAlert has `onDelete: Cascade` so it goes
 * automatically, but we delete it explicitly anyway for clarity + so we
 * can run both deletes inside one transaction.
 */
export async function DELETE(_req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const existing = await prisma.conversation.findFirst({
    where: { id: params.conversationId, workspaceId: user.workspaceId },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  try {
    await prisma.$transaction([
      prisma.message.deleteMany({ where: { conversationId: params.conversationId } }),
      prisma.handoffAlert.deleteMany({ where: { conversationId: params.conversationId } }),
      prisma.conversation.delete({ where: { id: params.conversationId } }),
    ])
  } catch (e) {
    captureError('conversation:delete', e, {
      workspaceId: user.workspaceId,
      metadata: { conversationId: params.conversationId },
    })
    return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
