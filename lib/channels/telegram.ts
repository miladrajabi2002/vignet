import type { MessengerAdapter } from '@/lib/channels/types'
import { createTelegramLikeAdapter } from '@/lib/channels/telegram-like'

export const TELEGRAM_BASE = 'https://api.telegram.org'

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
      body: JSON.stringify({ url, allowed_updates: ['message'] }),
    })
    const json = await res.json().catch(() => ({}))
    return res.ok && (json as { ok?: boolean }).ok !== false
  } catch (e) {
    console.error('[telegram] setWebhook failed:', e)
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
