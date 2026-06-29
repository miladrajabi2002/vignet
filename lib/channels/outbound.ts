import type { ChannelType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { readBotToken } from '@/lib/channels/config'
import { getAdapter, isMessengerType } from '@/lib/channels/registry'

/**
 * Push a plain-text message to a contact on a messenger channel — used for
 * operator (human handoff) replies that originate in the dashboard rather than
 * from the AI pipeline.
 *
 * Returns true when delivered. Web-widget / API channels can't be pushed to
 * (they're request/response), so those return false and the message is only
 * persisted in the thread.
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

  const token = readBotToken(ch.config)
  if (!token) return false

  await getAdapter(channel, token).sendText(externalId, text)
  return true
}
