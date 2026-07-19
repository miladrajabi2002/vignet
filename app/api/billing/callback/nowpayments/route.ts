import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  verifyNowPaymentsIpn,
  NOWPAYMENTS_PAID_STATUSES,
} from '@/lib/billing/nowpayments'
import { activateSubscriptionPayment } from '@/lib/billing/entitlements'
import { isPaidPlan } from '@/lib/billing/plans'
import type { Prisma } from '@prisma/client'
import {
  readBoundedRequestBody,
  RequestBodyTooLargeError,
} from '@/lib/security/request-body'

const MAX_IPN_BYTES = 64 * 1024

/**
 * NowPayments IPN webhook. Signature = HMAC-SHA512 (sorted-key JSON body,
 * NOWPAYMENTS_IPN_SECRET) in the `x-nowpayments-sig` header. `order_id` is our
 * Payment id (set at checkout).
 */
export async function POST(req: Request) {
  let rawBody: string
  try {
    rawBody = (await readBoundedRequestBody(req, MAX_IPN_BYTES)).toString('utf8')
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
    }
    throw error
  }
  const sig = req.headers.get('x-nowpayments-sig')

  if (!verifyNowPaymentsIpn(rawBody, sig)) {
    return NextResponse.json({ error: 'BAD_SIGNATURE' }, { status: 401 })
  }

  let body: {
    payment_id?: number | string
    payment_status?: string
    order_id?: string
    price_amount?: number
    price_currency?: string
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
    select: {
      id: true,
      workspaceId: true,
      gateway: true,
      kind: true,
      plan: true,
      amount: true,
      status: true,
    },
  })
  if (!payment || payment.gateway !== 'NOWPAYMENTS') {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  // Idempotent: IPNs are retried and arrive for each status transition.
  if (payment.status === 'PAID') return NextResponse.json({ ok: true })

  if ((NOWPAYMENTS_PAID_STATUSES as readonly string[]).includes(status)) {
    if (
      payment.kind !== 'SUBSCRIPTION' ||
      !payment.plan ||
      !isPaidPlan(payment.plan) ||
      typeof body.price_amount !== 'number' ||
      !Number.isFinite(body.price_amount) ||
      Math.abs(body.price_amount - payment.amount) > 0.01 ||
      body.price_currency?.toLowerCase() !== 'usd'
    ) {
      await prisma.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: {
          status: 'FAILED',
          callbackPayload: JSON.parse(rawBody) as Prisma.InputJsonValue,
        },
      })
      return NextResponse.json({ error: 'PAYMENT_MISMATCH' }, { status: 400 })
    }
    await activateSubscriptionPayment({
      paymentId: payment.id,
      workspaceId: payment.workspaceId,
      plan: payment.plan,
      monthlyPrice: payment.amount,
      currency: 'USD',
      paymentUpdate: {
        status: 'PAID',
        paidAt: new Date(),
        externalId: body.payment_id != null ? String(body.payment_id) : undefined,
        callbackPayload: JSON.parse(rawBody) as Prisma.InputJsonValue,
      },
    })
  } else if (status === 'failed' || status === 'refunded' || status === 'expired') {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: {
        status: status === 'expired' ? 'EXPIRED' : 'FAILED',
        callbackPayload: JSON.parse(rawBody) as Prisma.InputJsonValue,
      },
    })
  }
  // partially_paid / waiting / confirming → keep PENDING.

  return NextResponse.json({ ok: true })
}
