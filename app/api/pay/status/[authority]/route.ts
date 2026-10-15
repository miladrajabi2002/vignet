import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/ratelimit'
import { corsHeaders, corsOptions } from '@/lib/cors'
import { prisma } from '@/lib/prisma'
import { readPayGatewaySettings } from '@/lib/payments/card/settings'
import { claimCardPayment } from '@/lib/payments/card/service'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ authority: string }> }

async function load(authority: string) {
  if (!/^[\w-]{8,80}$/.test(authority)) return null
  return prisma.cardPayment.findUnique({
    where: { authority },
    select: { id: true, status: true, expiresAt: true, returnUrl: true, authority: true, reference: true, source: true, workspace: { select: { payGatewaySettings: true } } },
  })
}

function body(payment: NonNullable<Awaited<ReturnType<typeof load>>>) {
  return {
    status: payment.status,
    expiresAt: payment.expiresAt.toISOString(),
    // Where the customer goes back to once the payment is final (API payments).
    returnUrl: payment.status === 'PAID' && payment.returnUrl ? payment.returnUrl : null,
  }
}

/** Live state of a payment for the card in chat and the payment page. Never returns the card number. */
export async function GET(_req: Request, props: Params) {
  const { authority } = await props.params
  if (!(await rateLimit(`pay-status:${authority}`, 90, 60))) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 })
  const payment = await load(authority)
  if (!payment) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json(body(payment), { headers: { ...corsHeaders, 'Cache-Control': 'no-store' } })
}

// The web widget asks from the customer's own site.
export function OPTIONS() {
  return corsOptions()
}

/** «پرداخت کردم»: the payment goes to the owner's review. It never confirms anything by itself. */
export async function POST(_req: Request, props: Params) {
  const { authority } = await props.params
  if (!(await rateLimit(`pay-claim:${authority}`, 6, 600, { failClosed: true }))) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 })
  const payment = await load(authority)
  if (!payment) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (!readPayGatewaySettings(payment.workspace.payGatewaySettings).manualClaim) return NextResponse.json({ error: 'CLAIM_DISABLED' }, { status: 403 })
  if (payment.status === 'PENDING') await claimCardPayment(payment.id, { tellCustomer: true })
  const fresh = await load(authority)
  return NextResponse.json(fresh ? body(fresh) : { error: 'NOT_FOUND' }, { headers: { ...corsHeaders, 'Cache-Control': 'no-store' } })
}
