import type { ChannelType } from '@prisma/client'
import type {
  InboundMessage,
  MessengerAdapter,
  OutboundVoice,
  ProductCard,
  SendOptions,
} from '@/lib/channels/types'
import { splitOutboundText } from '@/lib/channels/text-chunks'

class BotApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'BotApiError'
  }
}

/** Convert the small Markdown subset our agents use into Telegram-safe HTML. */
export function telegramMarkdownToHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/__([^_\n]+)__/g, '<b>$1</b>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).،؛!?])/gm, '$1<i>$2</i>')
}

/**
 * Telegram and Bale share (nearly) the same Bot API. This factory builds an
 * adapter for either by making the base URL configurable. ~80% reuse.
 */
export function createTelegramLikeAdapter(opts: {
  channel: ChannelType
  baseUrl: string // e.g. https://api.telegram.org
  token: string
}): MessengerAdapter {
  const { channel, baseUrl, token } = opts
  const api = `${baseUrl}/bot${token}`

  // Node's fetch has no overall request timeout: a hung connection to the Bot
  // API would hold a BullMQ worker slot open indefinitely. Abort instead and
  // let the caller's normal failure path (retry/backoff) take over.
  const CALL_TIMEOUT_MS = 20_000
  const NICETY_TIMEOUT_MS = 10_000 // typing indicator, avatars — best-effort
  const UPLOAD_TIMEOUT_MS = 30_000 // voice uploads carry a real payload
  const TEXT_CHUNK_LIMIT = 4_000 // platform cap is 4096; leave markup headroom

  async function call(
    method: string,
    payload: unknown,
    timeoutMs = CALL_TIMEOUT_MS,
  ): Promise<unknown> {
    const res = await fetch(`${api}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || (json as { ok?: boolean }).ok === false) {
      throw new BotApiError(
        res.status,
        `${channel} ${method} failed (${res.status}): ${JSON.stringify(json)}`,
      )
    }
    return (json as { result?: unknown }).result
  }

  return {
    channel,

    parseUpdate(body: unknown): InboundMessage[] {
      const msg = (body as { message?: TgMessage })?.message
      if (!msg?.chat?.id) return []
      const from = msg.from
      const name = from
        ? [from.first_name, from.last_name].filter(Boolean).join(' ') ||
          from.username
        : undefined
      return [
        {
          chatId: String(msg.chat.id),
          senderId: String(from?.id ?? msg.chat.id),
          senderName: name || undefined,
          // The @handle is kept separately from the display name so the CRM can
          // show both (e.g. "میلاد رجبی @miladrajabi"). Previously the handle
          // was dropped whenever first/last names were present.
          senderUsername: from?.username || undefined,
          text: msg.text ?? msg.caption ?? '',
          // message_id is only unique per chat — scope it so the shared
          // idempotency claim can't collide across chats.
          platformMessageId:
            msg.message_id !== undefined
              ? `${msg.chat.id}:${msg.message_id}`
              : undefined,
          voiceFileId: msg.voice?.file_id ?? msg.audio?.file_id,
          // Telegram reply_to_message → quote link (best-effort, stringified id).
          replyToMessageId: msg.reply_to_message?.message_id
            ? String(msg.reply_to_message.message_id)
            : undefined,
        },
      ]
    },

    async sendText(chatId: string, text: string, opts?: SendOptions): Promise<void> {
      const chunks = splitOutboundText(text, TEXT_CHUNK_LIMIT)
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex]
        const payload: Record<string, unknown> = {
          chat_id: chatId,
          text: channel === 'TELEGRAM' ? telegramMarkdownToHtml(chunk) : chunk,
        }
        if (channel === 'TELEGRAM') payload.parse_mode = 'HTML'
        // Quick replies belong only to the final part, after the full answer.
        if (chunkIndex === chunks.length - 1 && opts?.quickReplies?.length) {
          const rows: { text: string }[][] = []
          for (let i = 0; i < opts.quickReplies.length; i += 2) {
            rows.push(opts.quickReplies.slice(i, i + 2).map((q) => ({ text: q })))
          }
          payload.reply_markup = {
            keyboard: rows,
            resize_keyboard: true,
            one_time_keyboard: true,
          }
        }
        try {
          await call('sendMessage', payload)
        } catch (error) {
          // Telegram rejects malformed HTML with a deterministic 400 before
          // accepting the message, so a plain-text fallback is safe there.
          // Never retry an ambiguous timeout/network/5xx failure here: the API
          // may already have delivered it, and retrying would duplicate text.
          if (
            channel !== 'TELEGRAM' ||
            !(error instanceof BotApiError) ||
            error.status !== 400
          ) {
            throw error
          }
          const fallback: Record<string, unknown> = { ...payload, text: chunk }
          delete fallback.parse_mode
          await call('sendMessage', fallback)
        }
      }
    },

    async sendTyping(chatId: string, signal?: AbortSignal): Promise<void> {
      // Shows "typing…" for ~5s in the client. Best-effort.
      const res = await fetch(`${api}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(NICETY_TIMEOUT_MS)])
          : AbortSignal.timeout(NICETY_TIMEOUT_MS),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || (json as { ok?: boolean }).ok === false) {
        throw new BotApiError(
          res.status,
          `${channel} sendChatAction failed (${res.status}): ${JSON.stringify(json)}`,
        )
      }
    },

    async sendVoice(chatId: string, voice: OutboundVoice): Promise<void> {
      const form = new FormData()
      form.append('chat_id', chatId)
      const isVoiceNote = voice.mime === 'audio/ogg' || voice.mime === 'audio/opus'
      const field = isVoiceNote ? 'voice' : 'audio'
      form.append(
        field,
        new Blob([new Uint8Array(voice.audio)], { type: voice.mime }),
        isVoiceNote ? 'reply.ogg' : 'reply.mp3',
      )
      const method = isVoiceNote ? 'sendVoice' : 'sendAudio'
      const res = await fetch(`${api}/${method}`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      })
      if (!res.ok) {
        // Fall back to nothing — caller will have already sent text.
        console.error(`[${channel}] sendVoice failed:`, res.status)
      }
    },

    async sendProductCard(chatId: string, card: ProductCard): Promise<void> {
      // Build the HTML caption: bold name, price on its own line, then
      // optional description + spec rows. Telegram captions are limited to
      // 1024 chars for photos and 4096 for plain text — we truncate to fit.
      const lines: string[] = []
      // Bold name (escape + bold)
      lines.push(`<b>${escapeHtml(card.name)}</b>`)
      if (card.badge) lines.push(`🏷 ${escapeHtml(card.badge)}`)
      if (card.price) lines.push(`💰 ${escapeHtml(card.price)}`)
      if (card.description) {
        const desc = truncate(card.description, 280)
        lines.push('', escapeHtml(desc))
      }
      if (card.specs && card.specs.length) {
        lines.push('', card.specs.slice(0, 5).map((s) => `• ${escapeHtml(truncate(s, 80))}`).join('\n'))
      }
      const caption = lines.join('\n').slice(0, 1024)

      // Build the inline keyboard: a single URL button for the product page.
      // Telegram inline keyboards use url buttons (open in browser).
      const inlineKeyboard: { text: string; url: string }[] = []
      if (card.productUrl) {
        inlineKeyboard.push({
          text: card.ctaLabel || '🛒 خرید',
          url: card.productUrl,
        })
      }

      // Try sendPhoto first; if it fails (image unreachable, 400, etc.),
      // fall back to sendMessage (text-only) with the same caption + button.
      const usePhoto = !!card.imageUrl
      try {
        if (!usePhoto) throw new Error('no image url')
        const form = new FormData()
        form.append('chat_id', chatId)
        form.append('photo', card.imageUrl!)
        if (channel === 'TELEGRAM') {
          form.append('parse_mode', 'HTML')
          form.append('caption', caption)
        } else {
          // Bale doesn't accept parse_mode HTML reliably for sendPhoto —
          // send caption as plain text to avoid 400 on malformed markup.
          form.append('caption', stripHtml(caption))
        }
        if (inlineKeyboard.length) {
          form.append('reply_markup', JSON.stringify({
            inline_keyboard: [inlineKeyboard],
          }))
        }
        const res = await fetch(`${api}/sendPhoto`, {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || (json as { ok?: boolean }).ok === false) {
          throw new BotApiError(res.status, `sendPhoto failed: ${JSON.stringify(json)}`)
        }
        return
      } catch (photoError) {
        // Image failed (no URL, unreachable, 400). Fall through to text mode.
        if (!(photoError instanceof BotApiError) || photoError.status !== 400) {
          // Don't log network timeouts as errors — the fallback will succeed
          console.warn(`[${channel}] sendProductCard photo fallback:`, photoError instanceof Error ? photoError.message : photoError)
        }
      }

      // Text-only fallback: sendMessage with caption + inline keyboard
      const textPayload: Record<string, unknown> = {
        chat_id: chatId,
        text: channel === 'TELEGRAM' ? caption : stripHtml(caption),
      }
      if (channel === 'TELEGRAM') textPayload.parse_mode = 'HTML'
      if (inlineKeyboard.length) {
        textPayload.reply_markup = JSON.stringify({
          inline_keyboard: [inlineKeyboard],
        })
      }
      try {
        await call('sendMessage', textPayload)
      } catch (err) {
        // Last-resort: strip HTML and retry
        if (channel !== 'TELEGRAM' || !(err instanceof BotApiError) || err.status !== 400) {
          throw err
        }
        const fallback: Record<string, unknown> = { ...textPayload, text: stripHtml(caption) }
        delete fallback.parse_mode
        await call('sendMessage', fallback)
      }
    },

    async getVoiceUrl(fileId: string): Promise<string | null> {
      try {
        const result = (await call('getFile', { file_id: fileId })) as {
          file_path?: string
        }
        if (!result?.file_path) return null
        return `${baseUrl}/file/bot${token}/${result.file_path}`
      } catch (e) {
        console.error(`[${channel}] getFile failed:`, e)
        return null
      }
    },

    async getAvatarUrl(userId: string): Promise<string | null> {
      // getUserProfilePhotos → pick the largest size → getFile → public URL.
      // Best-effort: returns null when the user has no photo or the API refuses
      // (e.g. privacy settings). Never throws — avatar is a nice-to-have.
      try {
        const result = (await call(
          'getUserProfilePhotos',
          { user_id: userId, limit: 1 },
          NICETY_TIMEOUT_MS,
        )) as { photos?: { file_id: string }[][] } | null
        const photo = result?.photos?.[0]?.slice(-1)?.[0]
        if (!photo?.file_id) return null
        return await this.getVoiceUrl!(photo.file_id)
      } catch (e) {
        console.error(`[${channel}] getAvatarUrl failed:`, e)
        return null
      }
    },
  }
}

interface TgUser {
  id: number | string
  first_name?: string
  last_name?: string
  username?: string
}

interface TgMessage {
  message_id?: number | string
  chat: { id: number | string }
  from?: TgUser
  text?: string
  caption?: string
  voice?: { file_id: string }
  audio?: { file_id: string }
  reply_to_message?: { message_id: number | string }
}

/** Escape HTML special characters for safe Telegram caption rendering. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Truncate a string to a max length, with an ellipsis when truncated. */
function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return value.slice(0, max - 1).trimEnd() + '…'
}

/** Strip HTML tags (used as a fallback when HTML parse_mode is rejected). */
function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}
