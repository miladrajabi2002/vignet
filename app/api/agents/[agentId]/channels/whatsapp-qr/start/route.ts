import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { syncOnboarding } from '@/lib/onboarding'
import {
  buildWhatsappQrConfig,
  bridgeBaseUrl,
  bridgeHeaders,
  newBridgeSessionId,
} from '@/lib/whatsapp/qr-config'
import { checkChannelConnectAllowed } from '@/lib/billing/entitlements'
import { normalizeIranianMobile } from '@/lib/phone'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ agentId: string }> }

/**
 * Start a QR-based WhatsApp connection session.
 *
 * The operator opens the connect wizard → this route creates a fresh bridge
 * session id, asks the bridge to spin up a Baileys socket, and returns the
 * session id. The wizard then polls /status every ~2s to render the QR (or
 * pairing code) and detect the moment the operator's phone connects.
 *
 * Optionally accepts `{ phone: "+989121234567" }` in the body to request a
 * phone-number pairing code INSTEAD of a QR — useful when the operator is on
 * mobile and can't scan a QR displayed on the same device.
 *
 * We DO NOT persist the channel yet — that only happens once /status reports
 * `state: 'open'`, at which point the wizard calls /status again with
 * `persist: true` and we save the channel row.
 */
export async function POST(req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: { id: true, workspaceId: true },
  })
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const gate = await checkChannelConnectAllowed(user.workspaceId, {
    kind: 'AGENT_CHANNEL',
    agentId: agent.id,
    type: 'WHATSAPP',
  })
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason }, { status: 402 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    phone?: string
    /** Re-use an existing session id (e.g. after a bridge restart). */
    sessionId?: string
  }

  // Either reuse the supplied sessionId (when reconnecting an existing channel)
  // or mint a fresh one. We scope it to the agent so two workspaces can never
  // collide on the same bridge session id (and therefore the same auth folder).
  const sessionId =
    body.sessionId && /^[A-Za-z0-9_-]{4,64}$/.test(body.sessionId)
      ? body.sessionId
      : `ag-${agent.id.slice(-8)}-${newBridgeSessionId()}`

  // Strip anything that isn't a digit — Baileys' requestPairingCode wants the
  // bare international number without "+" or spaces.
  const phone = body.phone ? body.phone.replace(/[^\d]/g, '') : undefined
  if (phone && !/^\d{6,15}$/.test(phone)) {
    return NextResponse.json(
      { error: 'BAD_PHONE', detail: 'شمارهٔ تلفن نامعتبر است.' },
      { status: 400 },
    )
  }

  // Ask the bridge to start the Baileys socket. The bridge returns immediately
  // with `state: 'starting'`; the QR / pairing code arrives a moment later and
  // the wizard picks it up by polling /status.
  try {
    const res = await fetch(`${bridgeBaseUrl()}/start`, {
      method: 'POST',
      headers: bridgeHeaders(),
      body: JSON.stringify({ sessionId, phone }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return NextResponse.json(
        {
          error: 'BRIDGE_UNREACHABLE',
          detail: `برقراری ارتباط با سرویس واتساپ ناموفق بود (${res.status}). ${detail}`.trim(),
        },
        { status: 502 },
      )
    }
  } catch {
    return NextResponse.json(
      {
        error: 'BRIDGE_UNREACHABLE',
        detail:
          'سرویس واتساپ (whatsapp-bridge) در حال اجرا نیست. مطمئن شوید mini-services/whatsapp-bridge با bun run dev روی پورت 3040 بالا آمده است.',
      },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, sessionId })
}

/**
 * Persist the channel for an already-connected session. Called by the wizard
 * once /status reports `state: 'open'`. We look up the phone number from the
 * bridge so the dashboard can show which WhatsApp account is wired up.
 *
 * (Splitting start / status / persist keeps each route tiny and lets the wizard
 * poll status cheaply without re-triggering the start flow.)
 */
export async function PUT(req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: { id: true, workspaceId: true },
  })
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const gate = await checkChannelConnectAllowed(user.workspaceId, {
    kind: 'AGENT_CHANNEL',
    agentId: agent.id,
    type: 'WHATSAPP',
  })
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason }, { status: 402 })
  }

  const body = (await req.json().catch(() => ({}))) as { sessionId?: string }
  if (!body.sessionId || !/^[A-Za-z0-9_-]{4,64}$/.test(body.sessionId)) {
    return NextResponse.json({ error: 'BAD_SESSION' }, { status: 400 })
  }

  // Confirm with the bridge that the session is actually open.
  let phone: string | undefined
  let name: string | undefined
  try {
    const res = await fetch(
      `${bridgeBaseUrl()}/status?sessionId=${encodeURIComponent(body.sessionId)}`,
      { headers: bridgeHeaders() },
    )
    if (!res.ok) {
      return NextResponse.json(
        { error: 'BRIDGE_UNREACHABLE' },
        { status: 502 },
      )
    }
    const data = (await res.json()) as {
      state?: string
      phone?: string
      name?: string
    }
    if (data.state !== 'open') {
      return NextResponse.json(
        { error: 'NOT_OPEN', state: data.state ?? null },
        { status: 409 },
      )
    }
    phone = data.phone ?? undefined
    name = data.name ?? undefined
  } catch {
    return NextResponse.json({ error: 'BRIDGE_UNREACHABLE' }, { status: 502 })
  }

  // Normalize the phone to E.164 (Baileys returns the bare number).
  const displayPhoneNumber = phone
    ? normalizeIranianMobile(phone) ?? `+${phone}`
    : undefined

  const config = buildWhatsappQrConfig({
    bridgeSessionId: body.sessionId,
    displayPhoneNumber,
    verifiedName: name,
  })
  const configJson = config as unknown as Prisma.InputJsonValue

  // No per-channel webhook URL needed (the global /api/webhook/whatsapp-qr
  // route demuxes by sessionId embedded in the body), but we store the global
  // URL for completeness / health-display purposes.
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    'http://localhost:3003'
  ).replace(/\/$/, '')
  const webhookUrl = `${base}/api/webhook/whatsapp-qr`

  await prisma.agentChannel.upsert({
    where: { agentId_type: { agentId: agent.id, type: 'WHATSAPP' } },
    update: { active: true, config: configJson, webhookUrl },
    create: {
      agentId: agent.id,
      type: 'WHATSAPP',
      config: configJson,
      webhookUrl,
    },
  })

  await syncOnboarding(agent.workspaceId)

  return NextResponse.json({
    ok: true,
    phone: displayPhoneNumber,
    name,
  })
}
