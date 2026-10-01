import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import { escapeHtml, readOperatorPrefs, type OperatorPrefKey } from '@/lib/channels/operator-bot-screens'

const CATEGORY_ICON: Record<OperatorPrefKey, string> = {
  handoff: '🙋',
  orders: '🛒',
  stock: '📦',
  bookings: '📅',
  billing: '💳',
  health: '🩺',
  daily: '🌅',
}

/**
 * Send a concise operational alert through the workspace's Telegram manager
 * bot, unless the owner muted that category from the bot's «هشدارها» screen.
 * The message carries glass buttons: open it in the panel, or jump to the
 * bot's control center.
 */
export async function sendOperatorTelegramNotification(params: {
  workspaceId: string
  title: string
  body?: string
  link?: string
  category: OperatorPrefKey
}): Promise<boolean> {
  const channel = await prisma.operatorChannel.findUnique({
    where: { workspaceId: params.workspaceId },
    select: { botToken: true, operatorChatId: true, active: true, prefs: true },
  })
  if (!channel?.active || !channel.operatorChatId) return false
  if (!readOperatorPrefs(channel.prefs)[params.category]) return false

  let token: string
  try {
    token = decrypt(channel.botToken)
  } catch {
    return false
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/$/, '')
  const absoluteLink = params.link ? `${appUrl}/${params.link.replace(/^\//, '')}` : undefined
  const text = [
    `${CATEGORY_ICON[params.category]} <b>${escapeHtml(params.title)}</b>`,
    params.body ? escapeHtml(params.body) : '',
  ].filter(Boolean).join('\n')
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: channel.operatorChatId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          ...(absoluteLink ? [{ text: '🖥 مشاهده در پنل', url: absoluteLink }] : []),
          { text: '🏠 مرکز مدیریت', callback_data: 'm:home' },
        ]],
      },
    }),
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Telegram notification failed: ${response.status} ${detail}`)
  }
  return true
}
