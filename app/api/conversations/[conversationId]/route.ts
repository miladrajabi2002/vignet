import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { dispatchSummary } from '@/lib/queue/jobs'
import { resumeAiForConversation } from '@/lib/instagram/automation'

type Params = { params: Promise<{ conversationId: string }> }

const updateSchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'HANDED_OFF']).optional(),
  rating: z.number().int().min(1).max(5).nullish(),
  // Clear the per-conversation AI pause flag + reopen so the AI agent resumes
  // replying (operator hands back control). The conversation's history, contact
  // and customerInfoState are preserved — only the pause flag is cleared.
  resumeAi: z.boolean().optional(),
})

export async function PATCH(req: Request, props: Params) {
  const params = await props.params;
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const existing = await prisma.conversation.findFirst({
    where: { id: params.conversationId, workspaceId: user.workspaceId },
    select: { id: true, status: true, summary: true, agentId: true, channel: true, externalId: true },
  })
  if (!existing) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const json = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(json)
  if (!parsed.success)
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  // Resume AI: clear metadata.aiPaused + reopen. Only meaningful for
  // Instagram conversations today (the only channel with the pause flag), but
  // harmless to call for others — it just reopens.
  if (parsed.data.resumeAi) {
    if (existing.channel === 'INSTAGRAM' && existing.externalId) {
      await resumeAiForConversation(existing.agentId, existing.externalId).catch(() => undefined)
    }
    // Keep the channel-specific pause flag and the universal ownership state in
    // sync. `handedOff` is itself a hard AI gate, so changing only `status`
    // would leave the conversation permanently operator-owned.
    await prisma.$transaction([
      prisma.conversation.update({
        where: { id: existing.id },
        data: { status: 'OPEN', handedOff: false },
      }),
      prisma.handoffAlert.updateMany({
        where: {
          conversationId: existing.id,
          state: { in: ['open', 'claimed'] },
        },
        data: { state: 'resolved', resolvedAt: new Date() },
      }),
    ])
    return NextResponse.json({ conversation: { id: existing.id, status: 'OPEN' } })
  }

  const conversation = await prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.update({
      where: { id: params.conversationId },
      data: parsed.data.status === 'RESOLVED'
        ? { ...parsed.data, handedOff: false }
        : parsed.data,
      select: { id: true, status: true, rating: true, summary: true },
    })

    if (parsed.data.status === 'RESOLVED') {
      await tx.handoffAlert.updateMany({
        where: {
          conversationId: params.conversationId,
          state: { in: ['open', 'claimed'] },
        },
        data: { state: 'resolved', resolvedAt: new Date() },
      })
    }
    return conversation
  })

  // When a conversation is freshly resolved and has no summary, generate one.
  const becameResolved =
    parsed.data.status === 'RESOLVED' && existing.status !== 'RESOLVED'
  if (becameResolved && !existing.summary) {
    await dispatchSummary({ conversationId: conversation.id })
  }

  return NextResponse.json({ conversation })
}

export async function DELETE(_req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const conversation = await prisma.conversation.findFirst({
    where: { id: params.conversationId, workspaceId: user.workspaceId },
    select: { id: true },
  })
  if (!conversation) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  // SOFT delete (deletedAt stamp) — same as the bulk route. The message
  // history and everything attached to the thread stay intact, so the
  // «بازگردانی» (undo) snackbar shown right after the delete can bring the
  // whole conversation back within the window. The worker's purge sweeper
  // physically removes rows (and their messages) after 7 days.
  try {
    // Soft delete must be explicit inside the guard: the root-client
    // auto-conversion does not apply here.
    const deleted = await prisma.conversation.updateMany({
      where: {
        id: conversation.id,
        workspaceId: user.workspaceId,
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    })
    if (deleted.count !== 1) throw new Error('CONVERSATION_DELETE_RACE')
  } catch (error) {
    console.error('Failed to delete conversation', {
      conversationId: conversation.id,
      workspaceId: user.workspaceId,
      error,
    })
    return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deleted: 1, ids: [conversation.id] })
}
