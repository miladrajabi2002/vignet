/**
 * Signed calls from Vigent to the WordPress plugin's checkout REST API
 * (vigent-woo 5.0+): live quotes, order status and cancellation.
 *
 * These calls are an optimisation, never a dependency: many Iranian hosts and
 * WAFs block server-to-server requests to wp-json, so every caller has a
 * fallback (the payment link itself works without any inbound request).
 */
import { safeHttpPost } from '@/lib/security/safe-http'
import { signPayload, type StoreQuote } from '@/lib/commerce/checkout-link'

export interface StoreEndpoint {
  storeUrl: string
  webhookSecret: string
}

export type StoreRoute = 'quote' | 'status' | 'cancel' | 'capabilities'

export class StoreApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'StoreApiError'
  }
}

export const STORE_CHECKOUT_DISABLED = 'STORE_CHECKOUT_DISABLED'

function base(storeUrl: string): string {
  return storeUrl.replace(/\/+$/, '')
}

async function postSigned(url: string, secret: string, body: string, timeoutMs: number) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  return safeHttpPost(url, body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      'User-Agent': 'VigentCheckout/1.0',
      'X-Vigent-Timestamp': timestamp,
      'X-Vigent-Signature': signPayload(secret, timestamp, body),
    },
    timeoutMs,
    maxBytes: 512 * 1024,
    maxRedirects: 2,
    allowedContentTypes: ['application/json'],
  })
}

/**
 * POST a signed JSON body to /wp-json/vigent-woo/v1/checkout/<route>. Sites
 * without pretty permalinks answer 404 there, so the ?rest_route= form is
 * tried once before giving up.
 */
export async function callStore<T>(endpoint: StoreEndpoint, route: StoreRoute, payload: unknown, timeoutMs = 8_000): Promise<T> {
  const body = JSON.stringify(payload ?? {})
  const path = `/vigent-woo/v1/checkout/${route}`
  const urls = [`${base(endpoint.storeUrl)}/wp-json${path}`, `${base(endpoint.storeUrl)}/?rest_route=${encodeURIComponent(path)}`]
  let last: StoreApiError | null = null
  for (const url of urls) {
    let response
    try {
      response = await postSigned(url, endpoint.webhookSecret, body, timeoutMs)
    } catch (error) {
      last = new StoreApiError(error instanceof Error ? error.message : String(error), 0)
      break // Network/TLS/WAF failure: the alternate URL will not fare better.
    }
    if (response.status === 404) {
      last = new StoreApiError('STORE_ROUTE_NOT_FOUND', 404)
      continue
    }
    if (response.status < 200 || response.status >= 300) {
      // A WAF can answer 403 too; only the plugin's own JSON error code means
      // the store owner switched checkout off (or WooCommerce is too old).
      if (response.status === 403 && /"code"\s*:\s*"vigent_checkout_disabled"/.test(response.body.toString('utf8'))) {
        throw new StoreApiError(STORE_CHECKOUT_DISABLED, 403)
      }
      throw new StoreApiError(`STORE_HTTP_${response.status}`, response.status)
    }
    try {
      return JSON.parse(response.body.toString('utf8')) as T
    } catch {
      throw new StoreApiError('STORE_BAD_JSON', response.status)
    }
  }
  throw last ?? new StoreApiError('STORE_UNREACHABLE', 0)
}

export interface QuoteRequest {
  items: Array<{ product_id: number; variation_id: number; quantity: number; name: string }>
  customer: Record<string, string>
  coupons: string[]
  shipping_rate_id?: string | null
}

export function quoteStore(endpoint: StoreEndpoint, request: QuoteRequest): Promise<StoreQuote> {
  return callStore<StoreQuote>(endpoint, 'quote', request)
}

export interface StoreCheckoutStatus {
  ok: boolean
  found: boolean
  cart_code?: string
  order_id?: number
  order_number?: string
  status?: string
  paid?: boolean
  total?: number
  shipping_total?: number
  discount_total?: number
  payment_method_title?: string
  payment_url?: string
  date_paid?: string | null
}

export function storeCheckoutStatus(endpoint: StoreEndpoint, code: string): Promise<StoreCheckoutStatus> {
  return callStore<StoreCheckoutStatus>(endpoint, 'status', { code }, 6_000)
}

export function cancelStoreCheckout(endpoint: StoreEndpoint, code: string): Promise<{ ok: boolean; found: boolean; status: string | null }> {
  return callStore(endpoint, 'cancel', { code }, 6_000)
}

export function storeCapabilities(endpoint: StoreEndpoint): Promise<Record<string, unknown>> {
  return callStore(endpoint, 'capabilities', {}, 8_000)
}
