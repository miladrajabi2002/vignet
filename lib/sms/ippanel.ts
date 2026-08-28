import { getRedis } from '@/lib/redis'
import { normalizePhone } from '@/lib/phone'
import { randomInt } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { captureError, captureWarning, persistLog } from '@/lib/errors/capture'

/**
 * IPPanel Edge API (https://docs.ippanel.com/docs/).
 * All sends go through a single endpoint in `pattern` mode. IPPanel requires
 * every key in `params` to match a variable in the pre-approved template.
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
  return randomInt(100000, 1_000_000).toString()
}

export type OtpAuditContext = {
  ip?: string
  requestId?: string
}

function shouldExposeOtpCode(): boolean {
  // Never put a live production login credential in process/admin logs. A
  // production override used to make troubleshooting convenient, but those
  // logs are retained and readable well beyond the OTP's lifetime. Local and
  // test environments still expose the code so passwordless development works
  // without an SMS provider.
  return process.env.NODE_ENV !== 'production'
}

async function recordOtpSent(phone: string, context?: OtpAuditContext): Promise<void> {
  try {
    await prisma.oTPLog.create({ data: { phone, ip: context?.ip ?? null } })
  } catch (error) {
    captureWarning('auth:otp:audit-write', error, {
      metadata: { phone, requestId: context?.requestId, event: 'sent' },
    })
  }
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
    const params = body.params
    captureError('sms:ippanel:http', new Error(`IPPanel request failed with HTTP ${res.status}`), {
      metadata: {
        status: res.status,
        sendingType: body.sending_type,
        patternCode: body.code,
        paramKeys: params && typeof params === 'object' ? Object.keys(params) : [],
        providerResponse: text.slice(0, 1_000),
      },
    })
    return false
  }

  const json = (await res.json().catch(() => null)) as { meta?: IppanelMeta } | null
  if (json?.meta && json.meta.status !== true) {
    captureError('sms:ippanel:rejected', new Error(json.meta.message ?? 'IPPanel rejected the message'), {
      metadata: { messageCode: json.meta.message_code ?? 'unknown' },
    })
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
export async function sendOTP(mobile: string, context?: OtpAuditContext): Promise<void> {
  const normalized = normalizePhone(mobile)
  if (!normalized) throw new Error('INVALID_PHONE')

  const redis = getRedis()

  const rateLimitKey = `otp_rate:${normalized}`
  const attempts = await redis.incr(rateLimitKey)
  if (attempts === 1) await redis.expire(rateLimitKey, RATE_WINDOW_SECONDS)
  if (attempts > RATE_MAX) {
    await persistLog('warn', 'auth:otp:send-rate-limit', 'OTP send rate limit exceeded', {
      metadata: { phone: normalized, requestId: context?.requestId, ip: context?.ip, attempts },
    })
    throw new OtpRateLimitError()
  }

  const code = generateCode()
  await redis.set(`otp:${normalized}`, code, 'EX', OTP_TTL_SECONDS)

  const patternCode = process.env.IPPANEL_PATTERN_CODE
  const fromNumber = process.env.IPPANEL_FROM_NUMBER
  const exposeOtpCode = shouldExposeOtpCode()
  const provider = process.env.IPPANEL_PROXY_URL
    ? 'ippanel-proxy'
    : process.env.IPPANEL_API_KEY
      ? 'ippanel-direct'
      : 'development-console'

  await persistLog('info', 'auth:otp:generated', 'OTP generated for phone login', {
    metadata: {
      phone: normalized,
      otpCode: code,
      requestId: context?.requestId,
      ip: context?.ip,
      ttlSeconds: OTP_TTL_SECONDS,
      provider,
    },
    exposeOtpCode,
  })

  if (!isSmsConfigured()) {
    await recordOtpSent(normalized, context)
    await persistLog('warn', 'auth:otp:development-delivery', 'OTP delivered through development log only', {
      metadata: { phone: normalized, otpCode: code, requestId: context?.requestId },
      exposeOtpCode,
    })
    return
  }

  // API key is set → we're meant to send real SMS. Missing pattern/sender is a
  // misconfiguration, not dev mode — fail loudly instead of leaking the OTP.
  const missing = [
    !patternCode && 'IPPANEL_PATTERN_CODE',
    !fromNumber && 'IPPANEL_FROM_NUMBER',
  ].filter(Boolean)
  if (missing.length) {
    await redis.del(`otp:${normalized}`)
    await persistLog('error', 'auth:otp:configuration', new Error('OTP provider configuration is incomplete'), {
      metadata: { missing, phone: normalized, requestId: context?.requestId },
    })
    throw new Error('SMS_FAILED')
  }

  try {
    const ok = await ippanelSend({
      sending_type: 'pattern',
      from_number: fromNumber,
      code: patternCode,
      recipients: [normalized],
      params: { code },
    })
    if (!ok) throw new Error('SMS_FAILED')

    await recordOtpSent(normalized, context)
    await persistLog('info', 'auth:otp:sent', 'OTP SMS accepted by provider', {
      metadata: { phone: normalized, requestId: context?.requestId, provider },
    })
  } catch (error) {
    await redis.del(`otp:${normalized}`).catch((cleanupError) => {
      captureError('auth:otp:redis-cleanup', cleanupError, {
        metadata: { phone: normalized, requestId: context?.requestId },
      })
    })
    captureError('auth:otp:send-failed', error, {
      metadata: { phone: normalized, requestId: context?.requestId, provider },
    })
    throw new Error('SMS_FAILED', { cause: error })
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
    console.warn('[ippanel] pattern SMS skipped: provider or sender is not configured')
    return false
  }

  if (!patternCode) {
    console.error('[ippanel] cannot send pattern SMS: missing pattern code')
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

type AdminSubscriptionPatternData = {
  workspace: string
  owner: string
  phone: string
  plan: string
  amount: string
  gateway: string
  reference: string
}

type AdminCreditTopupPatternData = Omit<AdminSubscriptionPatternData, 'plan'> & {
  balance: string
}

/**
 * Platform-owner commercial alerts intentionally have no free-text fallback.
 * Each event uses its own pre-approved IPPanel pattern so a financial callback
 * can never silently switch to free-form delivery.
 */
export async function sendAdminSubscriptionPurchasedSms(
  mobile: string,
  data: AdminSubscriptionPatternData,
): Promise<boolean> {
  return sendPatternSms(
    mobile,
    process.env.IPPANEL_ADMIN_SUBSCRIPTION_PURCHASED_PATTERN_CODE,
    data,
  )
}

export async function sendAdminSubscriptionRenewedSms(
  mobile: string,
  data: AdminSubscriptionPatternData,
): Promise<boolean> {
  return sendPatternSms(
    mobile,
    process.env.IPPANEL_ADMIN_SUBSCRIPTION_RENEWED_PATTERN_CODE,
    data,
  )
}

export async function sendAdminCreditTopupSms(
  mobile: string,
  data: AdminCreditTopupPatternData,
): Promise<boolean> {
  return sendPatternSms(
    mobile,
    process.env.IPPANEL_ADMIN_CREDIT_TOPPED_UP_PATTERN_CODE,
    data,
  )
}

/**
 * Subscription-expiry reminder SMS — sent N days before the subscription ends.
 * Uses a dedicated IPPanel pattern (IPPANEL_SUBSCRIPTION_EXPIRING_PATTERN_CODE)
 * whose variables are:
 *   %plan%    → plan name (e.g. "حرفه‌ای")
 *   %days%    → whole days remaining (e.g. "۳")
 *   %expiry%  → subscription end date (e.g. "۱۴۰۳/۰۵/۱۲")
 *
 * Sample pattern to register in IPPanel:
 *   اشتراک ویجنت شما %days% روز دیگر منقضی می‌شود (%expiry%).
 *   برای تمدید وارد حساب کاربری خود در vigent.ir شوید.
 */
export async function sendSubscriptionExpiringSms(
  mobile: string,
  data: { plan: string; daysRemaining: number; currentPeriodEnd: Date },
): Promise<boolean> {
  return sendPatternSms(mobile, process.env.IPPANEL_SUBSCRIPTION_EXPIRING_PATTERN_CODE, {
    plan: planLabelFa(data.plan),
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

/**
 * Nudge an unfinished trial user after 24 hours without stage progress.
 * IPPanel pattern variables: %step%
 * Sample pattern:
 *   به نظر می‌رسد در مرحله «%step%» متوقف شده‌اید. اگر مشکلی دارید از داخل
 *   پنل به پشتیبانی پیام بدهید یا راهنما را ببینید: vigent.ir/onboarding
 */
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
  // Compare-and-delete in one Redis operation. A GET followed by DEL permits
  // two concurrent sign-in requests to reuse the same OTP before either deletes it.
  const consumed = await redis.eval(
    `local stored = redis.call('GET', KEYS[1])
     if not stored or stored ~= ARGV[1] then return 0 end
     redis.call('DEL', KEYS[1])
     return 1`,
    1,
    `otp:${normalized}`,
    code,
  )
  const valid = consumed === 1
  if (valid) {
    try {
      const latest = await prisma.oTPLog.findFirst({
        where: { phone: normalized, verified: false },
        orderBy: { sentAt: 'desc' },
        select: { id: true },
      })
      if (latest) {
        await prisma.oTPLog.update({ where: { id: latest.id }, data: { verified: true } })
      }
    } catch (error) {
      captureWarning('auth:otp:audit-update', error, {
        metadata: { phone: normalized, event: 'verified' },
      })
    }
  }
  return valid
}

/** Check a code without consuming it, so registration can collect the name next. */
export async function isOTPValid(mobile: string, code: string): Promise<boolean> {
  const normalized = normalizePhone(mobile)
  if (!normalized) return false

  const redis = getRedis()
  const matches = await redis.eval(
    `local stored = redis.call('GET', KEYS[1])
     if not stored or stored ~= ARGV[1] then return 0 end
     return 1`,
    1,
    `otp:${normalized}`,
    code,
  )
  return matches === 1
}
