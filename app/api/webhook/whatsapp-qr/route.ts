import { NextResponse } from 'next/server'
import { handleInbound } from '@/lib/channels/handler'
import { captureError } from '@/lib/errors/capture'
import { prisma } from '@/lib/prisma'
import {
  bridgeSecret,
  isWhatsappQrChannel,
  readBridgeSessionId,
} from '@/lib/whatsapp/qr-config'

export const dynamic = 'force-dynamic'

/**
 * Bridge → Next.js inbound webhook for QR-connected WhatsApp channels.
 *
 * The whatsapp-bridge mini-service (`mini-services/whatsapp-bridge`) holds the
 * WhatsApp Web (Baileys) socket. When a message arrives, it reshapes the
 * Baileys event into the Meta Cloud API webhook shape (see `forwardInbound`
 * in the bridge's index.ts) and POSTs it here.
 *
 * We demultiplex by the `bridgeSessionId` carried in the body's `_vigent`
 * envelope (the bridge knows only its own session id, not our channel id),
 * resolve the channel row, and hand off to the SAME shared inbound pipeline
 * the OAuth / legacy webhooks use:
 *
 *   handleInbound('WHATSAPP', webhookToken, body)
 *     → resolveChannel by config.webhookToken
 *     → readBotToken(config) returns the synthetic `qr:<sessionId>` packed
 *       string
 *     → whatsappAdapter(token) recognises the `qr:` prefix
 *     → parseUpdate(body) extracts the message (same Meta-shape parsing as
 *       OAuth channels)
 *     → AI generates reply
 *     → sendText() forwards the reply back to the bridge's /send-text
 *
 * So the entire AI pipeline runs UNCHANGED — only the transport differs.
 *
 * Security: the bridge sends `x-bridge-secret: <WHATSAPP_BRIDGE_SECRET>` on
 * every request. When the secret is configured, we reject any request that
 * doesn't carry it, so random internet traffic can't trigger inbound message
 * processing. (Locally with no secret set we skip the check for dev
 * convenience.)
 *
 * We always return 200 so the bridge doesn't retry-storm; failures are logged
 * via captureError and swallowed.
 */
export async function POST(req: Request) {
  // ── Shared-secret auth ───────────────────────────────────────────────────
  const secret = bridgeSecret()
  if (secret) {
    const got = req.headers.get('x-bridge-secret') ?? ''
    if (got !== secret) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: true })

  // The bridge stamps every payload with a `_vigent.sessionId` envelope so we
  // can demux without parsing the Meta-shaped `entry[].changes[].value`.
  const vigent = (body as { _vigent?: { sessionId?: string } })?._vigent
  const sessionId = vigent?.sessionId
  if (!sessionId || !/^[A-Za-z0-9_-]{4,64}$/.test(sessionId)) {
    // No session id → nothing we can route to. Acknowledge so the bridge
    // doesn't retry.
    return NextResponse.json({ ok: true })
  }

  // Resolve the channel row by its `config.bridgeSessionId`. We scope by
  // type: WHATSAPP + active + matching session id.
  const channel = await prisma.agentChannel.findFirst({
    where: {
      type: 'WHATSAPP',
      active: true,
      config: { path: ['bridgeSessionId'], equals: sessionId },
    },
    select: { id: true, config: true },
  })
  if (!channel) {
    // The bridge knows about a session we don't have a channel for — either
    // the operator is mid-connect (channel row not yet persisted) or the
    // channel was deleted while the bridge kept the socket. Either way, drop
    // the message silently.
    return NextResponse.json({ ok: true, dropped: 'NO_CHANNEL' })
  }
  if (!isWhatsappQrChannel(channel.config)) {
    // Defensive: a non-QR channel somehow ended up with a `bridgeSessionId`.
    // Don't route through the QR pipeline; let it fall through.
    return NextResponse.json({ ok: true, dropped: 'NOT_QR' })
  }

  // Read the webhookToken (stored in the channel config) — that's what
  // `handleInbound` uses to resolve + dispatch the inbound pipeline.
  const cfg = channel.config as { webhookToken?: string } | null
  const webhookToken = cfg?.webhookToken
  if (!webhookToken) {
    return NextResponse.json({ ok: true, dropped: 'NO_WEBHOOK_TOKEN' })
  }

  // Strip the `_vigent` envelope before handing off — the shared
  // `whatsappAdapter.parseUpdate` only reads the Meta-shape fields, but
  // leaving extra keys is harmless.
  void readBridgeSessionId // (referenced for the import; not used here)

  // Hand off to the shared inbound pipeline. Fire-and-forget so the bridge
  // gets an immediate 200 (it doesn't retry-storm WhatsApp's servers).
  void handleInbound('WHATSAPP', webhookToken, body).catch((e) =>
    captureError('webhook:WHATSAPP-QR:process', e, {
      metadata: { sessionId },
    }),
  )

  return NextResponse.json({ ok: true })
}

/**
 * Health probe used by the bridge on startup. Returns 200 so the bridge can
 * confirm the Next.js app is reachable before it starts forwarding messages.
 */
export async function GET() {
  return NextResponse.json({ ok: true, service: 'whatsapp-qr' })
}
