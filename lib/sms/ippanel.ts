import { getRedis } from '@/lib/redis'
import { normalizePhone } from '@/lib/phone'

/**
 * IPPanel Edge API (https://docs.ippanel.com/docs/).
 * All sends go through a single endpoint; `sending_type` selects the mode:
 *  - "pattern"    → pre-approved template with variables (used for OTP)
 *  - "webservice" → free-form message (used for notifications)
 * Auth is the panel API key / token in the `Authorization` header.
 *
 * IPPanel only accepts requests from an Iranian IP, but the app server is
 * hosted abroad — so sends go through a small PHP proxy on Iranian hosting
 * (see deploy/ippanel-proxy/index.php) instead of calling IPPanel directly.
 * The proxy holds the real IPPANEL_API_KEY; this app only needs
 * IPPANEL_PROXY_URL + IPPANEL_PROXY_SECRET.
 */
const IPPANEL_SEND_URL = 'https://edge.ippanel.com/v1/api/send'

const OTP_TTL_SECONDS = 300 // 5 minutes
const RATE_WINDOW_SECONDS = 3600 // 1 hour
const RATE_MAX = 3 // max 3 OTPs per phone per hour

export class OtpRateLimitError extends Error {
  constructor() {
    super('OTP_RATE_LIMIT')
    this.name = 'OtpRateLimitError'
  }
}

/** Generate a 6-digit OTP code. */
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

interface IppanelMeta {
  status: boolean
  message?: string
  message_code?: string
}

/** True once either a direct API key or the Iranian proxy is configured. */
function isSmsConfigured(): boolean {
  return Boolean(process.env.IPPANEL_PROXY_URL || process.env.IPPANEL_API_KEY)
}

async function ippanelSend(body: Record<string, unknown>): Promise<boolean> {
  const proxyUrl = process.env.IPPANEL_PROXY_URL
  const apiKey = process.env.IPPANEL_API_KEY

  let url: string
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }

  if (proxyUrl) {
    url = proxyUrl
    const proxySecret = process.env.IPPANEL_PROXY_SECRET
    if (proxySecret) headers['X-Proxy-Secret'] = proxySecret
  } else if (apiKey) {
    url = IPPANEL_SEND_URL
    headers.Authorization = apiKey
  } else {
    return false
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error(`[ippanel] send failed (${res.status}): ${text}`)
    return false
  }

  const json = (await res.json().catch(() => null)) as { meta?: IppanelMeta } | null
  if (json?.meta && json.meta.status !== true) {
    console.error(
      `[ippanel] send rejected (${json.meta.message_code ?? '?'}): ${json.meta.message ?? ''}`,
    )
    return false
  }
  return true
}

/**
 * Send a 6-digit OTP via an IPPanel pattern. Stores the code in Redis (TTL 5m)
 * and rate-limits to 3 per hour per phone.
 *
 * Requires (IPPANEL_API_KEY or IPPANEL_PROXY_URL), IPPANEL_PATTERN_CODE and
 * IPPANEL_FROM_NUMBER. The pattern must contain a `code` variable (e.g.
 * "کد ورود شما: %code%").
 *
 * In dev (neither IPPANEL_API_KEY nor IPPANEL_PROXY_URL set), the code is
 * logged to the server console instead of being sent, so local auth works
 * without an SMS provider.
 */
export async function sendOTP(mobile: string): Promise<void> {
  const normalized = normalizePhone(mobile)
  if (!normalized) throw new Error('INVALID_PHONE')

  const redis = getRedis()

  const rateLimitKey = `otp_rate:${normalized}`
  const attempts = await redis.incr(rateLimitKey)
  if (attempts === 1) await redis.expire(rateLimitKey, RATE_WINDOW_SECONDS)
  if (attempts > RATE_MAX) throw new OtpRateLimitError()

  const code = generateCode()
  await redis.set(`otp:${normalized}`, code, 'EX', OTP_TTL_SECONDS)

  const patternCode = process.env.IPPANEL_PATTERN_CODE
  const fromNumber = process.env.IPPANEL_FROM_NUMBER

  if (!isSmsConfigured()) {
    // Dev fallback — no SMS provider configured at all.
    console.warn(
      `[ippanel] DEV MODE — IPPANEL_API_KEY/IPPANEL_PROXY_URL not set. OTP for ${normalized} is: ${code}`,
    )
    return
  }

  // API key is set → we're meant to send real SMS. Missing pattern/sender is a
  // misconfiguration, not dev mode — fail loudly instead of leaking the OTP.
  const missing = [
    !patternCode && 'IPPANEL_PATTERN_CODE',
    !fromNumber && 'IPPANEL_FROM_NUMBER',
  ].filter(Boolean)
  if (missing.length) {
    console.error(`[ippanel] cannot send OTP — missing env: ${missing.join(', ')}`)
    throw new Error('SMS_FAILED')
  }

  const ok = await ippanelSend({
    sending_type: 'pattern',
    from_number: fromNumber,
    code: patternCode,
    recipients: [normalized],
    params: { code },
  })
  if (!ok) throw new Error('SMS_FAILED')
}

/**
 * Send a free-form SMS via IPPanel's webservice mode (used for notifications,
 * not OTP). Requires (IPPANEL_API_KEY or IPPANEL_PROXY_URL) and
 * IPPANEL_FROM_NUMBER. In dev (neither set) the message is logged to the
 * console instead. Never throws — notifications must not break the caller;
 * returns false when not delivered.
 */
export async function sendSms(mobile: string, message: string): Promise<boolean> {
  const normalized = normalizePhone(mobile)
  if (!normalized) return false

  const fromNumber = process.env.IPPANEL_FROM_NUMBER

  if (!isSmsConfigured() || !fromNumber) {
    console.warn(`[ippanel] DEV MODE — SMS to ${normalized}: ${message}`)
    return false
  }

  try {
    return await ippanelSend({
      sending_type: 'webservice',
      from_number: fromNumber,
      message,
      params: { recipients: [normalized] },
    })
  } catch (e) {
    console.error('[ippanel] webservice send threw:', e)
    return false
  }
}

/** Verify a code against the value stored in Redis. Consumes it on success. */
export async function verifyOTP(mobile: string, code: string): Promise<boolean> {
  const normalized = normalizePhone(mobile)
  if (!normalized) return false

  const redis = getRedis()
  const stored = await redis.get(`otp:${normalized}`)
  if (!stored || stored !== code) return false

  await redis.del(`otp:${normalized}`)
  return true
}
