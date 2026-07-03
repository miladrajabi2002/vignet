import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  verifyNowPaymentsIpn,
  NOWPAYMENTS_PAID_STATUSES,
} from '@/lib/billing/nowpayments'
import { activateSubscription } from '@/lib/billing/entitlements'
import { isPaidPlan } from '@/lib/billing/plans'
import type { Prisma } from '@prisma/client'

/**
 * NowPayments IPN webhook. Signature = HMAC-SHA512 (sorted-key JSON body,
 * NOWPAYMENTS_IPN_SECRET) in the `x-nowpayments-sig` header. `order_id` is our
 * Payment id (set at checkout).
 */
export async function POST(req: Request) {
  const rawBody = await req.text()
  const sig = req.headers.get('x-nowpayments-sig')

  if (!verifyNowPaymentsIpn(rawBody, sig)) {
    return NextResponse.json({ error: 'BAD_SIGNATURE' }, { status: 401 })
  }

  let body: {
    payment_id?: number | string
    payment_status?: string
    order_id?: string
    price_amount?: number
  }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  }

  const orderId = body.order_id
  const status = body.payment_status ?? ''
  if (!orderId) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const payment = await prisma.payment.findUnique({
    where: { id: orderId },
    select: { id: true, workspaceId: true, gateway: true, plan: true, amount: true, status: true },
  })
  if (!payment || payment.gateway !== 'NOWPAYMENTS') {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  // Idempotent: IPNs are retried and arrive for each status transition.
  if (payment.status === 'PAID') return NextResponse.json({ ok: true })

  if ((NOWPAYMENTS_PAID_STATUSES as readonly string[]).includes(status)) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        externalId: body.payment_id != null ? String(body.payment_id) : undefined,
        callbackPayload: JSON.parse(rawBody) as Prisma.InputJsonValue,
      },
    })
    if (isPaidPlan(payment.plan)) {
      await activateSubscription({
        workspaceId: payment.workspaceId,
        plan: payment.plan,
        monthlyPrice: payment.amount,
        currency: 'USD',
      })
    }
  } else if (status === 'failed' || status === 'refunded' || status === 'expired') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: status === 'expired' ? 'EXPIRED' : 'FAILED',
        callbackPayload: JSON.parse(rawBody) as Prisma.InputJsonValue,
      },
    })
  }
  // partially_paid / waiting / confirming → keep PENDING.

  return NextResponse.json({ ok: true })
}
