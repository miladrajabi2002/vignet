import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { cancelOpenCardPayments, confirmCardPayment, rejectCardPayment, setCardPayBlockForPayment } from '@/lib/payments/card/service'

type Params = { params: Promise<{ paymentId: string }> }

const schema = z.object({ action: z.enum(['confirm', 'reject', 'cancel', 'block', 'unblock']) })

/**
 * The owner's own decision on a payment: confirm it by hand, reject a claim,
 * withdraw a link, or stop (and allow again) card-to-card for its customer.
 */
export async function PATCH(req: Request, props: Params) {
  const { paymentId } = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const payment = await prisma.cardPayment.findFirst({ where: { id: paymentId, workspaceId: user.workspaceId }, select: { id: true } })
  if (!payment) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  if (parsed.data.action === 'block' || parsed.data.action === 'unblock') {
    const done = await setCardPayBlockForPayment(user.workspaceId, payment.id, parsed.data.action === 'block')
    return done ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'NO_CUSTOMER' }, { status: 409 })
  }
  let changed = false
  if (parsed.data.action === 'confirm') changed = (await confirmCardPayment(payment.id, 'OWNER')).changed
  else if (parsed.data.action === 'reject') changed = (await rejectCardPayment(payment.id)).changed
  else changed = (await cancelOpenCardPayments({ id: payment.id })) > 0
  if (!changed) return NextResponse.json({ error: 'ALREADY_FINAL' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
