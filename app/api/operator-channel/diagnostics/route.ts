import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { readOperatorBotToken } from '@/lib/channels/operator-handoff'
import { getTelegramBotInfo, getTelegramWebhookInfo } from '@/lib/channels/telegram'

export const dynamic = 'force-dynamic'

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/$/, '')
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const op = await prisma.operatorChannel.findUnique({
    where: { workspaceId: user.workspaceId },
    select: {
      botToken: true,
      botUsername: true,
      operatorChatId: true,
      active: true,
      lastError: true,
      updatedAt: true,
    },
  })
  if (!op) return NextResponse.json({ error: 'NOT_CONFIGURED' }, { status: 404 })

  const token = readOperatorBotToken(op.botToken)
  if (!token) {
    return NextResponse.json({
      health: {
        status: 'error',
        checkedAt: new Date().toISOString(),
        botReachable: false,
        botUsername: op.botUsername,
        active: op.active,
        chatConfigured: Boolean(op.operatorChatId),
        webhookConfigured: false,
        webhookMatches: false,
        pendingUpdateCount: 0,
        maxConnections: null,
        lastErrorAt: null,
        lastErrorMessage: 'Stored bot token could not be decrypted',
        configurationUpdatedAt: op.updatedAt.toISOString(),
      },
    })
  }

  const [bot, webhook] = await Promise.all([
    getTelegramBotInfo(token),
    getTelegramWebhookInfo(token),
  ])
  const expectedWebhookUrl = `${appBaseUrl()}/api/telegram-operator/webhook?token=${encodeURIComponent(token)}`
  const webhookConfigured = Boolean(webhook?.url)
  const webhookMatches = webhook?.url === expectedWebhookUrl
  const lastErrorMessage = webhook?.lastErrorMessage ?? op.lastError
  const status = !bot || !webhook || !webhookConfigured
    ? 'error'
    : !op.active || !op.operatorChatId || !webhookMatches || Boolean(lastErrorMessage)
      ? 'warning'
      : 'healthy'

  return NextResponse.json({
    health: {
      status,
      checkedAt: new Date().toISOString(),
      botReachable: Boolean(bot),
      botUsername: bot?.username ?? op.botUsername,
      active: op.active,
      chatConfigured: Boolean(op.operatorChatId),
      webhookConfigured,
      webhookMatches,
      pendingUpdateCount: webhook?.pendingUpdateCount ?? 0,
      maxConnections: webhook?.maxConnections ?? null,
      lastErrorAt: webhook?.lastErrorDate
        ? new Date(webhook.lastErrorDate * 1_000).toISOString()
        : null,
      lastErrorMessage,
      configurationUpdatedAt: op.updatedAt.toISOString(),
    },
  })
}
