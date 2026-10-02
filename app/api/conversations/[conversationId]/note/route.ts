import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { recordConversationActivity } from '@/lib/conversations/activity'

type Params = { params: Promise<{ conversationId: string }> }

const bodySchema = z.object({ text: z.string().trim().min(1).max(1000) })

/**
 * POST /api/conversations/:conversationId/note — an internal note on the
 * conversation timeline. It is a SYSTEM row, so it never reaches the customer
 * (public feeds drop SYSTEM rows) or the agent's history (USER/ASSISTANT only).
 */
export async function POST(req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const conversation = await prisma.conversation.findFirst({
    where: { id: params.conversationId, workspaceId: user.workspaceId },
    select: { id: true },
  })
  if (!conversation) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const message = await recordConversationActivity(prisma, conversation.id, {
    kind: 'operator_note',
    note: parsed.data.text,
    author: user.name?.trim() || undefined,
  })
  return NextResponse.json({
    message: {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      contentType: 'TEXT',
      metadata: message.metadata,
    },
  })
}
