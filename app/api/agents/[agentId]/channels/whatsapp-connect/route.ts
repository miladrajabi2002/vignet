import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { syncOnboarding } from '@/lib/onboarding'
import { subscribeWabaToWebhook } from '@/lib/whatsapp/oauth'
import { buildWhatsappOAuthConfig } from '@/lib/whatsapp/config'
import {
  openPendingWhatsappOAuth,
  type PendingWhatsappNumber,
} from '@/lib/whatsapp/pending-oauth'
import { hasWorkspacePermission } from '@/lib/workspace-permissions'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ agentId: string }> }

/**
 * Finalize a multi-number OAuth connection. The callback stashed the resolved
 * phone numbers in a short-lived cookie when the user has more than one; the
 * dashboard number-picker POSTs the chosen `phoneNumberId` here. We read the
 * cookie, persist the channel for that number, subscribe its WABA to the
 * webhook, and clear the cookie.
 */
export async function POST(req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!hasWorkspacePermission(user.role, 'agents:manage')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    select: { id: true, workspaceId: true },
  })
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const cookie = req.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('wa_oauth_pending='))
  if (!cookie) {
    return NextResponse.json({ error: 'NO_PENDING_OAUTH' }, { status: 400 })
  }
  let pending: ReturnType<typeof openPendingWhatsappOAuth>
  try {
    const raw = decodeURIComponent(cookie.slice('wa_oauth_pending='.length))
    pending = openPendingWhatsappOAuth(raw)
  } catch {
    pending = null
  }
  if (
    !pending ||
    pending.userId !== user.id ||
    pending.workspaceId !== user.workspaceId ||
    pending.agentId !== agent.id ||
    Date.parse(pending.userTokenExpiresAt) <= Date.now()
  ) {
    return NextResponse.json({ error: 'BAD_PENDING' }, { status: 400 })
  }

  const body = (await req.json().catch(() => null)) as {
    phoneNumberId?: string
  }
  const num: PendingWhatsappNumber | undefined = pending.numbers.find(
    (n) => n.phoneNumberId === body?.phoneNumberId,
  )
  if (!num) {
    return NextResponse.json({ error: 'NUMBER_NOT_FOUND' }, { status: 400 })
  }

  const config = buildWhatsappOAuthConfig({
    userToken: pending.userToken,
    userTokenExpiresAt: new Date(pending.userTokenExpiresAt),
    wabaId: num.wabaId,
    phoneNumberId: num.phoneNumberId,
    displayPhoneNumber: num.displayPhoneNumber,
    verifiedName: num.verifiedName,
  })
  const configJson = config as unknown as Prisma.InputJsonValue

  await subscribeWabaToWebhook(num.wabaId, pending.userToken).catch((e) =>
    console.error('[whatsapp:connect] WABA subscribe failed:', e),
  )

  const base = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    'http://localhost:3000'
  ).replace(/\/$/, '')
  const webhookUrl = `${base}/api/webhook/whatsapp`

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

  const res = NextResponse.json({
    ok: true,
    username: num.verifiedName ?? num.displayPhoneNumber ?? num.phoneNumberId,
  })
  res.cookies.set('wa_oauth_pending', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  })
  return res
}
