import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendOTP, OtpRateLimitError } from '@/lib/sms/ippanel'
import { phoneSchema } from '@/lib/phone'
import { rateLimit } from '@/lib/ratelimit'
import { getClientIp } from '@/lib/security/request-ip'
import { captureError, persistLog } from '@/lib/errors/capture'
import { getRequestId, requestIdHeaders } from '@/lib/observability/request-context'

export async function POST(req: Request) {
  const startedAt = Date.now()
  const requestId = getRequestId(req.headers)
  const responseHeaders = requestIdHeaders(requestId)
  // Per-phone limiting lives in sendOTP (3/hour). Add a per-IP cap so an
  // attacker can't rotate phone numbers from one source to spam SMS / our cost.
  const ip = getClientIp(req.headers)
  const ipAllowed = await rateLimit(`otp_ip:${ip}`, 10, 3600, { failClosed: true })
  if (!ipAllowed) {
    await persistLog('warn', 'auth:otp:ip-rate-limit', 'OTP request rejected by IP rate limit', {
      metadata: { requestId, ip, durationMs: Date.now() - startedAt },
    })
    return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429, headers: responseHeaders })
  }

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
