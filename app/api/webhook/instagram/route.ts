import { NextResponse } from 'next/server'
import { handleInstagramGlobalInbound } from '@/lib/channels/handler'
import { metaVerifyToken } from '@/lib/instagram/oauth'
import { captureError } from '@/lib/errors/capture'
import { logWebhookPayload } from '@/lib/channels/webhook-debug'
import { verifyMetaWebhookSignature } from '@/lib/security/meta-webhook'
import {
  readBoundedRequestBody,
  RequestBodyTooLargeError,
} from '@/lib/security/request-body'

export const dynamic = 'force-dynamic'

const MAX_WEBHOOK_BYTES = 1024 * 1024

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
  let rawBody: Buffer
  try {
    rawBody = await readBoundedRequestBody(req, MAX_WEBHOOK_BYTES)
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
    }
    throw error
  }

  // The verify-token handshake authenticates only GET. Every POST must carry
  // Meta's HMAC or anyone could forge an inbound DM/comment and trigger replies.
  const appSecret = process.env.INSTAGRAM_APP_SECRET ?? process.env.META_APP_SECRET
  if (!verifyMetaWebhookSignature(rawBody, req.headers.get('x-hub-signature-256'), appSecret)) {
    return NextResponse.json({ error: 'BAD_SIGNATURE' }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
  }
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
