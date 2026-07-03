import { NextResponse } from 'next/server'
import { dispatchInbound } from '@/lib/queue/jobs'
import type { MessengerType } from '@/lib/channels/registry'
import { rateLimit } from '@/lib/ratelimit'
import { captureError } from '@/lib/errors/capture'

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

  // Process after responding: durable BullMQ job when the queue is up
  // (survives restarts, runs in the worker), inline fire-and-forget otherwise.
  void dispatchInbound({ type, token, body }).catch((e) =>
    captureError(`webhook:${type}:processing`, e),
  )

  return NextResponse.json({ ok: true })
}
