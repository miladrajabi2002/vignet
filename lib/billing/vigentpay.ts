/**
 * Vigent's own card-to-card gateway, the only rial gateway for the site's
 * billing (plans and AI credit). It goes through the public pay API exactly
 * like any merchant site does — POST /create and /verify with a site key —
 * so the platform owner's workspace receives the transfers on its own card.
 *
 * Env: VIGENTPAY_API_KEY (a `vgp_…` site key), VIGENTPAY_CALLBACK_SECRET (the
 * site's `whs_…` secret, signs the server-to-server callback) and optionally
 * VIGENTPAY_BASE_URL (defaults to this app's own /api/pay/v1).
 * Amounts are in rials and must be whole tomans, like the pay API asks.
 */
import crypto from 'node:crypto'

/** Callbacks older than this are refused, so a captured one cannot be replayed later. */
const CALLBACK_MAX_AGE_S = 10 * 60

function baseUrl(): string {
	const explicit = process.env.VIGENTPAY_BASE_URL
	if (explicit) return explicit.replace(/\/$/, '')
	return `${(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3003').replace(/\/$/, '')}/api/pay/v1`
}

function apiKey(): string {
	const key = process.env.VIGENTPAY_API_KEY
	if (!key) throw new Error('VIGENTPAY_API_KEY is not set')
	return key
}

/** True when the rial checkout should go through Vigent's gateway. */
export function vigentPayConfigured(): boolean {
	return Boolean(process.env.VIGENTPAY_API_KEY)
}

export interface VigentPayCreateResult {
	success: boolean
	paymentLink?: string
	authority?: string
	message?: string
}

export async function createVigentPayPayment(params: {
	/** Rials; a whole toman (ends in 0). */
	amount: number
	orderId: string
	/** Server-to-server: the gateway POSTs the payment's state here, signed. */
	callbackUrl: string
	/** Where the pay page sends the customer once the payment is confirmed. */
	returnUrl: string
	description?: string
	customerPhone?: string | null
}): Promise<VigentPayCreateResult> {
	const res = await fetch(`${baseUrl()}/create`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey()}` },
		body: JSON.stringify({
			amount: Math.round(params.amount),
			order_id: params.orderId,
			callback_url: params.callbackUrl,
			return_url: params.returnUrl,
			description: params.description ?? 'خرید اشتراک ویجنت',
			...(params.customerPhone ? { customer_phone: params.customerPhone } : {}),
		}),
		cache: 'no-store',
		signal: AbortSignal.timeout(15_000),
	})
	const data = (await res.json().catch(() => null)) as { success?: boolean; payment_link?: string; authority?: string; message?: string } | null
	if (!res.ok || !data?.success || !data.payment_link || !data.authority) {
		return { success: false, message: data?.message ?? `HTTP ${res.status}` }
	}
	return { success: true, paymentLink: data.payment_link, authority: data.authority }
}

export interface VigentPayVerifyResult {
	/** Paid: 100 the first time it is asked, 101 after that. */
	success: boolean
	/** Still waiting for the transfer (-55): try again later, nothing is final. */
	pending: boolean
	code?: number
	paymentId?: string
	/** The order's own amount, rials (without the identifying tail the customer added). */
	amount?: number
	orderId?: string
	raw?: unknown
}

export async function verifyVigentPayPayment(authority: string): Promise<VigentPayVerifyResult> {
	const res = await fetch(`${baseUrl()}/verify`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey()}` },
		body: JSON.stringify({ authority }),
		cache: 'no-store',
		signal: AbortSignal.timeout(15_000),
	})
	const data = (await res.json().catch(() => null)) as {
		success?: boolean
		data?: { code?: number; transaction?: { payment_id?: string; amount?: number; order_id?: string | null } }
	} | null
	const code = data?.data?.code
	const tx = data?.data?.transaction
	if (code === -55) return { success: false, pending: true, code, raw: data }
	if (!res.ok || !data?.success || (code !== 100 && code !== 101)) return { success: false, pending: false, code, raw: data }
	return {
		success: true,
		pending: false,
		code,
		paymentId: tx?.payment_id,
		amount: tx?.amount,
		orderId: tx?.order_id ?? undefined,
		raw: data,
	}
}

/**
 * Checks the gateway's callback signature: `X-Vigent-Signature: sha256=<hex>`,
 * an HMAC of `${timestamp}.${body}` with the site secret, and a fresh
 * `X-Vigent-Timestamp`. Without a configured secret nothing passes.
 */
export function vigentPayCallbackIsGenuine(body: string, timestamp: string | null, signature: string | null, now = Date.now()): boolean {
	const secret = process.env.VIGENTPAY_CALLBACK_SECRET
	if (!secret || !timestamp || !signature?.startsWith('sha256=')) return false
	const seconds = Number(timestamp)
	if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > CALLBACK_MAX_AGE_S) return false
	const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
	const given = signature.slice('sha256='.length)
	if (given.length !== expected.length) return false
	return crypto.timingSafeEqual(Buffer.from(given, 'utf8'), Buffer.from(expected, 'utf8'))
}
