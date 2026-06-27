import { getRedis } from '@/lib/redis'
import { normalizePhone } from '@/lib/phone'

const SMS_IR_BASE = 'https://api.sms.ir/v1'

const OTP_TTL_SECONDS = 300 // 5 minutes
const RATE_WINDOW_SECONDS = 3600 // 1 hour
const RATE_MAX = 3 // max 3 OTPs per phone per hour

export class OtpRateLimitError extends Error {
  constructor() {
    super('OTP_RATE_LIMIT')
    this.name = 'OtpRateLimitError'
  }
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Send a 6-digit OTP via sms.ir. Stores the code in Redis (TTL 5m) and
 * rate-limits to 3 per hour per phone.
 *
 * In dev (no SMS_IR_API_KEY), the code is logged to the server console
 * instead of being sent, so local auth works without an SMS provider.
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

  const apiKey = process.env.SMS_IR_API_KEY
  const templateId = Number(process.env.SMS_IR_TEMPLATE_ID)

  if (!apiKey || !templateId) {
    // Dev fallback — no SMS provider configured.
    console.warn(
      `[sms.ir] DEV MODE — no SMS_IR_API_KEY. OTP for ${normalized} is: ${code}`,
    )
    return
  }

  const res = await fetch(`${SMS_IR_BASE}/send/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      mobile: normalized,
      templateId,
      parameters: [{ name: 'Code', value: code }],
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[sms.ir] send failed (${res.status}): ${body}`)
    throw new Error('SMS_FAILED')
  }
}

/**
 * Send a free-form SMS via sms.ir's bulk endpoint (used for notifications, not
 * OTP). Requires SMS_IR_API_KEY and SMS_IR_LINE_NUMBER. In dev (no API key) the
 * message is logged to the console instead. Never throws — notifications must
 * not break the caller; returns false when not delivered.
 */
export async function sendSms(mobile: string, message: string): Promise<boolean> {
  const normalized = normalizePhone(mobile)
  if (!normalized) return false

  const apiKey = process.env.SMS_IR_API_KEY
  const lineNumber = process.env.SMS_IR_LINE_NUMBER

  if (!apiKey || !lineNumber) {
    console.warn(`[sms.ir] DEV MODE — SMS to ${normalized}: ${message}`)
    return false
  }

  try {
    const res = await fetch(`${SMS_IR_BASE}/send/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        lineNumber: Number(lineNumber),
        messageText: message,
        mobiles: [normalized],
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[sms.ir] bulk send failed (${res.status}): ${body}`)
      return false
    }
    return true
  } catch (e) {
    console.error('[sms.ir] bulk send threw:', e)
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
