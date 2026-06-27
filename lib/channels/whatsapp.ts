import type { InboundMessage, MessengerAdapter } from '@/lib/channels/types'

/**
 * WhatsApp Cloud API (Meta Graph API) adapter.
 *
 * Unlike Telegram/Bale, WhatsApp needs two credentials: a permanent access
 * token and a phone-number id. We pack them into the single stored token as
 * `accessToken|phoneNumberId` so the channel still flows through the shared
 * messenger pipeline. The inbound webhook is configured in the Meta dashboard,
 * using our webhookToken as the verify token.
 */
export const GRAPH_BASE = 'https://graph.facebook.com/v21.0'

interface WaCreds {
  accessToken: string
  phoneNumberId: string
}

export function parseWhatsappToken(token: string): WaCreds | null {
  const [accessToken, phoneNumberId] = token.split('|')
  if (!accessToken || !phoneNumberId) return null
  return { accessToken: accessToken.trim(), phoneNumberId: phoneNumberId.trim() }
}

export function whatsappAdapter(token: string): MessengerAdapter {
  const creds = parseWhatsappToken(token)

  return {
    channel: 'WHATSAPP',

    parseUpdate(body: unknown): InboundMessage[] {
      const value = (body as WaWebhook)?.entry?.[0]?.changes?.[0]?.value
      const messages = value?.messages
      if (!messages?.length) return []
      const profileName = value?.contacts?.[0]?.profile?.name
      const out: InboundMessage[] = []
      for (const m of messages) {
        if (!m.from) continue
        out.push({
          chatId: m.from,
          senderId: m.from,
          senderName: profileName,
          senderPhone: m.from,
          text: m.text?.body ?? m.button?.text ?? '',
          // Voice is intentionally unsupported: WA media needs an authed
          // two-step fetch the shared downloader can't perform.
        })
      }
      return out
    },

    async sendText(chatId: string, text: string): Promise<void> {
      if (!creds) throw new Error('WHATSAPP invalid credentials')
      const res = await fetch(`${GRAPH_BASE}/${creds.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${creds.accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: chatId,
          type: 'text',
          text: { body: text, preview_url: false },
        }),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`WHATSAPP sendText failed (${res.status}): ${detail}`)
      }
    },
  }
}

/** Validate WhatsApp credentials by reading the phone number's display name. */
export async function getWhatsappInfo(
  token: string,
): Promise<{ username: string } | null> {
  const creds = parseWhatsappToken(token)
  if (!creds) return null
  try {
    const res = await fetch(
      `${GRAPH_BASE}/${creds.phoneNumberId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${creds.accessToken}` } },
    )
    if (!res.ok) return null
    const json = (await res.json()) as {
      display_phone_number?: string
      verified_name?: string
    }
    const username = json.verified_name || json.display_phone_number
    return username ? { username } : null
  } catch {
    return null
  }
}

/**
 * WhatsApp webhooks are registered in the Meta App dashboard, not via API.
 * This is a no-op so the shared create flow can still call it uniformly.
 */
export async function setWhatsappWebhook(): Promise<boolean> {
  return true
}

interface WaWebhook {
  entry?: {
    changes?: {
      value?: {
        contacts?: { profile?: { name?: string } }[]
        messages?: {
          from?: string
          text?: { body?: string }
          button?: { text?: string }
          type?: string
        }[]
      }
    }[]
  }[]
}
