import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { sendOutbound } from '@/lib/channels/outbound'
import { isMessengerType } from '@/lib/channels/registry'
import { captureError } from '@/lib/errors/capture'
import { bumpContactActivity } from '@/lib/crm/contact-activity'
import { recordConversationActivity } from '@/lib/conversations/activity'

type Params = { params: Promise<{ conversationId: string }> }

const bodySchema = z.object({ text: z.string().min(1).max(4000) })

/**
 * Operator (human handoff) reply. Persists an assistant-role message tagged as
 * operator-authored and pushes it to the contact on messenger channels. The
 * conversation is marked HANDED_OFF so the AI stays out of the thread.
 *
 * For web-widget / chat-link / API channels, there is no outbound push
 * (these are request/response channels) — the message is persisted and the
 * visitor sees it on their next page load. For messenger channels we attempt
 * delivery; if delivery fails we STILL persist the message (the operator typed
 * it, it should be saved) and report `delivered: false`.
 */
export async function POST(req: Request, props: Params) {
  const params = await props.params;
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

  // Only attempt outbound delivery for messenger channels that have an
  // external thread id. Web-widget / chat-link / API channels are
  // request/response — there's no API to push to, so we skip delivery
  // entirely and just persist the message.
  let delivered = false
  if (isMessengerType(conversation.channel) && conversation.externalId) {
    try {
      delivered = await sendOutbound(
        conversation.agentId,
        conversation.channel,
        conversation.externalId,
        text,
      )
    } catch (e) {
      // Log the delivery failure but DON'T abort — the operator's reply
      // should still be saved in the thread so it's visible in the
      // dashboard and to the visitor on their next load.
      captureError('conversation:operator-reply', e, {
        workspaceId: user.workspaceId,
        metadata: { conversationId: conversation.id, channel: conversation.channel },
      })
    }
  }

  // The customer question this reply answers — used to feed the learning
  // center so the operator's manual answer can be approved into the agent's
  // knowledge base (the most valuable training signal we have).
  const lastUserMessage = await prisma.message.findFirst({
    where: { conversationId: conversation.id, role: 'USER' },
    orderBy: { createdAt: 'desc' },
    select: { content: true },
  })
  const question = lastUserMessage?.content?.trim() ?? ''

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'ASSISTANT',
      content: text,
      // `unanswered` surfaces this pair in the learning center as a suggestion;
      // approving it adds the Q&A to the knowledge base, dismissing clears it.
      unanswered: question.length > 0,
      metadata: question.length > 0
        ? { operator: true, question, operatorAnswer: text }
        : { operator: true },
    },
    select: { id: true, content: true, createdAt: true, role: true },
  })
  await recordConversationActivity(prisma, conversation.id, {
    kind: 'operator_reply',
    source: 'dashboard',
  }).catch(() => {})

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      status: 'HANDED_OFF',
      handedOff: true,
      messageCount: { increment: 1 },
      lastMessageAt: new Date(),
    },
  })
  // Keep the contact's denormalized last-activity fresh for the CRM list.
  bumpContactActivity(conversation.id)

  return NextResponse.json({ message, delivered })
}
