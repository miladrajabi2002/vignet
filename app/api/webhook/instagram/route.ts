import { NextResponse } from 'next/server'
import { handleInstagramGlobalInbound } from '@/lib/channels/handler'
import { metaVerifyToken } from '@/lib/instagram/oauth'
import { captureError } from '@/lib/errors/capture'
import { logWebhookPayload } from '@/lib/channels/webhook-debug'

export const dynamic = 'force-dynamic'

/**
 * GLOBAL Instagram webhook — the single endpoint registered once on the
 * platform's Meta App (Callback URL: https://vigent.ir/api/webhook/instagram,
 * Verify Token: META_APP_VERIFY_TOKEN).
 *
 * Because vigent owns one Meta App, ALL Instagram events for every connected
 * account arrive here. We demultiplex by the IG user id in each entry and
 * route the batch to the channel that owns that account (see
 * {@link handleInstagramGlobalInbound}).
 *
 * The per-channel `/api/webhook/instagram/[token]` route is kept for backward
 * compatibility with legacy (manually-pasted-token) channels.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const verifyToken = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  let expected: string
  try {
    expected = metaVerifyToken()
  } catch {
    return new Response('Verify token not configured', { status: 500 })
  }

  if (mode === 'subscribe' && verifyToken === expected && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
  return new Response('Forbidden', { status: 403 })
}

export async function POST(req: Request) {
  // Always 200 so Meta doesn't retry-storm.
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  // ── Log the raw payload for live debugging ────────────────────────────
  // This is what makes /api/admin/webhook-debug?type=INSTAGRAM show incoming
  // payloads. Without this, the admin can't tell whether Meta is actually
  // delivering events (the #1 debugging question).
  try {
    const entries = (body as { entry?: { id?: string }[] })?.entry
    const firstId = entries?.[0]?.id ?? 'global'
    logWebhookPayload('INSTAGRAM', `global:${firstId}`, body, -1)
  } catch {
    logWebhookPayload('INSTAGRAM', 'global', body, -1)
  }

  // Process without blocking the response — Meta retries aggressively on slow
  // webhooks. Inline fire-and-forget is fine here (no per-token queue key).
  void handleInstagramGlobalInbound(body).catch((e) =>
    captureError('webhook:INSTAGRAM:global:process', e),
  )

  return NextResponse.json({ ok: true })
}
