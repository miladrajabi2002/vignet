import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { bridgeBaseUrl, bridgeHeaders } from '@/lib/whatsapp/qr-config'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ agentId: string }> }

/**
 * Poll the bridge for a QR-connection session's lifecycle state.
 *
 * The wizard calls this every ~2s after POSTing /start. The response carries:
 *   state:    'starting' | 'qr' | 'pairing' | 'connecting' | 'open' | 'closed'
 *   qr:       the QR string (when state === 'qr') — the wizard renders it
 *             client-side with the `qrcode` npm package.
 *   pairingCode: 8-char code (when state === 'pairing') — the operator enters
 *             it on their phone (WhatsApp → Linked devices → Link with phone
 *             number).
 *   phone:    the connected WhatsApp number, E.164 (when state === 'open').
 *   name:     the connected account's display name (when state === 'open').
 *   error:    human-readable error (when state === 'closed').
 *
 * When `state === 'open'` we additionally return `persisted: true` IF we've
 * already saved the channel row (so the wizard knows it can stop polling and
 * show the "connected" success state). If we haven't saved the channel yet,
 * the wizard calls PUT /start with the sessionId to persist it.
 */
export async function GET(req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: { id: true },
  })
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const url = new URL(req.url)
  const sessionId = url.searchParams.get('sessionId') ?? ''
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(sessionId)) {
    return NextResponse.json({ error: 'BAD_SESSION' }, { status: 400 })
  }

  // Ask the bridge for the current state.
  let bridgeStatus: {
    state?: string
    qr?: string | null
    pairingCode?: string | null
    phone?: string | null
    name?: string | null
    error?: string | null
  }
  try {
    const res = await fetch(
      `${bridgeBaseUrl()}/status?sessionId=${encodeURIComponent(sessionId)}`,
      { headers: bridgeHeaders() },
    )
    if (res.status === 404) {
      // Bridge doesn't know this session (e.g. it restarted and lost the
      // in-memory map, but the auth folder is still on disk). The wizard can
      // re-issue /start to resume.
      return NextResponse.json({
        ok: true,
        state: 'closed',
        error: 'BRIDGE_NO_SESSION',
      })
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: 'BRIDGE_UNREACHABLE', status: res.status },
        { status: 502 },
      )
    }
    bridgeStatus = (await res.json()) as typeof bridgeStatus
  } catch {
    return NextResponse.json(
      {
        ok: true,
        state: 'closed',
        error: 'BRIDGE_UNREACHABLE',
        detail:
          'سرویس واتساپ (whatsapp-bridge) در دسترس نیست. مطمئن شوید روی پورت 3040 در حال اجرا است.',
      },
      { status: 200 },
    )
  }

  // Have we already persisted the channel for this session? (Happens after the
  // operator's phone connects and the wizard called PUT /start to save.)
  const channel = await prisma.agentChannel.findFirst({
    where: {
      agentId: agent.id,
      type: 'WHATSAPP',
      active: true,
      config: { path: ['bridgeSessionId'], equals: sessionId },
    },
    select: { id: true, config: true },
  })

  return NextResponse.json({
    ok: true,
    state: bridgeStatus.state ?? 'closed',
    qr: bridgeStatus.qr ?? null,
    pairingCode: bridgeStatus.pairingCode ?? null,
    phone: bridgeStatus.phone ?? null,
    name: bridgeStatus.name ?? null,
    error: bridgeStatus.error ?? null,
    persisted: !!channel,
  })
}
