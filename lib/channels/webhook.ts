import { NextResponse } from 'next/server'
import { dispatchInbound } from '@/lib/queue/jobs'
import type { MessengerType } from '@/lib/channels/registry'
import { getRedis } from '@/lib/redis'
import { captureError } from '@/lib/errors/capture'
import { logWebhookPayload } from '@/lib/channels/webhook-debug'
import { getAdapter } from '@/lib/channels/registry'
import { readBotToken } from '@/lib/channels/config'
import { prisma } from '@/lib/prisma'
import {
  readBoundedRequestBody,
  RequestBodyTooLargeError,
} from '@/lib/security/request-body'

// Public webhook URLs carry a secret token, but the token sits in the URL and
// could leak. Cap inbound traffic per token so a flood (accidental or hostile)
// can't exhaust the worker / model budget. Generous enough for real bursts.
const WEBHOOK_MAX_PER_MINUTE = 120
const MAX_WEBHOOK_BYTES = 1024 * 1024

export type WebhookRateLimitState = 'allowed' | 'limited' | 'unavailable'

/**
 * Fixed-window limiter with an explicit tri-state result. A plain boolean
 * (allowed / not) forced the caller to ACK-and-drop both overload AND Redis
 * outages — silently losing customer messages the platform would happily have
 * redelivered. The three states map to three different HTTP answers below.
 * Key shape matches the previous `rateLimit('wh:…')` keys, so the window
 * counters stay continuous across a deploy.
 */
async function webhookRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<WebhookRateLimitState> {
  try {
    const redis = getRedis()
    const window = Math.floor(Date.now() / 1000 / windowSeconds)
    const redisKey = `rl:${key}:${window}`
    const count = await redis.incr(redisKey)
    if (count === 1) await redis.expire(redisKey, windowSeconds)
    return count <= limit ? 'allowed' : 'limited'
  } catch (e) {
    console.error('[webhook] rate limiter unavailable:', e)
    return 'unavailable'
  }
}

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
  if (!/^[A-Za-z0-9_-]{24,128}$/.test(token)) {
    return NextResponse.json({ ok: true })
  }
  const limiterState = await webhookRateLimit(
    `wh:${type}:${token}`,
    WEBHOOK_MAX_PER_MINUTE,
    60,
  )
  // Redis down: never ACK what we can't process — 503 makes the platform
  // redeliver later, matching the enqueue path's contract below. (Processing
  // is impossible anyway: the queue shares the same Redis.)
  if (limiterState === 'unavailable') {
    return NextResponse.json({ error: 'RATE_LIMITER_UNAVAILABLE' }, { status: 503 })
  }
  // Over the cap: 429 defers the burst instead of destroying it — platforms
  // retry non-2xx with backoff, so a backlog flush or story-promo spike is
  // delivered a little later rather than never. A silent 200 here permanently
  // dropped every message over 120/min.
  if (limiterState === 'limited') {
    console.warn(`[webhook:${type}] rate limit exceeded — deferring update (429)`)
    return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 })
  }

  const channel = await prisma.agentChannel.findFirst({
    where: {
      type,
      active: true,
      config: { path: ['webhookToken'], equals: token },
    },
    select: { config: true },
  })
  if (!channel) return NextResponse.json({ ok: true })

  let rawBody: Buffer
  try {
    rawBody = await readBoundedRequestBody(req, MAX_WEBHOOK_BYTES)
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
    }
    throw error
  }
  let body: unknown
  try {
    body = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return NextResponse.json({ ok: true })
  }
  if (!body) return NextResponse.json({ ok: true })

  // Capture the raw payload for live debugging (visible at /api/admin/webhook-debug).
  // We try to parse it with the adapter so the admin also sees "did the adapter
  // extract any messages from this payload?" — the key question when an inbound
  // "isn't being read". This is best-effort: if the channel/token can't be
  // resolved, we still log the raw body with parsedCount = -1.
  let parsedCount = -1
  try {
    const botToken = readBotToken(channel.config)
    if (botToken) {
      parsedCount = getAdapter(type, botToken).parseUpdate(body).length
    } else {
      parsedCount = -2 // channel not found (likely a stale/old webhook URL)
    }
  } catch {
    /* keep parsedCount = -1 — parsing threw, body still logged */
  }
  logWebhookPayload(type, token, body, parsedCount)

  // Wait only for Redis to durably accept the job. If the queue is unavailable,
  // return a retryable error instead of acknowledging and silently losing work.
  try {
    await dispatchInbound({ type, token, body })
  } catch (e) {
    captureError(`webhook:${type}:enqueue`, e)
    return NextResponse.json({ error: 'QUEUE_UNAVAILABLE' }, { status: 503 })
  }

  return NextResponse.json({ ok: true })
}
