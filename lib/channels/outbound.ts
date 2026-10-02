import type { ChannelType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { readBotToken } from '@/lib/channels/config'
import { readPageToken } from '@/lib/instagram/config'
import { sendProductCarousel } from '@/lib/instagram/media'
import { getAdapter, isMessengerType, type MessengerType } from '@/lib/channels/registry'
import {
  classifyProviderFailure,
  isInstagramCommentThread,
  type ProviderFailureReason,
} from '@/lib/channels/delivery-errors'
import {
  formatProductFallback,
  messengerProductCard,
  type ReplyLanguage,
  type TrustedProductShowcase,
} from '@/lib/products/presentation'

/**
 * Push a plain-text message to a contact on a messenger channel — used for
 * operator (human handoff) replies that originate in the dashboard rather than
 * from the AI pipeline.
 *
 * Messenger channels are `sent` only after their provider adapter resolves.
 * Web-widget / chat-link / API conversations use the persisted conversation
 * history as their transport, so they return `stored` instead of being
 * mislabeled as unavailable. Their clients pick the message up through the
 * shared history/polling endpoint.
 *
 * Instagram token note: OAuth channels (Instagram Login) store the access token
 * under `userTokenEnc` (read via `readPageToken`), NOT `botTokenEnc`. Using
 * `readBotToken` here would silently return null for OAuth channels and the
 * operator's reply would never reach Instagram — so we branch on the channel.
 */
export type OutboundDeliveryStatus = 'sent' | 'stored' | 'unavailable' | 'failed'
export type OutboundDeliveryReason =
  | 'history_delivery'
  | 'missing_thread'
  | 'channel_inactive'
  | 'credentials_missing'
  | 'channel_retired'
  | 'products_need_dm'
  | ProviderFailureReason

export type OutboundDeliveryResult = {
  status: OutboundDeliveryStatus
  reason?: OutboundDeliveryReason
  cause?: unknown
}

/** Resolve the provider-native conversation recipient. */
export function resolveConversationRecipient(
  externalId: string | null,
): string | null {
  return externalId
}

type MessengerTarget =
  | { ok: false; result: OutboundDeliveryResult }
  | { ok: true; channel: MessengerType; recipient: string; token: string; config: Prisma.JsonValue }

/** Resolve the live provider target, or the honest outcome when there is none. */
async function resolveMessengerTarget(
  agentId: string,
  channel: ChannelType,
  externalId: string | null,
): Promise<MessengerTarget> {
  // Historical WhatsApp conversations remain readable, but the retired
  // integration must never pretend that an operator reply was delivered.
  if (channel === 'WHATSAPP') return { ok: false, result: { status: 'unavailable', reason: 'channel_retired' } }
  if (!isMessengerType(channel)) return { ok: false, result: { status: 'stored', reason: 'history_delivery' } }
  if (!externalId) return { ok: false, result: { status: 'unavailable', reason: 'missing_thread' } }

  const ch = await prisma.agentChannel.findFirst({
    where: { agentId, type: channel, active: true },
    select: { config: true },
  })
  if (!ch) return { ok: false, result: { status: 'unavailable', reason: 'channel_inactive' } }

  // Instagram OAuth stores the token under userTokenEnc/pageTokenEnc; legacy
  // Instagram + other messengers store it under botTokenEnc. readPageToken
  // handles all three Instagram flavors, so it's the safe choice for IG.
  const token =
    channel === 'INSTAGRAM' ? readPageToken(ch.config) : readBotToken(ch.config)
  if (!token) return { ok: false, result: { status: 'unavailable', reason: 'credentials_missing' } }
  return { ok: true, channel, recipient: externalId, token, config: ch.config }
}

export async function sendOutbound(
  agentId: string,
  channel: ChannelType,
  externalId: string | null,
  text: string,
): Promise<OutboundDeliveryResult> {
  const target = await resolveMessengerTarget(agentId, channel, externalId)
  if (!target.ok) return target.result

  try {
    await getAdapter(target.channel, target.token).sendText(target.recipient, text)
    return { status: 'sent' }
  } catch (cause) {
    return { status: 'failed', reason: classifyProviderFailure(cause), cause }
  }
}

/**
 * Push an operator's product selection (with optional text) in the richest
 * format each channel supports:
 *
 * - Instagram: the text, then ONE generic-template carousel the customer
 *   swipes through (photo, name, price, «مشاهده محصول» button per card).
 * - Telegram / Bale / Rubika: the text, then one photo card per product with
 *   its caption (name, price, stock, specs) and an inline buy button.
 * - Web widget / chat link / API: nothing to push; the caller persists the
 *   `[[product:…]]` snapshots and those clients render a product rail.
 *
 * A card that cannot be delivered never silently disappears: the Instagram
 * carousel and any failed Telegram-like card degrade to a numbered text list
 * with the same name, price, specs and link. The result is `sent` once the
 * customer has every product in some form; `failed` only when nothing at all
 * reached them.
 */
export async function sendOutboundProducts(params: {
  agentId: string
  channel: ChannelType
  externalId: string | null
  text: string
  products: TrustedProductShowcase[]
  lang: ReplyLanguage
}): Promise<OutboundDeliveryResult> {
  const target = await resolveMessengerTarget(params.agentId, params.channel, params.externalId)
  if (!target.ok) return target.result
  // A comment thread is a public reply: Meta has no carousel there, and a
  // numbered list would be cut to one comment. Refuse before sending anything
  // so the operator is not left with half a delivery.
  if (target.channel === 'INSTAGRAM' && isInstagramCommentThread(target.recipient) && params.products.length > 0) {
    return { status: 'unavailable', reason: 'products_need_dm' }
  }

  const adapter = getAdapter(target.channel, target.token)
  const text = params.text.trim()
  const products = params.products
  let delivered = false
  let lastError: unknown = null

  try {
    if (text) {
      await adapter.sendText(target.recipient, text)
      delivered = true
    }

    if (products.length > 0) {
      let fallbackProducts: TrustedProductShowcase[] = []
      if (target.channel === 'INSTAGRAM') {
        try {
          await sendProductCarousel(target.config, target.recipient, products)
          delivered = true
        } catch (cause) {
          lastError = cause
          fallbackProducts = products
        }
      } else if (adapter.sendProductCard) {
        for (const product of products) {
          try {
            await adapter.sendProductCard(target.recipient, messengerProductCard(product, params.lang))
            delivered = true
          } catch (cause) {
            lastError = cause
            fallbackProducts.push(product)
          }
        }
      } else {
        fallbackProducts = products
      }

      const fallback = formatProductFallback(fallbackProducts, params.lang)
      if (fallback) {
        await adapter.sendText(target.recipient, fallback)
        delivered = true
      }
    }
  } catch (cause) {
    return delivered
      ? { status: 'sent', cause }
      : { status: 'failed', reason: classifyProviderFailure(cause), cause }
  }

  if (!delivered) return { status: 'failed', reason: classifyProviderFailure(lastError), cause: lastError }
  return { status: 'sent' }
}
