import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { readPayGatewaySettings } from '@/lib/payments/card/settings'
import { prisma } from '@/lib/prisma'
import { cardPayView, createCardPayment, manualLinkReference, payPageUrl } from '@/lib/payments/card/service'

const schema = z.object({
  // Whole tomans.
  amount: z.number().int().min(1_000).max(2_000_000_000),
  description: z.string().trim().max(200).optional(),
  customerName: z.string().trim().max(80).optional(),
  // The setup guide's own small transfer to the owner's card.
  test: z.boolean().optional(),
})

/** A payment link made by hand (phone orders, a customer on another app) or the setup test. */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const test = parsed.data.test === true
  if (test) {
    // The test must work before the owner switches the gateway on.
    const cards = await prisma.payCard.count({ where: { workspaceId: user.workspaceId, active: true, deletedAt: null } })
    if (!cards) return NextResponse.json({ error: 'NO_CARD' }, { status: 400 })
    await prisma.workspace.updateMany({ where: { id: user.workspaceId, payGatewayEnabled: false }, data: { payGatewayEnabled: true } })
  }
  const created = await createCardPayment({
    workspaceId: user.workspaceId,
    baseAmount: parsed.data.amount,
    source: 'LINK',
    reference: manualLinkReference(test),
    description: test ? 'واریز آزمایشی راه‌اندازی' : parsed.data.description ?? null,
    customerName: parsed.data.customerName ?? null,
    ttlMinutes: test ? 15 : 60,
  })
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: 400 })
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: user.workspaceId }, select: { payGatewaySettings: true } })
  return NextResponse.json({
    ok: true,
    id: created.payment.id,
    url: payPageUrl(created.payment.authority),
    card: cardPayView(created.payment, created.card, readPayGatewaySettings(workspace.payGatewaySettings), 'fa'),
  })
}
