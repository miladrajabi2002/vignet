import type { MessengerAdapter, InboundMessage } from '@/lib/channels/types'

/**
 * Rubika Bot API adapter.
 *
 * NOTE: Rubika's bot API is less stable and less documented than Telegram's.
 * This adapter is intentionally defensive — it parses several plausible update
 * shapes and is the ONLY module that knows Rubika's wire format. The core
 * pipeline only sees the normalized {@link InboundMessage}. If Rubika changes
 * its API, this is the single file to update.
 *
 * Base: https://botapi.rubika.ir/v3/{token}/<method>
 */
export const RUBIKA_BASE = 'https://botapi.rubika.ir/v3'

export function rubikaAdapter(token: string): MessengerAdapter {
  const api = `${RUBIKA_BASE}/${token}`

  async function call(method: string, payload: unknown): Promise<unknown> {
    const res = await fetch(`${api}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(`RUBIKA ${method} failed (${res.status})`)
    }
    return json
  }

  return {
    channel: 'RUBIKA',

    parseUpdate(body: unknown): InboundMessage[] {
      // Rubika may deliver { update: {...} } or { inline_message: {...} }.
      const root = body as RubikaBody
      const u = (root?.update ?? root?.inline_message ?? root) as RubikaInner
      if (!u) return []
      const chatId =
        u.chat_id ?? u.object_guid ?? u.new_message?.chat_id ?? root?.chat_id ?? null
      const msg = u.new_message ?? u.message ?? u
      if (!chatId || !msg) return []
      const text: string = msg.text ?? ''
      const voiceFileId = msg.file?.file_id ?? msg.voice?.file_id
      if (!text && !voiceFileId) return []
      return [
        {
          chatId: String(chatId),
          senderId: String(msg.sender_id ?? chatId),
          senderName: msg.sender_name || undefined,
          senderPhone: msg.sender_phone || undefined,
          text,
          voiceFileId,
        },
      ]
    },

    async sendText(chatId: string, text: string): Promise<void> {
      await call('sendMessage', { chat_id: chatId, text })
    },
  }
}

/** Register the receive-update endpoint for a Rubika bot. */
export async function setRubikaWebhook(
  token: string,
  url: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${RUBIKA_BASE}/${token}/updateBotEndpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, type: 'ReceiveUpdate' }),
    })
    return res.ok
  } catch (e) {
    console.error('[rubika] updateBotEndpoints failed:', e)
    return false
  }
}

/** Best-effort token verification via getMe. */
export async function getRubikaBotInfo(
  token: string,
): Promise<{ username: string } | null> {
  try {
    const res = await fetch(`${RUBIKA_BASE}/${token}/getMe`, { method: 'POST' })
    if (!res.ok) return null
    const json = (await res.json().catch(() => ({}))) as {
      bot?: { username?: string; bot_title?: string }
    }
    const username = json.bot?.username ?? json.bot?.bot_title ?? 'rubika-bot'
    return { username }
  } catch {
    return null
  }
}

interface RubikaInner {
  chat_id?: string | number
  object_guid?: string | number
  sender_id?: string | number
  sender_name?: string
  sender_phone?: string
  text?: string
  file?: { file_id?: string }
  voice?: { file_id?: string }
  new_message?: RubikaInner
  message?: RubikaInner
}

interface RubikaBody {
  update?: RubikaInner
  inline_message?: RubikaInner
  chat_id?: string | number
}
