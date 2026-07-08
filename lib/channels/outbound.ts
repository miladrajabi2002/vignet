import type { ChannelType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { readBotToken } from '@/lib/channels/config'
import { readPageToken } from '@/lib/instagram/config'
import { getAdapter, isMessengerType } from '@/lib/channels/registry'

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
export async function sendOutbound(
  agentId: string,
  channel: ChannelType,
  externalId: string | null,
  text: string,
): Promise<boolean> {
  if (!externalId || !isMessengerType(channel)) return false

  const ch = await prisma.agentChannel.findFirst({
    where: { agentId, type: channel, active: true },
    select: { config: true },
  })
  if (!ch) return false

  // Instagram OAuth stores the token under userTokenEnc/pageTokenEnc; legacy
  // Instagram + other messengers store it under botTokenEnc. readPageToken
  // handles all three Instagram flavors, so it's the safe choice for IG.
  const token =
    channel === 'INSTAGRAM' ? readPageToken(ch.config) : readBotToken(ch.config)
  if (!token) return false

  await getAdapter(channel, token).sendText(externalId, text)
  return true
}
