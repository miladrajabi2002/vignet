import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { readPageToken, readIgUserId } from '@/lib/instagram/config'
import {
  subscribeIgUserToWebhook,
  getIgUserWebhookSubscription,
  getInstagramProfile,
} from '@/lib/instagram/oauth'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ agentId: string }> }

/**
 * Diagnostics + manual webhook (re)subscription for an Instagram channel.
 *
 * GET  → returns the current subscription status + profile snapshot
 * POST → re-subscribes the IG user to webhook fields (idempotent)
 *
 * Use this when "messages aren't arriving" — it tells you whether the webhook
 * subscription is active, and lets you retry it without reconnecting.
 */
export async function GET(_req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: {
      id: true,
      channels: {
        where: { type: 'INSTAGRAM' },
        select: { id: true, config: true, lastInboundAt: true },
      },
    },
  })
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const channel = agent.channels[0]
  if (!channel) return NextResponse.json({ error: 'IG_NOT_CONNECTED' }, { status: 400 })

  const token = readPageToken(channel.config)
  const igUserId = readIgUserId(channel.config)
  if (!token || !igUserId) {
    return NextResponse.json({ error: 'NO_OAUTH_TOKEN' }, { status: 400 })
  }

  // Check current subscription + fresh profile in parallel.
  const [subscription, profile] = await Promise.all([
    getIgUserWebhookSubscription(igUserId, token),
    getInstagramProfile(token).catch(() => null),
  ])

  return NextResponse.json({
    connected: true,
    igUserId,
    username: profile?.username ?? null,
    webhookSubscription: subscription,
    subscribed: subscription !== null && subscription.length > 0,
    lastInboundAt: channel.lastInboundAt?.toISOString() ?? null,
    webhookUrl: 'https://vigent.ir/api/webhook/instagram',
    note:
      subscription === null
        ? 'وب‌هوک فعال نیست. روی دکمه «فعال‌سازی مجدد وب‌هوک» بزنید یا در Meta dashboard مطمئن شوید Callback URL تنظیم شده.'
        : 'وب‌هوک فعال است. اگه پیام نمی‌آید، در /api/admin/webhook-debug?type=INSTAGRAM چک کنید.',
  })
}

/** Re-subscribe the IG user to webhook fields. */
export async function POST(_req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: {
      id: true,
      channels: { where: { type: 'INSTAGRAM' }, select: { id: true, config: true } },
    },
  })
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const channel = agent.channels[0]
  if (!channel) return NextResponse.json({ error: 'IG_NOT_CONNECTED' }, { status: 400 })

  const token = readPageToken(channel.config)
  const igUserId = readIgUserId(channel.config)
  if (!token || !igUserId) {
    return NextResponse.json({ error: 'NO_OAUTH_TOKEN' }, { status: 400 })
  }

  const result = await subscribeIgUserToWebhook(igUserId, token)
  if (!result) {
    return NextResponse.json(
      {
        error: 'SUBSCRIBE_FAILED',
        hint: 'مطمئن شوید در Meta dashboard → Webhooks → Callback URL تنظیم شده و Verify تایید شده.',
      },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, subscribedFields: result })
}
