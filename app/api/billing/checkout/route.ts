import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/ratelimit'
import { getEffectivePlanDefs, isPaidPlan } from '@/lib/billing/plans'
import { createZarinPayPayment } from '@/lib/billing/zarinpay'
import { createNowPaymentsInvoice } from '@/lib/billing/nowpayments'

const bodySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('SUBSCRIPTION'),
    plan: z.enum(['STARTER', 'PRO', 'BUSINESS']),
    gateway: z.enum(['ZARINPAY', 'NOWPAYMENTS']),
  }),
  z.object({
    kind: z.literal('AI_CREDIT'),
    gateway: z.literal('ZARINPAY'),
    amountIRR: z.number().int().min(500_000).max(500_000_000),
  }),
])

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3003').replace(/\/$/, '')
}

/**
 * Start a checkout: creates a PENDING Payment row, asks the gateway for a
 * payment link and returns it for the client to redirect to.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const allowed = await rateLimit(`checkout:${user.workspaceId}`, 10, 60)
  if (!allowed) return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success || (parsed.data.kind === 'SUBSCRIPTION' && !isPaidPlan(parsed.data.plan))) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  }
  const { gateway } = parsed.data
  const plan = parsed.data.kind === 'SUBSCRIPTION' ? parsed.data.plan : null
  const def = plan ? (await getEffectivePlanDefs())[plan] : null
  const amount = parsed.data.kind === 'AI_CREDIT'
    ? parsed.data.amountIRR
    : gateway === 'ZARINPAY'
      ? def!.priceIRR
      : def!.priceUSD

  const payment = await prisma.payment.create({
    data: {
      workspaceId: user.workspaceId,
      gateway,
      kind: parsed.data.kind,
      plan,
      amount,
      currency: gateway === 'ZARINPAY' ? 'IRR' : 'USD',
    },
    select: { id: true, amount: true },
  })

  try {
    if (gateway === 'ZARINPAY') {
      const result = await createZarinPayPayment({
        amount: payment.amount,
        orderId: payment.id,
        callbackUrl: `${appUrl()}/api/billing/callback/zarinpay?pid=${payment.id}`,
        description: parsed.data.kind === 'AI_CREDIT'
          ? 'افزایش اعتبار پاسخ‌های هوش مصنوعی ویجنت'
          : `اشتراک ${plan} ویجنت — یک ماه`,
      })
      if (!result.success || !result.paymentLink) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED', callbackPayload: { message: result.message ?? null } },
        })
        return NextResponse.json({ error: 'GATEWAY_ERROR' }, { status: 502 })
      }
      await prisma.payment.update({
        where: { id: payment.id },
        data: { authority: result.authority },
      })
      return NextResponse.json({ url: result.paymentLink })
    }

    // NOWPAYMENTS
    const result = await createNowPaymentsInvoice({
      amountUsd: payment.amount,
      orderId: payment.id,
      description: `Vigent ${plan} plan — 1 month`,
      successUrl: `${appUrl()}/billing?payment=success`,
      cancelUrl: `${appUrl()}/billing?payment=cancelled`,
      ipnCallbackUrl: `${appUrl()}/api/billing/callback/nowpayments`,
    })
    if (!result.success || !result.invoiceUrl) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', callbackPayload: { message: result.message ?? null } },
      })
      return NextResponse.json({ error: 'GATEWAY_ERROR' }, { status: 502 })
    }
    await prisma.payment.update({
      where: { id: payment.id },
      data: { authority: result.invoiceId },
    })
    return NextResponse.json({ url: result.invoiceUrl })
  } catch (e) {
    console.error('[billing/checkout] gateway error:', e)
    await prisma.payment
      .update({ where: { id: payment.id }, data: { status: 'FAILED' } })
      .catch(() => {})
    return NextResponse.json({ error: 'GATEWAY_ERROR' }, { status: 502 })
  }
}
