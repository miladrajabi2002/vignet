import { handleWebhookRequest } from '@/lib/channels/webhook'

export const dynamic = 'force-dynamic'

/**
 * Meta verifies the webhook with a GET handshake: it echoes back hub.challenge
 * when hub.verify_token matches. We use the per-channel webhookToken (the value
 * in the URL path) as the verify token, so it's self-contained per channel.
 */
export async function GET(
  req: Request,
  { params }: { params: { token: string } },
) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const verifyToken = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && verifyToken === params.token && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
  return new Response('Forbidden', { status: 403 })
}

export async function POST(
  req: Request,
  { params }: { params: { token: string } },
) {
  return handleWebhookRequest('INSTAGRAM', params.token, req)
}
