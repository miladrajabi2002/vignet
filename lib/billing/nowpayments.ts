import crypto from 'crypto'

/**
 * NowPayments (nowpayments.io) crypto payment gateway.
 *
 * Flow: create an *invoice* (hosted payment page, customer picks the coin) →
 * customer pays → NowPayments POSTs IPN callbacks (signed with HMAC-SHA512 of
 * the sorted-key JSON body using NOWPAYMENTS_IPN_SECRET) → on
 * `finished`/`confirmed` we activate the subscription.
 *
 * Env: NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET
 */

const BASE_URL = process.env.NOWPAYMENTS_BASE_URL || 'https://api.nowpayments.io/v1'

function getApiKey(): string {
  const k = process.env.NOWPAYMENTS_API_KEY
  if (!k) throw new Error('NOWPAYMENTS_API_KEY is not set')
  return k
}

export interface NowPaymentsInvoiceResult {
  success: boolean
  invoiceUrl?: string
  invoiceId?: string
  message?: string
}

export async function createNowPaymentsInvoice(params: {
  /** Price in USD. */
  amountUsd: number
  orderId: string
  description: string
  successUrl: string
  cancelUrl: string
  ipnCallbackUrl: string
}): Promise<NowPaymentsInvoiceResult> {
  const res = await fetch(`${BASE_URL}/invoice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getApiKey(),
    },
    body: JSON.stringify({
      price_amount: params.amountUsd,
      price_currency: 'usd',
      order_id: params.orderId,
      order_description: params.description,
      ipn_callback_url: params.ipnCallbackUrl,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    }),
    cache: 'no-store',
  })

  const data = (await res.json().catch(() => null)) as {
    id?: number | string
    invoice_url?: string
    message?: string
  } | null

  if (!res.ok || !data?.invoice_url || data.id == null) {
    return { success: false, message: data?.message ?? `HTTP ${res.status}` }
  }
  return { success: true, invoiceUrl: data.invoice_url, invoiceId: String(data.id) }
}

/**
 * Verify an IPN callback signature. NowPayments signs the JSON body with the
 * keys sorted alphabetically, HMAC-SHA512, hex digest in `x-nowpayments-sig`.
 */
export function verifyNowPaymentsIpn(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET
  if (!secret || !signature) return false
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return false
  }
  const sorted = JSON.stringify(sortKeysDeep(parsed))
  const expected = crypto.createHmac('sha512', secret).update(sorted).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeysDeep((value as Record<string, unknown>)[k])]),
    )
  }
  return value
}

/** Payment statuses that mean "money received, activate the plan". */
export const NOWPAYMENTS_PAID_STATUSES = ['finished', 'confirmed'] as const
