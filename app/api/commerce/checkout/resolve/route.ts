import { NextResponse } from 'next/server'
import { resolveCheckoutSlug } from '@/lib/commerce/checkout-service'
import { rateLimit } from '@/lib/ratelimit'
import { getClientIp } from '@/lib/security/request-ip'
import { readBoundedRequestBody, RequestBodyTooLargeError } from '@/lib/security/request-body'

export const dynamic = 'force-dynamic'

/**
 * The WordPress plugin (5.0+) redeems an in-chat checkout link here when the
 * customer opens it on the store. The request is HMAC-signed with the store's
 * webhook secret; the answer is the cart (store product ids, quantities and
 * shipping details) — never prices, which the store computes itself.
 */
export async function POST(req: Request) {
  if (!(await rateLimit(`checkout-resolve:${getClientIp(req.headers)}`, 60, 60, { failClosed: process.env.NODE_ENV === 'production' }))) {
    return NextResponse.json({ ok: false, error: 'RATE_LIMITED' }, { status: 429 })
  }
  let rawBody: string
  try {
    rawBody = (await readBoundedRequestBody(req, 16 * 1024)).toString('utf8')
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ ok: false, error: 'TOO_LARGE' }, { status: 413 })
    throw error
  }
  const result = await resolveCheckoutSlug({
    rawBody,
    timestamp: req.headers.get('x-vigent-timestamp'),
    signature: req.headers.get('x-vigent-signature'),
  })
  return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store' } })
}
