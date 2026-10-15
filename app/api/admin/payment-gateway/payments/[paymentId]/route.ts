import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminAuthed } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { cancelOpenCardPayments, confirmCardPayment, rejectCardPayment, sendPaymentCallback } from '@/lib/payments/card/service'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ paymentId: string }> }

const schema = z.object({ action: z.enum(['confirm', 'reject', 'cancel', 'callback']) })

/** Support acting on one payment: confirm or reject for the owner, withdraw it, or resend the site callback. */
export async function POST(req: Request, props: Params) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const { paymentId } = await props.params
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const payment = await prisma.cardPayment.findUnique({ where: { id: paymentId }, select: { id: true, callbackUrl: true } })
  if (!payment) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const action = parsed.data.action
  if (action === 'callback') {
    if (!payment.callbackUrl) return NextResponse.json({ error: 'NO_CALLBACK' }, { status: 400 })
    // A finished retry schedule starts over from this attempt.
    await prisma.cardPayment.update({ where: { id: payment.id }, data: { callbackDoneAt: null, callbackTries: 0 } })
    const result = await sendPaymentCallback(payment.id)
    return NextResponse.json({ ok: result === 'sent', result })
  }
  let changed = false
  if (action === 'confirm') changed = (await confirmCardPayment(payment.id, 'ADMIN')).changed
  else if (action === 'reject') changed = (await rejectCardPayment(payment.id)).changed
  else changed = (await cancelOpenCardPayments({ id: payment.id })) > 0
  if (!changed) return NextResponse.json({ error: 'ALREADY_FINAL' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
