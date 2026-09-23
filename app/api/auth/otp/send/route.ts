import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendOTP, OtpRateLimitError } from '@/lib/sms/ippanel'
import { isStaticOtpPhone } from '@/lib/sms/static-otp'
import { phoneSchema } from '@/lib/phone'
import { rateLimit } from '@/lib/ratelimit'
import { getClientIp } from '@/lib/security/request-ip'
import { captureError, persistLog } from '@/lib/errors/capture'
import { getRequestId, requestIdHeaders } from '@/lib/observability/request-context'

export async function POST(req: Request) {
  const startedAt = Date.now()
  const requestId = getRequestId(req.headers)
  const responseHeaders = requestIdHeaders(requestId)
  const ip = getClientIp(req.headers)

  let body: unknown
  try {
    body = await req.json()
  } catch (error) {
    await persistLog('warn', 'auth:otp:invalid-json', error, {
      metadata: { requestId, ip, durationMs: Date.now() - startedAt },
    })
    return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400, headers: responseHeaders })
  }

  const parsed = phoneSchema.safeParse((body as { phone?: string })?.phone)
  if (!parsed.success) {
    await persistLog('warn', 'auth:otp:invalid-phone', 'Invalid phone number supplied for OTP', {
      metadata: { requestId, ip, validationIssues: parsed.error.issues, durationMs: Date.now() - startedAt },
    })
    return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400, headers: responseHeaders })
  }

  const phone = parsed.data

  // Per-phone limiting lives in sendOTP (3/hour). Add a per-IP cap so an
  // attacker can't rotate phone numbers from one source to spam SMS / our cost.
  // Static-OTP phones (shared company logins) never trigger an SMS, so the
  // cost-motivated cap does not apply to them; a dedicated wider bucket still
  // keeps the endpoint and its audit log from being flooded.
  const ipAllowed = await (isStaticOtpPhone(phone)
    ? rateLimit(`otp_static_ip:${ip}`, 60, 3600, { failClosed: true })
    : rateLimit(`otp_ip:${ip}`, 10, 3600, { failClosed: true }))
  if (!ipAllowed) {
    await persistLog('warn', 'auth:otp:ip-rate-limit', 'OTP request rejected by IP rate limit', {
      metadata: { requestId, ip, staticPhone: isStaticOtpPhone(phone), durationMs: Date.now() - startedAt },
    })
    return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429, headers: responseHeaders })
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    })
    await sendOTP(phone, { ip, requestId })
    return NextResponse.json(
      { ok: true, isNewUser: !existing, requestId },
      { headers: responseHeaders },
    )
  } catch (e) {
    if (e instanceof OtpRateLimitError) {
      return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429, headers: responseHeaders })
    }
    captureError('auth:otp:send-route', e, {
      metadata: { phone, requestId, ip, durationMs: Date.now() - startedAt },
    })
    return NextResponse.json({ error: 'SMS_FAILED' }, { status: 500, headers: responseHeaders })
  }
}
