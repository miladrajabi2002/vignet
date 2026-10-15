import { NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/ratelimit'
import { prisma } from '@/lib/prisma'
import { tomanToRial } from '@/lib/payments/card/amount'
import { siteFromRequest } from '@/lib/payments/card/sites'

export const dynamic = 'force-dynamic'

const schema = z.object({ authority: z.string().min(8).max(80) })

/**
 * Verify a payment (ZarinPay-compatible codes): 100 = paid, first time asked;
 * 101 = paid, already verified; -1 = failed / expired; -54 = not found;
 * -55 = still waiting for the transfer.
 */
export async function POST(req: Request) {
  const site = await siteFromRequest(req)
  if (!site) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  if (!(await rateLimit(`pay-api:${site.id}`, 240, 60))) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 })

  const payment = await prisma.cardPayment.findUnique({ where: { authority: parsed.data.authority } })
  if (!payment) return NextResponse.json({ success: false, data: { code: -54 }, message: 'Transaction not found' }, { status: 404 })
  if (payment.siteId !== site.id) return NextResponse.json({ success: false, data: { code: -53 }, message: 'Unauthorized access to transaction' }, { status: 403 })
  if (payment.status === 'PENDING' || payment.status === 'CLAIMED') return NextResponse.json({ success: false, data: { code: -55, status: payment.status.toLowerCase() } })
  if (payment.status !== 'PAID') return NextResponse.json({ success: false, data: { code: -1, status: payment.status.toLowerCase() } })

  // The first verify of a paid payment answers 100, every later one 101.
  const first = await prisma.cardPayment.updateMany({ where: { id: payment.id, verifiedAt: null }, data: { verifiedAt: new Date() } })
  const verifiedBefore = first.count === 0
  return NextResponse.json({
    success: true,
    data: {
      code: verifiedBefore ? 101 : 100,
      transaction: {
        payment_id: payment.id,
        amount: tomanToRial(payment.baseAmount),
        pay_amount: tomanToRial(payment.payAmount),
        order_id: payment.reference,
        authority: payment.authority,
        confirmed_by: (payment.confirmedBy ?? 'AUTO').toLowerCase(),
        paid_at: payment.paidAt?.toISOString() ?? null,
      },
    },
  })
}
