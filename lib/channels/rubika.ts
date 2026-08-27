import type { MessengerAdapter, InboundMessage, ProductCard } from '@/lib/channels/types'
import { normalizeMessengerText, splitOutboundText } from '@/lib/channels/text-chunks'
import { createThrottledTextStream } from '@/lib/channels/text-stream'

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
  const TEXT_CHUNK_LIMIT = 4_000

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

  async function sendText(chatId: string, text: string): Promise<void> {
    for (const chunk of splitOutboundText(text, TEXT_CHUNK_LIMIT)) {
      await call('sendMessage', { chat_id: chatId, text: normalizeMessengerText(chunk) })
    }
  }

  function resultMessageId(value: unknown): string | number | undefined {
    if (!value || typeof value !== 'object') return undefined
    const root = value as Record<string, unknown>
    const data = root.data && typeof root.data === 'object'
      ? root.data as Record<string, unknown>
      : undefined
    const result = root.result && typeof root.result === 'object'
      ? root.result as Record<string, unknown>
      : undefined
    const message = root.message && typeof root.message === 'object'
      ? root.message as Record<string, unknown>
      : undefined
    const dataMessage = data?.new_message && typeof data.new_message === 'object'
      ? data.new_message as Record<string, unknown>
      : undefined
    const candidate = root.message_id
      ?? data?.message_id
      ?? dataMessage?.message_id
      ?? result?.message_id
      ?? message?.message_id
    return typeof candidate === 'string' || typeof candidate === 'number' ? candidate : undefined
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

    sendText,

    startTextStream(chatId: string) {
      let messageId: string | number | undefined
      return createThrottledTextStream({
        intervalMs: 1_200,
        prepare: (text) => normalizeMessengerText(text).slice(0, TEXT_CHUNK_LIMIT),
        publish: async (text) => {
          if (messageId === undefined) {
            messageId = resultMessageId(await call('sendMessage', { chat_id: chatId, text }))
            if (messageId === undefined) throw new Error('RUBIKA stream message id missing')
            return
          }
          await call('editMessageText', { chat_id: chatId, message_id: messageId, text })
        },
        finalize: async (text, _opts, state) => {
          if (state.failed || messageId === undefined) {
            await sendText(chatId, text)
            return
          }
          const chunks = splitOutboundText(text, TEXT_CHUNK_LIMIT)
          try {
            await call('editMessageText', {
              chat_id: chatId,
              message_id: messageId,
              text: normalizeMessengerText(chunks[0]),
            })
          } catch {
            await call('deleteMessage', { chat_id: chatId, message_id: messageId }).catch(() => {})
            await sendText(chatId, text)
            return
          }
          for (const chunk of chunks.slice(1)) {
            await call('sendMessage', { chat_id: chatId, text: normalizeMessengerText(chunk) })
          }
        },
        cancel: async () => {
          if (messageId !== undefined) {
            await call('deleteMessage', { chat_id: chatId, message_id: messageId })
          }
        },
        onPreviewError: (error) => {
          console.warn('[RUBIKA] live text preview disabled for this reply:', error instanceof Error ? error.message : error)
        },
      })
    },

    async sendProductCard(chatId: string, card: ProductCard): Promise<void> {
      // Rubika's sendPhoto accepts: chat_id, file (URL), caption, reply_markup
      // Their Markdown support is unreliable, so we use plain text caption.
      const lines: string[] = []
      lines.push(card.name)
      if (card.badge) lines.push(`🏷 ${card.badge}`)
      if (card.price) lines.push(`💰 ${card.price}`)
      if (card.description) {
        lines.push('', card.description.slice(0, 280))
      }
      if (card.specs && card.specs.length) {
        lines.push('', card.specs.slice(0, 5).map((s) => `• ${s.slice(0, 80)}`).join('\n'))
      }
      const caption = lines.join('\n').slice(0, 4096)

      // Build Rubika-style inline keyboard (rows of buttons).
      // Rubika's reply_markup shape: { rows: [ { buttons: [ { text, url, ... } ] } ] }
      const rows: { buttons: { text: string; url?: string }[] }[] = []
      if (card.productUrl) {
        rows.push({
          buttons: [
            { text: card.ctaLabel || '🛒 خرید', url: card.productUrl },
          ],
        })
      }

      // Try sendPhoto if we have an image URL, otherwise fall back to text.
      if (card.imageUrl) {
        try {
          await call('sendPhoto', {
            chat_id: chatId,
            file: card.imageUrl,
            caption,
            ...(rows.length ? { reply_markup: { rows } } : {}),
          })
          return
        } catch (e) {
          console.warn('[RUBIKA] sendProductCard photo fallback:', e instanceof Error ? e.message : e)
        }
      }

      // Text-only fallback: sendMessage with caption + keyboard
      await call('sendMessage', {
        chat_id: chatId,
        text: caption,
        ...(rows.length ? { reply_markup: { rows } } : {}),
      })
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
