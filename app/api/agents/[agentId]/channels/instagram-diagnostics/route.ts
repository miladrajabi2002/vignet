import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { readPageToken, readIgUserId } from '@/lib/instagram/config'
import {
  subscribeIgUserToWebhook,
  getIgUserWebhookSubscription,
  getInstagramProfile,
} from '@/lib/instagram/oauth'
import { getWebhookPayloads } from '@/lib/channels/webhook-debug'

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

  // Pull the last few webhook payloads so the operator can compare the
  // `entry[].id` Meta sent against the `igUserId` we stored. A mismatch is the
  // #1 cause of "messages arrive but nothing happens".
  const recentPayloads = getWebhookPayloads('INSTAGRAM', 5).map((p) => {
    const body = p.body as { entry?: { id?: string | number }[] } | null
    const entryIds = (body?.entry ?? [])
      .map((e) => (e?.id !== undefined && e?.id !== null ? String(e.id) : null))
      .filter((x): x is string => !!x)
    return {
      ts: p.ts,
      eventType: p.eventType,
      parsedCount: p.parsedCount,
      entryIds, // what Meta sent
      tokenHint: p.tokenHint,
    }
  })

  // Check: do any of the recent payloads have an entry id that matches our igUserId?
  const matchFound = recentPayloads.some((p) => p.entryIds.includes(igUserId))

  return NextResponse.json({
    connected: true,
    igUserId, // what we stored
    username: profile?.username ?? null,
    webhookSubscription: subscription,
    subscribed: subscription !== null && subscription.length > 0,
    lastInboundAt: channel.lastInboundAt?.toISOString() ?? null,
    webhookUrl: 'https://vigent.ir/api/webhook/instagram',
    recentPayloads,
    entryIdMatches: matchFound,
    diagnosis:
      recentPayloads.length === 0
        ? 'هیچ وب‌هوکی دریافت نشده. در Meta dashboard → Webhooks مطمئن شوید Callback URL ثبت شده و Subscribe فیلدها فعال است.'
        : !matchFound
          ? `وب‌هوک دریافت شده ولی entry.id با igUserId ذخیره‌شده مطابقت نداره! entry.id‌های دریافتی: ${JSON.stringify(
              recentPayloads.flatMap((p) => p.entryIds),
            )}. igUserId ذخیره‌شده: "${igUserId}". احتمالاً کانال رو با مدل قدیمی (Facebook Login) وصل کرده‌اید — قطع و با Instagram Login دوباره وصل کنید.`
          : subscription === null
            ? 'وب‌هوک میاد و id مطابقت داره، ولی subscription فعال نیست. روی دکمه «فعال‌سازی مجدد» بزنید.'
            : 'همه‌چیز درسته. اگه بازم پیام نمیاد، /admin/errors رو چک کنید.',
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
