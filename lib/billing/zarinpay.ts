/**
 * ZarinPay (zarinpay.me) rial payment gateway.
 * Docs: https://github.com/miladrajabi2002/zarinpay-doc
 *
 * Auth: `Authorization: Bearer ZARINPAY_ACCESS_TOKEN` on every call.
 * Amounts are in Iranian Rials. Payment links are valid for 30 minutes.
 */

const BASE_URL = process.env.ZARINPAY_BASE_URL || 'https://zarinpay.me/api'

function getToken(): string {
  const t = process.env.ZARINPAY_ACCESS_TOKEN
  if (!t) throw new Error('ZARINPAY_ACCESS_TOKEN is not set')
  return t
}

function getStoreId(): number {
  const raw = process.env.ZARINPAY_STORE_ID
  if (!raw) throw new Error('ZARINPAY_STORE_ID is not set')
  const id = Number.parseInt(raw, 10)
  if (!Number.isInteger(id)) throw new Error('ZARINPAY_STORE_ID must be an integer')
  return id
}

export interface ZarinPayCreateResult {
  success: boolean
  paymentLink?: string
  authority?: string
  message?: string
}

export async function createZarinPayPayment(params: {
  /** Amount in IRR (rials). Gateway minimum is 1,000 IRR. */
  amount: number
  orderId: string
  callbackUrl: string
  description?: string
}): Promise<ZarinPayCreateResult> {
  const res = await fetch(`${BASE_URL}/create-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({
      amount: Math.round(params.amount),
      store_id: getStoreId(),
      order_id: params.orderId,
      callback_url: params.callbackUrl,
      type: 'card',
      description: params.description ?? 'خرید اشتراک ویجنت',
    }),
    cache: 'no-store',
  })

  const data = (await res.json().catch(() => null)) as {
    success?: boolean
    payment_link?: string
    authority?: string
    message?: string
  } | null

  if (!res.ok || !data?.success || !data.payment_link || !data.authority) {
    return { success: false, message: data?.message ?? `HTTP ${res.status}` }
  }
  return {
    success: true,
    paymentLink: data.payment_link,
    authority: data.authority,
  }
}

export interface ZarinPayVerifyResult {
  success: boolean
  /** 100 = paid, 101 = already verified. */
  code?: number
  paymentId?: string
  amount?: number
  orderId?: string
  raw?: unknown
}

export async function verifyZarinPayPayment(
  authority: string,
): Promise<ZarinPayVerifyResult> {
  const res = await fetch(`${BASE_URL}/verify-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ authority }),
    cache: 'no-store',
  })

  const data = (await res.json().catch(() => null)) as {
    success?: boolean
    data?: {
      code?: number
      transaction?: {
        payment_id?: number | string
        amount?: number
        order_id?: string
        authority?: string
      }
    }
  } | null

  const code = data?.data?.code
  const tx = data?.data?.transaction
  if (!res.ok || !data?.success || (code !== 100 && code !== 101)) {
    return { success: false, code, raw: data }
  }
  return {
    success: true,
    code,
    paymentId: tx?.payment_id != null ? String(tx.payment_id) : undefined,
    amount: tx?.amount,
    orderId: tx?.order_id,
    raw: data,
  }
}
