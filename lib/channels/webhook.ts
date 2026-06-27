import { NextResponse } from 'next/server'
import { handleInbound } from '@/lib/channels/handler'
import type { MessengerType } from '@/lib/channels/registry'

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
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  // Process after responding. We intentionally don't await the work.
  void handleInbound(type, token, body).catch((e) =>
    console.error(`[webhook:${type}] processing failed:`, e),
  )

  return NextResponse.json({ ok: true })
}
