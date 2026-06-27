import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { dispatchSummary } from '@/lib/queue/jobs'

type Params = { params: { conversationId: string } }

const updateSchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'HANDED_OFF']).optional(),
  rating: z.number().int().min(1).max(5).nullish(),
})

export async function PATCH(req: Request, { params }: Params) {
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
