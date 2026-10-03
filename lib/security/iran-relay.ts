import { createHmac, randomUUID } from 'node:crypto'
import type http from 'node:http'

/**
 * Client for the Iran relay (deploy/iran-relay/relay.php).
 *
 * The app server is hosted abroad; Iranian shop sites sometimes refuse foreign
 * IPs, and during national-internet cutoffs only Iran→Iran traffic works. The
 * relay runs on Iranian cPanel hosting and performs the request from inside
 * Iran. `safeHttpGet`/`safeHttpPost` route through it according to
 * IRAN_RELAY_MODE:
 *
 *   off       never (default when IRAN_RELAY_URL/SECRET are missing)
 *   fallback  direct first; on a network-level failure retry via the relay and
 *             keep that host on the relay for {@link STICKY_MS}
 *   always    `.ir` hosts, IRAN_RELAY_HOSTS and sticky hosts go straight to
 *             the relay (emergency switch for cutoffs); others stay direct
 */

export type IranRelayMode = 'off' | 'fallback' | 'always'

export interface RelayResponse {
  status: number
  headers: http.IncomingHttpHeaders
  body: Buffer
  url: string
}

const STICKY_MS = 30 * 60 * 1000
const RELAY_OVERHEAD_MS = 5_000
const stickyHosts = new Map<string, number>()

interface RelayConfig {
  url: string
  secret: string
  mode: IranRelayMode
}

function relayConfig(): RelayConfig | null {
  const url = process.env.IRAN_RELAY_URL?.trim()
  const secret = process.env.IRAN_RELAY_SECRET?.trim()
  if (!url || !secret) return null
  const raw = process.env.IRAN_RELAY_MODE?.trim().toLowerCase()
  const mode: IranRelayMode = raw === 'off' || raw === 'always' ? raw : 'fallback'
  return { url, secret, mode }
}

export function iranRelayMode(): IranRelayMode {
  return relayConfig()?.mode ?? 'off'
}

function extraRelayHosts(): string[] {
  return (process.env.IRAN_RELAY_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase().replace(/^\./, ''))
    .filter(Boolean)
}

function matchesSuffix(hostname: string, suffix: string): boolean {
  return hostname === suffix || hostname.endsWith(`.${suffix}`)
}

function isSticky(hostname: string): boolean {
  const until = stickyHosts.get(hostname)
  if (!until) return false
  if (until < Date.now()) {
    stickyHosts.delete(hostname)
    return false
  }
  return true
}

/** Remember that `hostname` is only reachable through the relay. */
export function markRelayHost(hostname: string): void {
  stickyHosts.set(hostname.toLowerCase(), Date.now() + STICKY_MS)
}

/** True when a request to `hostname` should skip the direct attempt. */
export function shouldRelayFirst(hostname: string): boolean {
  const config = relayConfig()
  if (!config || config.mode === 'off') return false
  const host = hostname.toLowerCase()
  if (isSticky(host)) return true
  if (config.mode !== 'always') return false
  return host.endsWith('.ir') || extraRelayHosts().some((suffix) => matchesSuffix(host, suffix))
}

/** True when a failed direct attempt may be retried through the relay. */
export function canRelayAfterFailure(): boolean {
  const config = relayConfig()
  return !!config && config.mode !== 'off'
}

/**
 * Connection-level failures (the host dropped or refused us) — the pattern of
 * foreign-IP blocks and cutoffs. HTTP responses, SSRF refusals and size or
 * content-type violations are NOT relayed: the relay would see the same.
 */
export function isRelayableNetworkError(error: unknown): boolean {
  const code = (error as { code?: string })?.code ?? ''
  const message = (error as Error)?.message ?? ''
  return (
    message === 'HTTP_REQUEST_TIMEOUT' ||
    [
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'EHOSTUNREACH',
      'ENETUNREACH',
      'EAI_AGAIN',
      'ENOTFOUND',
      'EPIPE',
      'UND_ERR_CONNECT_TIMEOUT',
      'ERR_SSL_WRONG_VERSION_NUMBER',
    ].includes(code) ||
    /socket hang up|ECONNRESET|ETIMEDOUT/i.test(message)
  )
}

function sign(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

async function callRelay(
  config: RelayConfig,
  payload: Record<string, unknown>,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const body = JSON.stringify({ nonce: randomUUID(), ...payload })
  const timestamp = String(Math.floor(Date.now() / 1000))
  const res = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Relay-Timestamp': timestamp,
      'X-Relay-Signature': sign(config.secret, timestamp, body),
    },
    body,
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  })
  const text = await res.text()
  let json: Record<string, unknown>
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`IRAN_RELAY_BAD_RESPONSE (HTTP ${res.status})`)
  }
  if (!res.ok || json.ok !== true) {
    const reason = typeof json.error === 'string' ? json.error : `HTTP ${res.status}`
    throw new Error(`IRAN_RELAY_${reason.toUpperCase().replace(/^RELAY_/, '')}`)
  }
  return json
}

/** Perform one HTTP hop (no redirect following) through the relay. */
export async function relayHttpRequest(args: {
  url: string
  method: 'GET' | 'POST'
  headers: Record<string, string>
  body?: Buffer
  timeoutMs: number
  maxBytes: number
}): Promise<RelayResponse> {
  const config = relayConfig()
  if (!config || config.mode === 'off') throw new Error('IRAN_RELAY_NOT_CONFIGURED')
  const json = await callRelay(
    config,
    {
      method: args.method,
      url: args.url,
      headers: args.headers,
      body: args.body ? args.body.toString('base64') : null,
      timeoutMs: args.timeoutMs,
      maxBytes: args.maxBytes,
    },
    args.timeoutMs + RELAY_OVERHEAD_MS,
  )
  const body = Buffer.from(typeof json.body === 'string' ? json.body : '', 'base64')
  if (body.byteLength > args.maxBytes) throw new Error('HTTP_RESPONSE_TOO_LARGE')
  const headers = (json.headers && typeof json.headers === 'object' ? json.headers : {}) as http.IncomingHttpHeaders
  return {
    status: Number(json.status) || 0,
    headers,
    body,
    url: args.url,
  }
}

export interface IranRelayHealth {
  state: 'healthy' | 'down' | 'unconfigured'
  latencyMs: number | null
  detail: string
  mode: IranRelayMode
}

const RELAY_ERROR_HINTS: Record<string, string> = {
  IRAN_RELAY_NOT_CONFIGURED: 'RELAY_SECRET داخل فایل روی هاست ایران هنوز مقدار پیش‌فرض است',
  IRAN_RELAY_BAD_SIGNATURE: 'RELAY_SECRET روی هاست با IRAN_RELAY_SECRET سرور یکی نیست',
  IRAN_RELAY_STALE_REQUEST: 'ساعت هاست ایران با سرور بیش از ۵ دقیقه اختلاف دارد',
}

/** Signed PING — proves the relay is reachable and shares our secret. */
export async function iranRelayHealth(): Promise<IranRelayHealth> {
  const config = relayConfig()
  if (!config) {
    return { state: 'unconfigured', latencyMs: null, detail: 'IRAN_RELAY_URL / IRAN_RELAY_SECRET تنظیم نشده است', mode: 'off' }
  }
  const modeLabel = config.mode === 'always' ? 'همیشه برای دامنه‌های ایرانی' : config.mode === 'fallback' ? 'پشتیبان هنگام خطا' : 'خاموش'
  const started = Date.now()
  try {
    await callRelay(config, { method: 'PING' }, 6_000)
    const sticky = [...stickyHosts.keys()].filter(isSticky).length
    return {
      state: 'healthy',
      latencyMs: Date.now() - started,
      detail: `حالت: ${modeLabel}${sticky ? ` · ${sticky.toLocaleString('fa-IR')} دامنه از مسیر رله` : ''}`,
      mode: config.mode,
    }
  } catch (error) {
    const message = (error as Error).message
    return {
      state: 'down',
      latencyMs: Date.now() - started,
      detail: RELAY_ERROR_HINTS[message] ?? `رله پاسخ نداد (${message.slice(0, 80)})`,
      mode: config.mode,
    }
  }
}
