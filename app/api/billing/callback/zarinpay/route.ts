import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyZarinPayPayment } from '@/lib/billing/zarinpay'
import { activateSubscription } from '@/lib/billing/entitlements'
import { isPaidPlan } from '@/lib/billing/plans'
import type { Prisma } from '@prisma/client'

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3003').replace(/\/$/, '')
}

/**
 * ZarinPay return URL. We passed `?pid=<paymentId>` in the callback URL at
 * checkout, so verification uses our stored authority — nothing from the
 * query string is trusted beyond the payment lookup.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const pid = url.searchParams.get('pid')
  const to = (status: string) =>
    NextResponse.redirect(`${appUrl()}/billing?payment=${status}`)

  if (!pid) return to('failed')

  const payment = await prisma.payment.findUnique({
    where: { id: pid },
    select: {
      id: true,
      workspaceId: true,
      gateway: true,
      plan: true,
      amount: true,
      status: true,
      authority: true,
    },
  })
  if (!payment || payment.gateway !== 'ZARINPAY' || !payment.authority) {
    return to('failed')
  }
  // Idempotent: refreshing the callback page must not double-extend.
  if (payment.status === 'PAID') return to('success')
  if (payment.status !== 'PENDING') return to('failed')

  const verify = await verifyZarinPayPayment(payment.authority).catch(() => null)
  if (!verify?.success) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        callbackPayload: (verify?.raw ?? null) as Prisma.InputJsonValue,
      },
    })
    return to('failed')
  }

  // Defense in depth: the verified amount must match what we charged.
  if (verify.amount != null && Math.round(verify.amount) !== Math.round(payment.amount)) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', callbackPayload: verify.raw as Prisma.InputJsonValue },
    })
    return to('failed')
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      externalId: verify.paymentId,
      callbackPayload: verify.raw as Prisma.InputJsonValue,
    },
  })

  if (isPaidPlan(payment.plan)) {
    await activateSubscription({
      workspaceId: payment.workspaceId,
      plan: payment.plan,
      monthlyPrice: payment.amount,
      currency: 'IRR',
    })
  }

  return to('success')
}
