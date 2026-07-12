import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

/** Send a concise operational alert through the workspace's Telegram bot. */
export async function sendOperatorTelegramNotification(params: {
  workspaceId: string
  text: string
  link?: string
}): Promise<boolean> {
  const channel = await prisma.operatorChannel.findUnique({
    where: { workspaceId: params.workspaceId },
    select: { botToken: true, operatorChatId: true, active: true },
  })
  if (!channel?.active || !channel.operatorChatId) return false

  let token: string
  try {
    token = decrypt(channel.botToken)
  } catch {
    return false
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir'
  const absoluteLink = params.link
    ? `${appUrl.replace(/\/$/, '')}/${params.link.replace(/^\//, '')}`
    : undefined
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: channel.operatorChatId,
      text: params.text,
      ...(absoluteLink
        ? {
            reply_markup: {
              inline_keyboard: [[{ text: 'مشاهده در ویجنت', url: absoluteLink }]],
            },
          }
        : {}),
    }),
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Telegram notification failed: ${response.status} ${detail}`)
  }
  return true
}
