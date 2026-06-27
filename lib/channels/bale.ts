import type { MessengerAdapter } from '@/lib/channels/types'
import { createTelegramLikeAdapter } from '@/lib/channels/telegram-like'

// Bale's Bot API mirrors Telegram's almost exactly — only the host differs.
export const BALE_BASE = 'https://tapi.bale.ai'

export function baleAdapter(token: string): MessengerAdapter {
  return createTelegramLikeAdapter({
    channel: 'BALE',
    baseUrl: BALE_BASE,
    token,
  })
}

/** Register the webhook for a Bale bot. Returns true on success. */
export async function setBaleWebhook(
  token: string,
  url: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${BALE_BASE}/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const json = await res.json().catch(() => ({}))
    return res.ok && (json as { ok?: boolean }).ok !== false
  } catch (e) {
    console.error('[bale] setWebhook failed:', e)
    return false
  }
}

/** Verify a Bale bot token via getMe and return its username. */
export async function getBaleBotInfo(
  token: string,
): Promise<{ username: string } | null> {
  try {
    const res = await fetch(`${BALE_BASE}/bot${token}/getMe`)
    const json = await res.json().catch(() => ({}))
    const result = (json as { result?: { username?: string } }).result
    const username = result?.username
    return res.ok && username ? { username } : null
  } catch {
    return null
  }
}
