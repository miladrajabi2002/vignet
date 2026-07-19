import { NextResponse } from 'next/server'
import { handleWhatsappGlobalInbound } from '@/lib/whatsapp/webhook'
import { metaVerifyToken } from '@/lib/instagram/oauth'
import { captureError } from '@/lib/errors/capture'
import { verifyMetaWebhookSignature } from '@/lib/security/meta-webhook'
import {
  readBoundedRequestBody,
  RequestBodyTooLargeError,
} from '@/lib/security/request-body'

export const dynamic = 'force-dynamic'

const MAX_WEBHOOK_BYTES = 1024 * 1024

/**
 * GLOBAL WhatsApp webhook — the single endpoint registered once on the
 * platform's Meta App (Callback URL: https://vigent.ir/api/webhook/whatsapp,
 * Verify Token: META_APP_VERIFY_TOKEN).
 *
 * Because vigent owns one Meta App, ALL WhatsApp Cloud API events for every
 * connected phone number arrive here. We demultiplex by the phone number id
 * carried in `entry[0].changes[0].value.metadata.phone_number_id` and route
 * the batch to the channel that owns that number (see
 * {@link handleWhatsappGlobalInbound}).
 *
 * The per-channel `/api/webhook/whatsapp/[token]` route is kept for backward
 * compatibility with legacy (manually-pasted-token) channels. In Next.js the
 * static segment `/api/webhook/whatsapp` wins over the dynamic
 * `/api/webhook/whatsapp/[token]`, so both coexist without conflict.
 *
 * The verify token is the SAME `META_APP_VERIFY_TOKEN` env var used by the
 * Instagram global webhook — there is one Meta App, one webhook subscription
 * config (with separate field subscriptions for Instagram and WhatsApp).
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

  if (!verifyMetaWebhookSignature(
    rawBody,
    req.headers.get('x-hub-signature-256'),
    process.env.META_APP_SECRET,
  )) {
    return NextResponse.json({ error: 'BAD_SIGNATURE' }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
  }
  if (!body) return NextResponse.json({ ok: true })

  // Process without blocking the response — Meta retries aggressively on slow
  // webhooks. Inline fire-and-forget is fine here (no per-token queue key).
  void handleWhatsappGlobalInbound(body).catch((e) =>
    captureError('webhook:WHATSAPP:global:process', e),
  )

  return NextResponse.json({ ok: true })
}
