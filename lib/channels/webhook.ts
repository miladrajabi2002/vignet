import { NextResponse } from 'next/server'
import { dispatchInbound } from '@/lib/queue/jobs'
import type { MessengerType } from '@/lib/channels/registry'
import { rateLimit } from '@/lib/ratelimit'
import { captureError } from '@/lib/errors/capture'
import { logWebhookPayload } from '@/lib/channels/webhook-debug'
import { getAdapter } from '@/lib/channels/registry'
import { readBotToken } from '@/lib/channels/config'
import { prisma } from '@/lib/prisma'

// Public webhook URLs carry a secret token, but the token sits in the URL and
// could leak. Cap inbound traffic per token so a flood (accidental or hostile)
// can't exhaust the worker / model budget. Generous enough for real bursts.
const WEBHOOK_MAX_PER_MINUTE = 120

/**
 * Shared webhook handler for messenger channels. Acknowledges the platform
 * immediately (200) and processes the update without blocking the response —
 * messenger platforms retry aggressively on slow webhooks.
 */
export async function handleWebhookRequest(
  type: MessengerType,
  token: string,
  req: Request,
): Promise<Response> {
  // Always 200 so platforms don't retry-storm; we just drop work over the cap.
  const allowed = await rateLimit(`wh:${type}:${token}`, WEBHOOK_MAX_PER_MINUTE, 60)
  if (!allowed) {
    console.warn(`[webhook:${type}] rate limit exceeded — dropping update`)
    return NextResponse.json({ ok: true })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  // Capture the raw payload for live debugging (visible at /api/admin/webhook-debug).
  // We try to parse it with the adapter so the admin also sees "did the adapter
  // extract any messages from this payload?" — the key question when an inbound
  // "isn't being read". This is best-effort: if the channel/token can't be
  // resolved, we still log the raw body with parsedCount = -1.
  let parsedCount = -1
  try {
    const channel = await prisma.agentChannel.findFirst({
      where: {
        type,
        config: { path: ['webhookToken'], equals: token },
      },
      select: { config: true },
    })
    const botToken = channel ? readBotToken(channel.config) : null
    if (botToken) {
      parsedCount = getAdapter(type, botToken).parseUpdate(body).length
    } else {
      parsedCount = -2 // channel not found (likely a stale/old webhook URL)
    }
  } catch {
    /* keep parsedCount = -1 — parsing threw, body still logged */
  }
  logWebhookPayload(type, token, body, parsedCount)

  // Process after responding: durable BullMQ job when the queue is up
  // (survives restarts, runs in the worker), inline fire-and-forget otherwise.
  void dispatchInbound({ type, token, body }).catch((e) =>
    captureError(`webhook:${type}:processing`, e),
  )

  return NextResponse.json({ ok: true })
}
