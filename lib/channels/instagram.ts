import type { InboundMessage, MessengerAdapter } from '@/lib/channels/types'
import { GRAPH_BASE } from '@/lib/channels/whatsapp'

/**
 * Instagram Messaging adapter (Meta Graph API, Messenger Platform).
 *
 * Like WhatsApp, Instagram DMs flow through Meta's Graph API. A single page
 * access token (linked to the Instagram professional account) is enough to both
 * receive (via webhook) and send messages, so we store just that token. The
 * inbound webhook is configured in the Meta App dashboard, using the channel's
 * webhookToken as the verify token.
 */
export function instagramAdapter(token: string): MessengerAdapter {
  return {
    channel: 'INSTAGRAM',

    parseUpdate(body: unknown): InboundMessage[] {
      const entries = (body as IgWebhook)?.entry
      if (!entries?.length) return []
      const out: InboundMessage[] = []
      for (const entry of entries) {
        for (const m of entry.messaging ?? []) {
          // Ignore echoes of our own outbound messages.
          if (m.message?.is_echo) continue
          const senderId = m.sender?.id
          const text = m.message?.text
          if (!senderId || !text) continue
          out.push({
            chatId: senderId,
            senderId,
            text,
            // Voice/media intentionally unsupported: IG media needs an authed
            // fetch the shared downloader can't perform.
          })
        }
      }
      return out
    },

    async sendText(chatId: string, text: string): Promise<void> {
      if (!token) throw new Error('INSTAGRAM invalid credentials')
      const res = await fetch(`${GRAPH_BASE}/me/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipient: { id: chatId },
          message: { text },
          messaging_type: 'RESPONSE',
        }),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`INSTAGRAM sendText failed (${res.status}): ${detail}`)
      }
    },
  }
}

/** Validate an Instagram page token by reading the linked account username. */
export async function getInstagramInfo(
  token: string,
): Promise<{ username: string } | null> {
  if (!token) return null
  try {
    const res = await fetch(`${GRAPH_BASE}/me?fields=username,name`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const json = (await res.json()) as { username?: string; name?: string }
    const username = json.username || json.name
    return username ? { username } : null
  } catch {
    return null
  }
}

/**
 * Instagram webhooks are registered in the Meta App dashboard, not via API.
 * No-op so the shared create flow can still call it uniformly.
 */
export async function setInstagramWebhook(): Promise<boolean> {
  return true
}

interface IgWebhook {
  entry?: {
    messaging?: {
      sender?: { id?: string }
      recipient?: { id?: string }
      message?: { text?: string; mid?: string; is_echo?: boolean }
    }[]
  }[]
}
