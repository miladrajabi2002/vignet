import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { PAY_TTL_RANGE, readPayGatewaySettings } from '@/lib/payments/card/settings'

const schema = z.object({
  enabled: z.boolean().optional(),
  ttlMinutes: z.number().int().min(PAY_TTL_RANGE.min).max(PAY_TTL_RANGE.max).optional(),
  manualClaim: z.boolean().optional(),
  showHolderName: z.boolean().optional(),
  // How one agent takes payment for a chat order: both false = the operator arranges it.
  agent: z.object({ id: z.string().min(1), cardPayEnabled: z.boolean().optional(), payLinkEnabled: z.boolean().optional() }).optional(),
})

/** Whether the gateway can collect a payment now (the advance-payment fields of bookings and courses ask). */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const { cardPayAvailability } = await import('@/lib/payments/card/service')
  const availability = await cardPayAvailability(user.workspaceId, true)
  const devices = await prisma.payDevice.count({ where: { workspaceId: user.workspaceId, active: true, connectedAt: { not: null } } })
  return NextResponse.json({
    ready: Boolean(availability.context),
    reason: availability.reason,
    phoneConnected: devices > 0,
    ttlMinutes: availability.context?.settings.ttlMinutes ?? null,
  })
}

/**
 * One place for the gateway's switches. The agent's own switch lives here too
 * (and is mirrored on the agent's store-access page) so «how does this agent
 * take payment» is answered by a single control.
 */
export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const { enabled, agent, ...behaviour } = parsed.data

  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: user.workspaceId }, select: { payGatewaySettings: true } })
  const data: Prisma.WorkspaceUpdateInput = {}
  if (enabled !== undefined) {
    if (enabled && !(await prisma.payCard.count({ where: { workspaceId: user.workspaceId, active: true, deletedAt: null } }))) {
      return NextResponse.json({ error: 'NO_ACTIVE_CARD' }, { status: 400 })
    }
    data.payGatewayEnabled = enabled
  }
  if (Object.keys(behaviour).length) data.payGatewaySettings = { ...readPayGatewaySettings(workspace.payGatewaySettings), ...behaviour }
  if (Object.keys(data).length) await prisma.workspace.update({ where: { id: user.workspaceId }, data })

  if (agent) {
    const patch: Prisma.AgentUpdateManyMutationInput = {}
    if (agent.cardPayEnabled !== undefined) Object.assign(patch, { cardPayEnabled: agent.cardPayEnabled, cardPayConfigured: true })
    if (agent.payLinkEnabled !== undefined) Object.assign(patch, { payLinkEnabled: agent.payLinkEnabled, payLinkConfigured: true })
    // Taking payment in chat needs the cart to be taken in chat.
    if (agent.cardPayEnabled || agent.payLinkEnabled) Object.assign(patch, { orderCaptureEnabled: true, orderCaptureConfigured: true })
    const updated = await prisma.agent.updateMany({ where: { id: agent.id, workspaceId: user.workspaceId }, data: patch })
    if (!updated.count) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
