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
    } else {
      // Non-Instagram: just flip status back to OPEN so the AI takes over again.
      await prisma.conversation.update({
        where: { id: existing.id },
        data: { status: 'OPEN' },
      })
    }
    return NextResponse.json({ conversation: { id: existing.id, status: 'OPEN' } })
  }

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
