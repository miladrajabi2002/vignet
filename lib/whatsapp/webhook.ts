import { prisma } from '@/lib/prisma'
import { handleInbound } from '@/lib/channels/handler'
import { captureError } from '@/lib/errors/capture'

/**
 * WhatsApp global-webhook demultiplexer.
 *
 * Because vigent owns ONE Meta App, ALL WhatsApp Cloud API events for every
 * connected phone number arrive at the single global webhook
 * (`/api/webhook/whatsapp`). Each webhook payload carries the phone number id
 * that received the message in
 * `entry[0].changes[0].value.metadata.phone_number_id` — that's the routing
 * key. We resolve the channel whose `config.phoneNumberId` matches, then hand
 * the body off to the shared `handleInbound('WHATSAPP', webhookToken, body)`
 * pipeline.
 *
 * This reuses 100% of the existing inbound pipeline (resolveChannel → adapter
 * → AI → outbound) without touching `lib/channels/handler.ts`. The only
 * requirement is that `buildWhatsappOAuthConfig` populates BOTH:
 *   - `phoneNumberId`  (so we can demux here)
 *   - `webhookToken`   (so `handleInbound` can resolve the channel via
 *                       `resolveChannel`'s `config.webhookToken` lookup)
 *   - `botTokenEnc`    (the packed `accessToken|phoneNumberId` string, so
 *                       `readBotToken` returns what the whatsappAdapter
 *                       expects)
 *
 * All three are set by `buildWhatsappOAuthConfig`, so this works out of the
 * box for any OAuth-connected WhatsApp channel.
 */
export async function handleWhatsappGlobalInbound(
  body: unknown,
): Promise<void> {
  const entries = (
    body as {
      entry?: Array<{
        id?: string
        changes?: Array<{
          value?: { metadata?: { phone_number_id?: string } }
        }>
      }>
    }
  )?.entry
  if (!entries?.length) return

  // Collect the distinct phone number ids mentioned in this batch. WhatsApp
  // webhook entries are scoped by WABA (entry.id is the WABA id); each change
  // carries the actual receiving phone number id in its metadata. Multiple
  // messages from the same number land in one entry under value.messages[].
  const phoneNumberIds = new Set<string>()
  for (const e of entries) {
    for (const c of e.changes ?? []) {
      const pid = c.value?.metadata?.phone_number_id
      if (pid) phoneNumberIds.add(pid)
    }
  }
  if (!phoneNumberIds.size) return

  // Resolve each phone number to its channel and process. Multiple numbers in
  // one batch (rare) are handled independently.
  await Promise.all(
    Array.from(phoneNumberIds).map(async (phoneNumberId) => {
      try {
        const channel = await prisma.agentChannel.findFirst({
          where: {
            type: 'WHATSAPP',
            active: true,
            config: { path: ['phoneNumberId'], equals: phoneNumberId },
          },
          select: { id: true, config: true },
        })
        if (!channel) return

        const cfg = channel.config as { webhookToken?: string } | null
        const webhookToken = cfg?.webhookToken
        if (!webhookToken) return

        // Hand off to the shared inbound pipeline. `handleInbound` resolves the
        // channel by webhookToken → `readBotToken` returns the packed
        // `accessToken|phoneNumberId` string → `whatsappAdapter` parses it →
        // the message is processed exactly like a legacy per-token webhook.
        await handleInbound('WHATSAPP', webhookToken, body)
      } catch (e) {
        captureError('webhook:WHATSAPP:global', e, {
          metadata: { phoneNumberId },
        })
      }
    }),
  )
}
