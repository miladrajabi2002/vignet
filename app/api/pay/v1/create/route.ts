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

/**
 * Every refusal names itself: `code` for the site's own logic, `message` in
 * English (ZarinPay style) and `message_fa` ready to show a Persian customer.
 * Amount limits come back in rials, like `amount`.
 */
const ERRORS: Record<CreatePaymentError, { status: number; message: (limit?: number) => string; fa: (limit?: number) => string }> = {
  NO_CARD: { status: 503, message: () => 'No active card is available on the gateway.', fa: () => 'کارت فعالی روی درگاه نیست.' },
  DISABLED: { status: 503, message: () => 'The payment gateway is turned off.', fa: () => 'درگاه پرداخت خاموش است.' },
  CAP_REACHED: { status: 402, message: () => 'The monthly payment limit of the plan is reached.', fa: () => 'سقف پرداخت‌های ماهانهٔ پلن پر شده است.' },
  AMOUNT_TOO_HIGH: {
    status: 400,
    message: (limit) => limit ? `amount is above the card-to-card ceiling of ${tomanToRial(limit)} rials.` : 'amount is above the card-to-card ceiling.',
    fa: (limit) => limit ? `مبلغ از سقف کارت‌به‌کارت (${limit.toLocaleString('fa-IR')} تومان) بیشتر است.` : 'مبلغ از سقف کارت‌به‌کارت بیشتر است.',
  },
  AMOUNT_TOO_LOW: {
    status: 400,
    message: (limit) => `amount is below the minimum of ${tomanToRial(limit ?? 1_000)} rials (${(limit ?? 1_000)} toman).`,
    fa: (limit) => `مبلغ کمتر از حداقل است؛ کارت‌به‌کارت دست‌کم ${(limit ?? 1_000).toLocaleString('fa-IR')} تومان است.`,
  },
  NO_SLOT: { status: 503, message: () => 'Too many open payments with this amount; try again shortly.', fa: () => 'پرداخت‌های باز زیادی با همین مبلغ هست؛ چند دقیقهٔ دیگر دوباره تلاش کنید.' },
  DUPLICATE_REFERENCE: { status: 409, message: () => 'order_id already exists.', fa: () => 'این شمارهٔ سفارش قبلاً ثبت شده است.' },
}

function refuse(status: number, code: string, message: string, messageFa: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ success: false, code, message, message_fa: messageFa, ...extra }, { status })
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
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors
    if (errors.amount) return refuse(400, 'AMOUNT_INVALID', 'amount must be a positive whole number of rials.', 'مبلغ باید عددی مثبت و به ریال باشد.', { errors })
    return refuse(400, 'INVALID_INPUT', `Invalid input: ${Object.keys(errors).join(', ')}.`, 'ورودی نامعتبر است.', { errors })
  }
  const input = parsed.data
  const baseAmount = rialToToman(input.amount)
  if (baseAmount == null) return refuse(400, 'AMOUNT_NOT_WHOLE_TOMAN', 'amount must end in 0 (a whole toman).', 'مبلغ ریالی باید به صفر ختم شود (تومان کامل).')

  try {
    // A repeated order_id answers with the same open payment, like ZarinPay.
    const existing = await prisma.cardPayment.findUnique({ where: { siteId_reference: { siteId: site.id, reference: input.order_id } }, include: { card: true } })
    if (existing) {
      if (existing.status === 'PENDING' || existing.status === 'CLAIMED') return NextResponse.json(answer(existing, existing.card, Boolean(input.embed)))
      return existing.status === 'EXPIRED'
        ? refuse(410, 'EXPIRED', 'The previous payment for this order_id expired; send a new order_id.', 'پرداخت قبلی این سفارش منقضی شده است؛ با شمارهٔ سفارش تازه بسازید.')
        : refuse(409, 'DUPLICATE_REFERENCE', ERRORS.DUPLICATE_REFERENCE.message(), ERRORS.DUPLICATE_REFERENCE.fa())
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
    })
    if (!created.ok) {
      const error = ERRORS[created.error]
      const limit = created.limit
      const bounds = created.error === 'AMOUNT_TOO_LOW' && limit ? { min_amount: tomanToRial(limit) } : created.error === 'AMOUNT_TOO_HIGH' && limit ? { max_amount: tomanToRial(limit) } : {}
      return refuse(error.status, created.error, error.message(limit), error.fa(limit), bounds)
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
