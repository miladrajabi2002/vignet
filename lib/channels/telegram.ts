import type { MessengerAdapter } from '@/lib/channels/types'
import { createTelegramLikeAdapter } from '@/lib/channels/telegram-like'

export const TELEGRAM_BASE = 'https://api.telegram.org'

export interface TelegramWebhookInfo {
  url: string
  pendingUpdateCount: number
  maxConnections: number | null
  lastErrorDate: number | null
  lastErrorMessage: string | null
}

export function telegramAdapter(token: string): MessengerAdapter {
  return createTelegramLikeAdapter({
    channel: 'TELEGRAM',
    baseUrl: TELEGRAM_BASE,
    token,
  })
}

/** Register the webhook for a Telegram bot. Returns true on success. */
export async function setTelegramWebhook(
  token: string,
  url: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${TELEGRAM_BASE}/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, allowed_updates: ['message', 'callback_query'] }),
    })
    const json = await res.json().catch(() => ({}))
    return res.ok && (json as { ok?: boolean }).ok !== false
  } catch (e) {
    console.error('[telegram] setWebhook failed:', e)
    return false
  }
}

/** Register the management commands shown in Telegram's bot command menu. */
export async function setTelegramBotCommands(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${TELEGRAM_BASE}/bot${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language_code: 'fa',
        commands: [
          { command: 'menu', description: 'مرکز مدیریت' },
          { command: 'chats', description: 'گفتگوهای منتظر اپراتور' },
          { command: 'stats', description: 'گزارش ۲۴ ساعت اخیر' },
          { command: 'health', description: 'بررسی سلامت اتصال' },
          { command: 'help', description: 'راهنمای بات اپراتور' },
        ],
      }),
      signal: AbortSignal.timeout(8_000),
    })
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean }
    return res.ok && json.ok !== false
  } catch {
    return false
  }
}

/** Verify a bot token and return the bot username (getMe). */
export async function getTelegramBotInfo(
  token: string,
): Promise<{ username: string } | null> {
  try {
    const res = await fetch(`${TELEGRAM_BASE}/bot${token}/getMe`)
    const json = await res.json().catch(() => ({}))
    const username = (json as { result?: { username?: string } }).result?.username
    return res.ok && username ? { username } : null
  } catch {
    return null
  }
}

/** Read Telegram's live webhook health without exposing the webhook URL/token. */
export async function getTelegramWebhookInfo(
  token: string,
): Promise<TelegramWebhookInfo | null> {
  try {
    const res = await fetch(`${TELEGRAM_BASE}/bot${token}/getWebhookInfo`, {
      signal: AbortSignal.timeout(8_000),
    })
    const json = (await res.json().catch(() => null)) as {
      ok?: boolean
      result?: {
        url?: string
        pending_update_count?: number
        max_connections?: number
        last_error_date?: number
        last_error_message?: string
      }
    } | null
    if (!res.ok || !json?.ok || !json.result) return null

    return {
      url: json.result.url ?? '',
      pendingUpdateCount: json.result.pending_update_count ?? 0,
      maxConnections: json.result.max_connections ?? null,
      lastErrorDate: json.result.last_error_date ?? null,
      lastErrorMessage: json.result.last_error_message ?? null,
    }
  } catch {
    return null
  }
}
