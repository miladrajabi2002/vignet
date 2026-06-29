import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { sendOutbound } from '@/lib/channels/outbound'
import { captureError } from '@/lib/errors/capture'

type Params = { params: { conversationId: string } }

const bodySchema = z.object({ text: z.string().min(1).max(4000) })

/**
 * Operator (human handoff) reply. Persists an assistant-role message tagged as
 * operator-authored and pushes it to the contact on messenger channels. The
 * conversation is marked HANDED_OFF so the AI stays out of the thread.
 */
export async function POST(req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const conversation = await prisma.conversation.findFirst({
    where: { id: params.conversationId, workspaceId: user.workspaceId },
    select: { id: true, agentId: true, channel: true, externalId: true },
  })
  if (!conversation) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const text = parsed.data.text.trim()

  // Deliver first so we don't record a message that never reached the contact.
  let delivered = false
  try {
    delivered = await sendOutbound(
      conversation.agentId,
      conversation.channel,
      conversation.externalId,
      text,
    )
  } catch (e) {
    captureError('conversation:operator-reply', e, {
      workspaceId: user.workspaceId,
      metadata: { conversationId: conversation.id, channel: conversation.channel },
    })
    return NextResponse.json({ error: 'DELIVERY_FAILED' }, { status: 502 })
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'ASSISTANT',
      content: text,
      metadata: { operator: true },
    },
    select: { id: true, content: true, createdAt: true, role: true },
  })

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      status: 'HANDED_OFF',
      messageCount: { increment: 1 },
      lastMessageAt: new Date(),
    },
  })

  return NextResponse.json({ message, delivered })
}
