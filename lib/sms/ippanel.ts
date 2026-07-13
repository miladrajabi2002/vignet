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

const OTP_TTL_SECONDS = 600 // 10 minutes
const RATE_WINDOW_SECONDS = 3600 // 1 hour
const RATE_MAX = 3 // max 3 OTPs per phone per hour
// IPPanel/proxy calls can cross two networks. The shared 30-second window
// applies to OTP, free-form notifications and every pattern SMS.
const SMS_REQUEST_TIMEOUT_MS = 30_000

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
    signal: AbortSignal.timeout(SMS_REQUEST_TIMEOUT_MS),
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
 * Send a 6-digit OTP via an IPPanel pattern. Stores the code in Redis (TTL 10m)
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

/**
 * Send a templated (pattern) SMS with arbitrary variables — the shared engine
 * behind subscription-purchase and subscription-expiry notifications. Like the
 * OTP send, it uses a pre-approved IPPanel pattern (so it isn't blocked by the
 * operator's anti-spam filter), but with its own pattern code + params.
 *
 * Requires (IPPANEL_API_KEY or IPPANEL_PROXY_URL) and IPPANEL_FROM_NUMBER, plus
 * the specific `patternCode`. In dev (neither provider set) the resolved text
 * is logged to the console. Never throws — a failed notification SMS must not
 * break the billing flow that triggered it.
 */
async function sendPatternSms(
  mobile: string,
  patternCode: string | undefined,
  params: Record<string, string>,
): Promise<boolean> {
  const normalized = normalizePhone(mobile)
  if (!normalized) return false

  const fromNumber = process.env.IPPANEL_FROM_NUMBER

  if (!isSmsConfigured() || !fromNumber) {
    console.warn(
      `[ippanel] DEV MODE — pattern SMS to ${normalized}: pattern=${patternCode ?? '?'} params=${JSON.stringify(params)}`,
    )
    return false
  }

  if (!patternCode) {
    console.error(
      `[ippanel] cannot send pattern SMS — missing pattern code (params=${JSON.stringify(params)})`,
    )
    return false
  }

  try {
    return await ippanelSend({
      sending_type: 'pattern',
      from_number: fromNumber,
      code: patternCode,
      recipients: [normalized],
      params,
    })
  } catch (e) {
    console.error('[ippanel] pattern send threw:', e)
    return false
  }
}

/**
 * Persian (Jalali) short date for SMS bodies, e.g. "۱۴۰۳/۰۵/۱۲".
 * Falls back to a Gregorian ISO date when Intl Jaalali isn't available.
 */
function formatPersianDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

/** Human-readable Persian plan name for SMS bodies. */
function planLabelFa(plan: string): string {
  switch (plan) {
    case 'STARTER':
      return 'استارتر'
    case 'PRO':
      return 'حرفه‌ای'
    case 'BUSINESS':
      return 'بیزینس'
    case 'TRIAL':
      return 'آزمایشی'
    default:
      return plan
  }
}

/**
 * Subscription-purchase confirmation SMS — sent right after a payment is
 * verified and the subscription is activated. Uses a dedicated IPPanel
 * pattern (IPPANEL_SUBSCRIPTION_PURCHASED_PATTERN_CODE) whose variables are:
 *   %plan%    → plan name (e.g. "حرفه‌ای")
 *   %expiry%  → subscription end date (e.g. "۱۴۰۳/۰۵/۱۲")
 *
 * Sample pattern to register in IPPanel:
 *   اشتراک %plan% ویجنت با موفقیت فعال شد. معتبر تا: %expiry%
 *   vigent.ir
 */
export async function sendSubscriptionPurchasedSms(
  mobile: string,
  data: { plan: string; currentPeriodEnd: Date },
): Promise<boolean> {
  return sendPatternSms(mobile, process.env.IPPANEL_SUBSCRIPTION_PURCHASED_PATTERN_CODE, {
    plan: planLabelFa(data.plan),
    expiry: formatPersianDate(data.currentPeriodEnd),
  })
}

/**
 * Subscription-expiry reminder SMS — sent N days before the subscription ends.
 * Uses a dedicated IPPanel pattern (IPPANEL_SUBSCRIPTION_EXPIRING_PATTERN_CODE)
 * whose variables are:
 *   %days%    → whole days remaining (e.g. "۳")
 *   %expiry%  → subscription end date (e.g. "۱۴۰۳/۰۵/۱۲")
 *
 * Sample pattern to register in IPPanel:
 *   اشتراک ویجنت شما %days% روز دیگر منقضی می‌شود (%expiry%).
 *   برای تمدید وارد حساب کاربری خود در vigent.ir شوید.
 */
export async function sendSubscriptionExpiringSms(
  mobile: string,
  data: { daysRemaining: number; currentPeriodEnd: Date },
): Promise<boolean> {
  return sendPatternSms(mobile, process.env.IPPANEL_SUBSCRIPTION_EXPIRING_PATTERN_CODE, {
    days: String(data.daysRemaining),
    expiry: formatPersianDate(data.currentPeriodEnd),
  })
}

/** Welcome message sent once after the first successful sign-up. */
export async function sendWelcomeSms(
  mobile: string,
  data: { name: string },
): Promise<boolean> {
  return sendPatternSms(mobile, process.env.IPPANEL_WELCOME_PATTERN_CODE, {
    name: data.name,
  })
}

/** A focused nudge that tells an unfinished trial user only their next step. */
export async function sendActivationReminderSms(
  mobile: string,
  data: { nextStep: string },
): Promise<boolean> {
  return sendPatternSms(mobile, process.env.IPPANEL_ACTIVATION_REMINDER_PATTERN_CODE, {
    step: data.nextStep,
  })
}

/** Celebrate the first complete setup without adding an email lifecycle. */
export async function sendActivationCompleteSms(mobile: string): Promise<boolean> {
  return sendPatternSms(mobile, process.env.IPPANEL_ACTIVATION_COMPLETE_PATTERN_CODE, {
    status: 'فعال',
  })
}

/** Trial reminder is separate from paid-subscription expiry messaging. */
export async function sendTrialExpiringSms(
  mobile: string,
  data: { daysRemaining: number },
): Promise<boolean> {
  return sendPatternSms(mobile, process.env.IPPANEL_TRIAL_EXPIRING_PATTERN_CODE, {
    days: String(data.daysRemaining),
  })
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
