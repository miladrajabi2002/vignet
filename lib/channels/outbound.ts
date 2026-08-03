import type { ChannelType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { readBotToken } from '@/lib/channels/config'
import { readPageToken } from '@/lib/instagram/config'
import { getAdapter, isMessengerType } from '@/lib/channels/registry'
import { normalizeIranianMobile } from '@/lib/phone'

/**
 * Push a plain-text message to a contact on a messenger channel — used for
 * operator (human handoff) replies that originate in the dashboard rather than
 * from the AI pipeline.
 *
 * Returns true when delivered to the platform. Web-widget / chat-link / API
 * channels can't be pushed to (they're request/response), so those return false
 * and the caller persists the message in the thread only — the visitor sees it
 * on their next page refresh.
 *
 * Instagram token note: OAuth channels (Instagram Login) store the access token
 * under `userTokenEnc` (read via `readPageToken`), NOT `botTokenEnc`. Using
 * `readBotToken` here would silently return null for OAuth channels and the
 * operator's reply would never reach Instagram — so we branch on the channel.
 */
export type OutboundDeliveryStatus = 'sent' | 'unavailable' | 'failed'
export type OutboundDeliveryReason =
  | 'not_push_channel'
  | 'missing_thread'
  | 'channel_inactive'
  | 'credentials_missing'
  | 'provider_error'

export type OutboundDeliveryResult = {
  status: OutboundDeliveryStatus
  reason?: OutboundDeliveryReason
  cause?: unknown
}

/** Prefer the CRM mobile for WhatsApp conversations created with an old LID. */
export function resolveConversationRecipient(
  channel: ChannelType,
  externalId: string | null,
  contactPhone: string | null | undefined,
): string | null {
  if (channel !== 'WHATSAPP') return externalId
  return normalizeIranianMobile(contactPhone) ?? externalId
}

export function channelHasOutboundCredentials(
  channel: ChannelType,
  config: Prisma.JsonValue,
): boolean {
  if (!isMessengerType(channel)) return false
  return Boolean(channel === 'INSTAGRAM' ? readPageToken(config) : readBotToken(config))
}

export async function sendOutbound(
  agentId: string,
  channel: ChannelType,
  externalId: string | null,
  text: string,
): Promise<OutboundDeliveryResult> {
  if (!isMessengerType(channel)) return { status: 'unavailable', reason: 'not_push_channel' }
  if (!externalId) return { status: 'unavailable', reason: 'missing_thread' }

  const ch = await prisma.agentChannel.findFirst({
    where: { agentId, type: channel, active: true },
    select: { config: true },
  })
  if (!ch) return { status: 'unavailable', reason: 'channel_inactive' }

  // Instagram OAuth stores the token under userTokenEnc/pageTokenEnc; legacy
  // Instagram + other messengers store it under botTokenEnc. readPageToken
  // handles all three Instagram flavors, so it's the safe choice for IG.
  const token =
    channel === 'INSTAGRAM' ? readPageToken(ch.config) : readBotToken(ch.config)
  if (!token) return { status: 'unavailable', reason: 'credentials_missing' }

  try {
    await getAdapter(channel, token).sendText(externalId, text)
    return { status: 'sent' }
  } catch (cause) {
    return { status: 'failed', reason: 'provider_error', cause }
  }
}
