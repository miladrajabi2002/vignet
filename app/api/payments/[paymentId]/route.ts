import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { cancelOpenCardPayments, confirmCardPayment, rejectCardPayment } from '@/lib/payments/card/service'

type Params = { params: Promise<{ paymentId: string }> }

const schema = z.object({ action: z.enum(['confirm', 'reject', 'cancel']) })

/** The owner's own decision on a payment: confirm it by hand, reject a claim, or withdraw a link. */
export async function PATCH(req: Request, props: Params) {
  const { paymentId } = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const payment = await prisma.cardPayment.findFirst({ where: { id: paymentId, workspaceId: user.workspaceId }, select: { id: true } })
  if (!payment) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  let changed = false
  if (parsed.data.action === 'confirm') changed = (await confirmCardPayment(payment.id, 'OWNER')).changed
  else if (parsed.data.action === 'reject') changed = (await rejectCardPayment(payment.id)).changed
  else changed = (await cancelOpenCardPayments({ id: payment.id })) > 0
  if (!changed) return NextResponse.json({ error: 'ALREADY_FINAL' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
