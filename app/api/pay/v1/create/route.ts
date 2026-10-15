import { NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/ratelimit'
import { captureError } from '@/lib/errors/capture'
import { prisma } from '@/lib/prisma'
import { rialToToman, tomanToRial } from '@/lib/payments/card/amount'
import { bankByKey, maskPan } from '@/lib/payments/card/bins'
import { siteFromRequest } from '@/lib/payments/card/sites'
import { createCardPayment, payPageUrl, readPan, type CreatePaymentError } from '@/lib/payments/card/service'

export const dynamic = 'force-dynamic'

const httpUrl = z.string().url().max(600).refine((value) => /^https?:\/\//.test(value))
const schema = z.object({
  // Rials, like ZarinPay; must be a whole toman.
  amount: z.number().int().positive(),
  order_id: z.union([z.string().min(1).max(120), z.number()]).transform(String),
  callback_url: httpUrl,
  return_url: httpUrl.optional(),
  description: z.string().max(300).optional(),
  customer_user_id: z.union([z.string().max(120), z.number()]).transform(String).optional(),
  customer_phone: z.string().max(32).optional(),
  // Also return the card so the site can show it on its own page.
  embed: z.boolean().optional(),
  type: z.string().optional(),
})

const ERRORS: Record<CreatePaymentError, [number, string]> = {
  NO_CARD: [503, 'No active card available'],
  DISABLED: [503, 'Payment gateway is turned off'],
  CAP_REACHED: [402, 'Monthly payment limit of the plan is reached'],
  AMOUNT_TOO_HIGH: [400, 'Amount is above the card-to-card limit'],
  AMOUNT_TOO_LOW: [400, 'Amount must be more than 10000 IR.'],
  NO_SLOT: [503, 'Too many open payments with this amount; try again shortly'],
  DUPLICATE_REFERENCE: [409, 'Order ID already exists'],
}

/**
 * Create a payment (ZarinPay-compatible): `amount` is in rials, the answer
 * carries `payment_link` and `authority`. `pay_amount` is what the customer
 * transfers — the order's own amount plus a 1…999 toman identifier.
 */
export async function POST(req: Request) {
  const site = await siteFromRequest(req)
  if (!site) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  if (!(await rateLimit(`pay-api:${site.id}`, 120, 60))) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid input', errors: parsed.error.flatten().fieldErrors }, { status: 400 })
  const input = parsed.data
  const baseAmount = rialToToman(input.amount)
  if (baseAmount == null) return NextResponse.json({ success: false, message: 'Amount must end in 0 (a whole toman).' }, { status: 400 })

  try {
    // A repeated order_id answers with the same open payment, like ZarinPay.
    const existing = await prisma.cardPayment.findUnique({ where: { siteId_reference: { siteId: site.id, reference: input.order_id } }, include: { card: true } })
    if (existing) {
      if (existing.status === 'PENDING' || existing.status === 'CLAIMED') return NextResponse.json(answer(existing, existing.card, Boolean(input.embed)))
      return NextResponse.json({ success: false, message: existing.status === 'EXPIRED' ? 'Previous transaction expired' : 'Order ID already exists' }, { status: existing.status === 'EXPIRED' ? 410 : 409 })
    }
    const created = await createCardPayment({
      workspaceId: site.workspaceId,
      baseAmount,
      source: 'API',
      reference: input.order_id,
      siteId: site.id,
      description: input.description ?? null,
      customerName: input.customer_user_id ?? null,
      customerPhone: input.customer_phone ?? null,
      callbackUrl: input.callback_url,
      returnUrl: input.return_url ?? null,
      ttlMinutes: 30,
    })
    if (!created.ok) {
      const [status, message] = ERRORS[created.error]
      return NextResponse.json({ success: false, message }, { status })
    }
    return NextResponse.json(answer(created.payment, created.card, Boolean(input.embed)))
  } catch (error) {
    captureError('cardpay:api-create', error, { workspaceId: site.workspaceId })
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

function answer(payment: { authority: string; baseAmount: number; payAmount: number; expiresAt: Date }, card: { bankKey: string; bin: string; last4: string; holderName: string; panEncrypted: string }, embed: boolean) {
  return {
    success: true,
    payment_link: payPageUrl(payment.authority),
    authority: payment.authority,
    amount: tomanToRial(payment.baseAmount),
    pay_amount: tomanToRial(payment.payAmount),
    expires_at: payment.expiresAt.toISOString(),
    card: {
      bank: bankByKey(card.bankKey).fa,
      holder: card.holderName,
      number: embed ? readPan(card) : maskPan(card.bin, card.last4),
    },
  }
}
