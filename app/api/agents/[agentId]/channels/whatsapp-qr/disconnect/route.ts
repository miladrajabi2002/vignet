import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { syncOnboarding } from '@/lib/onboarding'
import {
  bridgeBaseUrl,
  bridgeHeaders,
  readBridgeSessionId,
} from '@/lib/whatsapp/qr-config'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ agentId: string }> }

/**
 * Disconnect a QR-connected WhatsApp channel.
 *
 * Two-step:
 *  1. Tell the bridge to log out the Baileys session (`sock.logout()`) and
 *     wipe its auth folder — so the next /start emits a fresh QR.
 *  2. Delete the AgentChannel row (mirroring the DELETE /channels/[channelId]
 *     route used by the other messengers).
 *
 * If the bridge is unreachable, we STILL delete the channel row — the operator
 * can manually clean up the orphaned auth folder later. A stale bridge session
 * that can't be logged out will eventually expire on its own (WhatsApp logs
 * out linked devices after ~14 days of inactivity).
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

  // Find the existing WhatsApp channel and read its bridge session id.
  const channel = await prisma.agentChannel.findFirst({
    where: { agentId: agent.id, type: 'WHATSAPP', active: true },
    select: { id: true, config: true },
  })
  if (!channel) {
    return NextResponse.json({ error: 'NO_CHANNEL' }, { status: 404 })
  }
  const sessionId = readBridgeSessionId(channel.config)

  // If this is a QR channel, ask the bridge to log out the WhatsApp session.
  if (sessionId) {
    try {
      await fetch(`${bridgeBaseUrl()}/disconnect`, {
        method: 'POST',
        headers: bridgeHeaders(),
        body: JSON.stringify({ sessionId }),
      })
    } catch {
      // Bridge down — proceed anyway (the row is removed below; the orphaned
      // auth folder will expire on its own).
    }
  }

  // Remove the channel row.
  await prisma.agentChannel.delete({ where: { id: channel.id } })
  await syncOnboarding(agent.workspaceId)

  return NextResponse.json({ ok: true })
}
