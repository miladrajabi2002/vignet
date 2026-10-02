import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
  resolveConversationRecipient,
  sendOutbound,
  sendOutboundProducts,
  type OutboundDeliveryResult,
} from '@/lib/channels/outbound'
import {
  productShowcaseMarker,
  resolveWorkspaceProductShowcases,
} from '@/lib/products/presentation'
import { detectTurnLanguage } from '@/lib/ai/turn-language'
import { captureError } from '@/lib/errors/capture'
import { bumpContactActivity } from '@/lib/crm/contact-activity'
import { recordConversationActivity } from '@/lib/conversations/activity'
import { evaluateLearningEligibility } from '@/lib/ai/learning-policy'

type Params = { params: Promise<{ conversationId: string }> }

/** Meta's carousel and our card rail both cap one message at 10 products. */
const MAX_OPERATOR_PRODUCTS = 10

const bodySchema = z
  .object({
    text: z.string().max(4000).default(''),
    productIds: z.array(z.string().min(1).max(80)).max(MAX_OPERATOR_PRODUCTS).default([]),
  })
  .refine((body) => body.text.trim().length > 0 || body.productIds.length > 0, {
    message: 'EMPTY',
  })

/**
 * Operator (human handoff) reply. Persists an assistant-role message tagged as
 * operator-authored and pushes it to the contact on messenger channels. The
 * conversation is marked HANDED_OFF so the AI stays out of the thread.
 *
 * For web-widget / chat-link / API channels, the persisted history is the
 * outbound transport and the client reads it through the shared message feed.
 * Messenger channels are marked sent only after their provider adapter accepts
 * the message. A provider failure never discards the operator's typed reply.
 *
 * `productIds` attaches up to ten catalog products. They are resolved from the
 * workspace's own active rows (never from client data) and go out as an
 * Instagram carousel, Telegram/Bale/Rubika photo cards, or — on the widget and
 * chat link — as `[[product:…]]` snapshots the client renders as a card rail.
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
    select: {
      id: true,
      agentId: true,
      channel: true,
      externalId: true,
    },
  })
  if (!conversation) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const text = parsed.data.text.trim()

  // The customer question this reply answers — used to feed the learning
  // center so the operator's manual answer can be approved into the agent's
  // knowledge base (the most valuable training signal we have).
  const lastUserMessage = await prisma.message.findFirst({
    where: { conversationId: conversation.id, role: 'USER' },
    orderBy: { createdAt: 'desc' },
    select: { content: true },
  })
  const question = lastUserMessage?.content?.trim() ?? ''

  const products = parsed.data.productIds.length
    ? await resolveWorkspaceProductShowcases({
        workspaceId: user.workspaceId,
        productIds: parsed.data.productIds,
      })
    : []
  if (parsed.data.productIds.length > 0 && products.length === 0) {
    return NextResponse.json({ error: 'PRODUCTS_UNAVAILABLE' }, { status: 400 })
  }
  // Card prices and badges follow the language the customer writes in.
  const lang = detectTurnLanguage(text || question)

  // All supported channels pass through one outcome model. Messenger adapters
  // perform a live provider send; web/chat/API transports publish by persisting
  // into the conversation history below. Historical retired-channel messages
  // stay readable, while the shared delivery result avoids claiming a send.
  const recipient = resolveConversationRecipient(
    conversation.externalId,
  )
  const delivery: OutboundDeliveryResult = products.length
    ? await sendOutboundProducts({
        agentId: conversation.agentId,
        channel: conversation.channel,
        externalId: recipient,
        text,
        products,
        lang,
      })
    : await sendOutbound(
        conversation.agentId,
        conversation.channel,
        recipient,
        text,
      )
  if (delivery.status === 'failed') {
    captureError('conversation:operator-reply', delivery.cause ?? new Error('OUTBOUND_PROVIDER_ERROR'), {
      workspaceId: user.workspaceId,
      metadata: { conversationId: conversation.id, channel: conversation.channel },
    })
  }

  // Only typed words are a learnable answer; a bare product send is not.
  const learningCandidate = question && text
    ? evaluateLearningEligibility(question, text)
    : null
  const messageMetadata: Prisma.InputJsonValue = question && learningCandidate
    ? {
        operator: true,
        question,
        operatorAnswer: text,
        ...(products.length ? { products: products.map((product) => product.id) } : {}),
        learningCandidate: {
          eligible: learningCandidate.eligible,
          reasonCodes: learningCandidate.reasonCodes,
          policyVersion: learningCandidate.policyVersion,
        },
        delivery: { status: delivery.status, reason: delivery.reason ?? null },
      }
    : {
        operator: true,
        ...(products.length ? { products: products.map((product) => product.id) } : {}),
        delivery: { status: delivery.status, reason: delivery.reason ?? null },
      }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'ASSISTANT',
      // Product snapshots ride in the content like an agent showcase, so every
      // surface (dashboard thread, widget, chat link) renders the same cards.
      content: [text, products.map((product) => productShowcaseMarker(product, lang)).join('\n')]
        .filter(Boolean)
        .join('\n\n'),
      // `unanswered` surfaces this pair in the learning center as a suggestion;
      // approving it adds the Q&A to the knowledge base, dismissing clears it.
      unanswered: question.length > 0 && learningCandidate?.eligible === true,
      metadata: messageMetadata,
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

  return NextResponse.json({
    message,
    delivered: delivery.status === 'sent' || delivery.status === 'stored',
    delivery: { status: delivery.status, reason: delivery.reason },
  })
}
