/**
 * A payment the owner asks for inside a conversation: from «پرداخت تازه»
 * with a customer picked, or from «درخواست پرداخت» in the thread. The card
 * goes out like an agent's card (a card on Telegram/Bale, the number and the
 * amount as separate messages elsewhere, a live card on the widget), and
 * the payment carries the conversation so the customer hears when it lands.
 */
import type { CardPayment, ChannelType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { cardPayMarker } from '@/lib/payments/card/pay-card'
import { readPayGatewaySettings } from '@/lib/payments/card/settings'
import { cardPayView, createCardPayment, manualLinkReference, payPageUrl, type CreatePaymentError } from '@/lib/payments/card/service'
import type { PayItem } from '@/lib/payments/card/items'
import { cleanContactName } from '@/lib/crm/display'

/** Instagram only lets a business write within a day of the customer's last message. */
export const INSTAGRAM_WINDOW_MS = 24 * 3_600_000

export type PaymentRequestError = CreatePaymentError | 'NOT_FOUND' | 'WINDOW_CLOSED'

export type PaymentRequestResult =
  | { ok: true; payment: CardPayment; url: string; delivery: 'sent' | 'stored' | 'failed'; message: { id: string; role: string; content: string; createdAt: Date; metadata: unknown } | null }
  | { ok: false; error: PaymentRequestError }

export async function requestPaymentInConversation(input: {
  workspaceId: string
  conversationId: string
  /** Whole tomans. */
  amount: number
  description?: string | null
  items?: PayItem[] | null
  /** A line to go with the card; a short default otherwise. */
  note?: string | null
}): Promise<PaymentRequestResult> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, workspaceId: input.workspaceId, deletedAt: null },
    select: {
      id: true,
      agentId: true,
      channel: true,
      externalId: true,
      contact: { select: { name: true, phone: true } },
      messages: { where: { role: 'USER' }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
    },
  })
  if (!conversation) return { ok: false, error: 'NOT_FOUND' }
  const lastUser = conversation.messages[0]
  if (conversation.channel === 'INSTAGRAM' && (!lastUser || Date.now() - lastUser.createdAt.getTime() > INSTAGRAM_WINDOW_MS)) {
    return { ok: false, error: 'WINDOW_CLOSED' }
  }

  const created = await createCardPayment({
    workspaceId: input.workspaceId,
    baseAmount: input.amount,
    source: 'LINK',
    reference: manualLinkReference(false),
    conversationId: conversation.id,
    description: input.description ?? null,
    items: input.items ?? null,
    customerName: cleanContactName(conversation.contact?.name),
    customerPhone: conversation.contact?.phone ?? null,
  })
  if (!created.ok) return { ok: false, error: created.error }

  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: input.workspaceId }, select: { payGatewaySettings: true } })
  const { deliverAssistantNotice, lastCustomerLang } = await import('@/lib/commerce/checkout-service')
  // The card speaks the customer's language, like every other notice.
  const lang = await lastCustomerLang(conversation.id).catch((): 'fa' | 'en' => 'fa')
  const view = cardPayView(created.payment, created.card, readPayGatewaySettings(workspace.payGatewaySettings), lang)
  const note = input.note?.trim()
    || (lang === 'fa'
      ? `درخواست پرداخت${input.description ? ` بابت ${input.description}` : ''} 👇`
      : `Payment request${input.description ? ` for ${input.description}` : ''} 👇`)
  const delivery = await deliverAssistantNotice(
    conversation as { id: string; agentId: string; channel: ChannelType; externalId: string | null },
    `${note}\n${cardPayMarker(view)}`,
    { operator: true, cardPayRequest: true, paymentId: created.payment.id },
  )
  const message = await prisma.message.findFirst({
    where: { conversationId: conversation.id, role: 'ASSISTANT' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, role: true, content: true, createdAt: true, metadata: true },
  })
  return { ok: true, payment: created.payment, url: payPageUrl(created.payment.authority), delivery, message }
}
