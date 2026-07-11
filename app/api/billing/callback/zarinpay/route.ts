import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyZarinPayPayment } from '@/lib/billing/zarinpay'
import { activateSubscriptionPayment } from '@/lib/billing/entitlements'
import { isPaidPlan } from '@/lib/billing/plans'
import type { Prisma } from '@prisma/client'

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3003').replace(/\/$/, '')
}

/**
 * ZarinPay return URL. We passed `?pid=<paymentId>` in the callback URL at
 * checkout, so verification uses our stored authority — nothing from the
 * request is trusted beyond the payment lookup.
 *
 * ZarinPay delivers the callback as a POST (`{ authority, order_id }` body),
 * so both handlers share one implementation. When arriving via POST we redirect
 * with 303 so the browser follows up with a GET to /billing.
 */
export async function GET(req: Request) {
  return handleCallback(req, false)
}

export async function POST(req: Request) {
  return handleCallback(req, true)
}

async function readPid(req: Request): Promise<string | null> {
  const url = new URL(req.url)
  const fromQuery = url.searchParams.get('pid')
  if (fromQuery) return fromQuery

  // Fallback: ZarinPay's POST body carries order_id, which is our payment id.
  const ct = req.headers.get('content-type') ?? ''
  try {
    if (ct.includes('application/json')) {
      const body = (await req.json().catch(() => null)) as { order_id?: unknown } | null
      const oid = body?.order_id
      return typeof oid === 'string' && oid ? oid : null
    }
    if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
      const form = await req.formData().catch(() => null)
      const oid = form?.get('order_id')
      return typeof oid === 'string' && oid ? oid : null
    }
  } catch {
    return null
  }
  return null
}

async function handleCallback(req: Request, isPost: boolean) {
  const pid = await readPid(req)
  const to = (status: string) =>
    NextResponse.redirect(`${appUrl()}/billing?payment=${status}`, isPost ? 303 : 307)

  if (!pid) return to('failed')

  const payment = await prisma.payment.findUnique({
    where: { id: pid },
    select: {
      id: true,
      workspaceId: true,
      gateway: true,
      plan: true,
      kind: true,
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

  if (payment.kind === 'AI_CREDIT') {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          externalId: verify.paymentId,
          callbackPayload: verify.raw as Prisma.InputJsonValue,
        },
      })
      if (claimed.count !== 1) return

      const workspace = await tx.workspace.update({
        where: { id: payment.workspaceId },
        data: { aiCreditBalanceIRR: { increment: Math.round(payment.amount) } },
        select: { aiCreditBalanceIRR: true },
      })
      await tx.walletLedger.create({
        data: {
          workspaceId: payment.workspaceId,
          paymentId: payment.id,
          type: 'CREDIT_TOPUP',
          amountIRR: Math.round(payment.amount),
          balanceAfterIRR: workspace.aiCreditBalanceIRR,
          note: 'ZarinPay AI credit top-up',
        },
      })
    })
    return to('success')
  }

  if (payment.kind !== 'SUBSCRIPTION' || !payment.plan || !isPaidPlan(payment.plan)) {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { status: 'FAILED', callbackPayload: verify.raw as Prisma.InputJsonValue },
    })
    return to('failed')
  }

  await activateSubscriptionPayment({
    paymentId: payment.id,
    workspaceId: payment.workspaceId,
    plan: payment.plan,
    monthlyPrice: payment.amount,
    currency: 'IRR',
    paymentUpdate: {
      status: 'PAID',
      paidAt: new Date(),
      externalId: verify.paymentId,
      callbackPayload: verify.raw as Prisma.InputJsonValue,
    },
  })

  return to('success')
}
