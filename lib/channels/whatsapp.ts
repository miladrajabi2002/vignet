import type { InboundMessage, MessengerAdapter, SendOptions } from '@/lib/channels/types'
import {
  bridgeBaseUrl,
  bridgeHeaders,
  parseQrToken,
} from '@/lib/whatsapp/qr-config'
import { splitOutboundText } from '@/lib/channels/text-chunks'

/**
 * WhatsApp adapter — covers THREE connection models through one interface:
 *
 *  1. LEGACY   — the operator pasted `accessToken|phoneNumberId` from the Meta
 *                dashboard. Token format: `accessToken|phoneNumberId`.
 *  2. OAUTH    — platform-managed OAuth (WhatsApp Embedded Signup). Same packed
 *                token format as LEGACY (`accessToken|phoneNumberId`), built by
 *                `buildWhatsappOAuthConfig`. Send goes through the Graph API.
 *  3. QR       — operator scanned a QR (or paired by phone) in the dashboard;
 *                a long-running Baileys bridge (`mini-services/whatsapp-bridge`)
 *                holds the WhatsApp Web session. Token format: `qr:<sessionId>`.
 *                Send is forwarded to the bridge's `/send-text` endpoint.
 *
 * `parseUpdate` is the SAME for all three: the QR bridge reshapes Baileys'
 * events into the Meta Cloud API webhook shape (see `forwardInbound` in
 * `mini-services/whatsapp-bridge/index.ts`), so the existing parsing logic
 * runs unchanged. Only `sendText` branches on the `qr:` prefix.
 */
export const GRAPH_BASE = 'https://graph.facebook.com/v21.0'
const REQUEST_TIMEOUT_MS = 20_000
const NICETY_TIMEOUT_MS = 8_000
const TEXT_CHUNK_LIMIT = 4_000

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
  const qrSessionId = parseQrToken(token)
  const creds = qrSessionId ? null : parseWhatsappToken(token)

  return {
    channel: 'WHATSAPP',

    parseUpdate(body: unknown): InboundMessage[] {
      // Meta batches events: a payload can carry MULTIPLE entries and each
      // entry multiple changes. Iterate them all — reading only
      // entry[0].changes[0] silently drops every other message in the batch.
      const entries = (body as WaWebhook)?.entry
      if (!entries?.length) return []
      const out: InboundMessage[] = []
      for (const e of entries) {
        for (const c of e.changes ?? []) {
          const value = c.value
          const messages = value?.messages
          if (!messages?.length) continue
          const profileName = value?.contacts?.[0]?.profile?.name
          for (const m of messages) {
            if (!m.from) continue
            out.push({
              chatId: m.from,
              senderId: m.from,
              senderName: profileName,
              senderPhone: m.from,
              // wamid — globally unique; drives the shared idempotency claim.
              platformMessageId: m.id,
              // Plain text, template button tap, or interactive reply-button tap.
              text:
                m.text?.body ??
                m.button?.text ??
                m.interactive?.button_reply?.title ??
                '',
              // Voice is intentionally unsupported: WA media needs an authed
              // two-step fetch the shared downloader can't perform.
            })
          }
        }
      }
      return out
    },

    async sendTyping(chatId: string): Promise<void> {
      // QR mode: ask the bridge to show a "typing…" presence. Best-effort —
      // failures are swallowed so they never block the actual reply.
      if (!qrSessionId) return
      try {
        await fetch(
          `${bridgeBaseUrl()}/typing?sessionId=${encodeURIComponent(qrSessionId)}&jid=${encodeURIComponent(chatId)}`,
          {
            method: 'POST',
            headers: bridgeHeaders(),
            signal: AbortSignal.timeout(NICETY_TIMEOUT_MS),
          },
        )
      } catch {
        /* ignore — typing is best-effort */
      }
    },

    async sendText(chatId: string, text: string, opts?: SendOptions): Promise<void> {
      // ── QR mode: forward the send to the Baileys bridge ──────────────────
      // The bridge holds the WhatsApp Web socket and sends the message via
      // `sock.sendMessage(jid, { text })`. Quick-reply buttons are NOT
      // supported in this mode (the WhatsApp Web protocol's list messages are
      // clunky and have stricter limits than the Cloud API's interactive
      // buttons); we send plain text only. The text body itself may carry the
      // suggestions inline if the operator wants them visible.
      if (qrSessionId) {
        // If quick replies are configured, append them as a simple numbered
        // list at the end of the message body — visible to the customer as
        // plain text, and tapping reply sends the number/text back as a normal
        // message which the AI can interpret.
        const chunks = splitOutboundText(text, TEXT_CHUNK_LIMIT)
        const buttons = (opts?.quickReplies ?? []).slice(0, 3)
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
          let body = chunks[chunkIndex]
          if (chunkIndex === chunks.length - 1 && buttons.length && body.length + 200 < 4096) {
            body += '\n\n' + buttons.map((q, i) => `${i + 1}. ${q.slice(0, 40)}`).join('\n')
          }
          const res = await fetch(`${bridgeBaseUrl()}/send-text`, {
            method: 'POST',
            headers: bridgeHeaders(),
            body: JSON.stringify({ sessionId: qrSessionId, jid: chatId, text: body }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          })
          if (!res.ok) {
            const detail = await res.text().catch(() => '')
            throw new Error(`WHATSAPP(QR) sendText failed (${res.status}): ${detail}`)
          }
        }
        return
      }

      // ── LEGACY / OAUTH mode: Graph API as before ─────────────────────────
      if (!creds) throw new Error('WHATSAPP invalid credentials')

      async function post(payload: Record<string, unknown>): Promise<Response> {
        return fetch(`${GRAPH_BASE}/${creds!.phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${creds!.accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: chatId,
            ...payload,
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
      }

      // Quick replies → interactive reply buttons (Cloud API limits: max 3
      // buttons, titles ≤20 chars, body ≤1024 chars). Falls back to plain text
      // on any rejection so the reply is never lost.
      const buttons = (opts?.quickReplies ?? []).slice(0, 3)
      const chunks = splitOutboundText(text, TEXT_CHUNK_LIMIT)
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex]
        const isLast = chunkIndex === chunks.length - 1
        if (isLast && buttons.length && chunk.length <= 1024) {
          const interactive = await post({
            type: 'interactive',
            interactive: {
              type: 'button',
              body: { text: chunk },
              action: {
                buttons: buttons.map((q, i) => ({
                  type: 'reply',
                  reply: { id: `qr_${i}`, title: q.slice(0, 20) },
                })),
              },
            },
          })
          if (interactive.ok) continue
          console.error(
            '[whatsapp] interactive send rejected, falling back to text:',
            await interactive.text().catch(() => ''),
          )
        }

        const res = await post({
          type: 'text',
          text: { body: chunk, preview_url: false },
        })
        if (!res.ok) {
          const detail = await res.text().catch(() => '')
          throw new Error(`WHATSAPP sendText failed (${res.status}): ${detail}`)
        }
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
      {
        headers: { Authorization: `Bearer ${creds.accessToken}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
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
          id?: string
          from?: string
          text?: { body?: string }
          button?: { text?: string }
          interactive?: { button_reply?: { id?: string; title?: string } }
          type?: string
        }[]
      }
    }[]
  }[]
}
