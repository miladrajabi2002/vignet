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
type WaGlobalEntry = {
  id?: string
  changes?: Array<{
    value?: { metadata?: { phone_number_id?: string } }
  }>
}

export async function handleWhatsappGlobalInbound(
  body: unknown,
): Promise<void> {
  const entries = (body as { entry?: WaGlobalEntry[] })?.entry
  if (!entries?.length) return

  // Group the batch PER phone number id. WhatsApp webhook entries are scoped
  // by WABA (entry.id is the WABA id); each change carries the receiving phone
  // number id in its metadata. One batch can mix numbers belonging to
  // DIFFERENT workspaces, so each channel must only ever see its own slice —
  // handing the full body to every matching channel would both leak another
  // tenant's messages into this workspace and (because the adapter parses per
  // change) drop the rest of the batch.
  const byPhoneNumberId = new Map<string, WaGlobalEntry[]>()
  for (const e of entries) {
    for (const c of e.changes ?? []) {
      const pid = c.value?.metadata?.phone_number_id
      if (!pid) continue
      const g = byPhoneNumberId.get(pid)
      const scopedEntry: WaGlobalEntry = { id: e.id, changes: [c] }
      if (g) g.push(scopedEntry)
      else byPhoneNumberId.set(pid, [scopedEntry])
    }
  }
  if (!byPhoneNumberId.size) return

  // Resolve each phone number to its channel and process ONLY that number's
  // changes. Multiple numbers in one batch are handled independently.
  await Promise.all(
    Array.from(byPhoneNumberId.entries()).map(async ([phoneNumberId, scopedEntries]) => {
      try {
        const channel = await prisma.agentChannel.findFirst({
          where: {
            type: 'WHATSAPP',
            active: true,
            config: { path: ['phoneNumberId'], equals: phoneNumberId },
          },
          select: { id: true, config: true },
        })
        if (!channel) {
          captureError(
            'webhook:WHATSAPP:no-channel',
            new Error('No active WhatsApp channel matches the webhook phone-number id'),
            { level: 'warn', metadata: { phoneNumberId } },
          )
          return
        }

        const cfg = channel.config as { webhookToken?: string } | null
        const webhookToken = cfg?.webhookToken
        if (!webhookToken) {
          captureError(
            'webhook:WHATSAPP:missing-webhook-token',
            new Error('Matched WhatsApp channel has no webhook token'),
            { level: 'warn', metadata: { channelId: channel.id, phoneNumberId } },
          )
          return
        }

        // Hand off to the shared inbound pipeline. `handleInbound` resolves the
        // channel by webhookToken → `readBotToken` returns the packed
        // `accessToken|phoneNumberId` string → `whatsappAdapter` parses it →
        // the message is processed exactly like a legacy per-token webhook.
        const scopedBody = {
          ...((body as Record<string, unknown>) ?? {}),
          entry: scopedEntries,
        }
        await handleInbound('WHATSAPP', webhookToken, scopedBody)
      } catch (e) {
        captureError('webhook:WHATSAPP:global', e, {
          metadata: { phoneNumberId },
        })
      }
    }),
  )
}
