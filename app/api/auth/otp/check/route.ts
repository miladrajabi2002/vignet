import { NextResponse } from 'next/server'
import { isOTPValid } from '@/lib/sms/ippanel'
import { phoneSchema } from '@/lib/phone'
import { allowOtpVerificationAttempt } from '@/lib/security/otp-attempts'
import { persistLog } from '@/lib/errors/capture'
import { getClientIp } from '@/lib/security/request-ip'
import { getRequestId, requestIdHeaders } from '@/lib/observability/request-context'

export async function POST(req: Request) {
  const startedAt = Date.now()
  const requestId = getRequestId(req.headers)
  const ip = getClientIp(req.headers)
  const headers = requestIdHeaders(requestId)
  let body: unknown
  try {
    body = await req.json()
  } catch (error) {
    await persistLog('warn', 'auth:otp:check-invalid-json', error, {
      metadata: { requestId, ip, durationMs: Date.now() - startedAt },
    })
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400, headers })
  }

  const input = body && typeof body === 'object'
    ? (body as { phone?: unknown; code?: unknown })
    : {}
  const phone = phoneSchema.safeParse(input.phone)
  const code = typeof input.code === 'string' ? input.code : ''
  if (!phone.success || !/^\d{6}$/.test(code)) {
    await persistLog('warn', 'auth:otp:check-invalid-input', 'Malformed OTP verification input', {
      metadata: { requestId, ip, phoneValid: phone.success, codeLength: code.length, durationMs: Date.now() - startedAt },
    })
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400, headers })
  }

  if (!(await allowOtpVerificationAttempt(phone.data, req.headers))) {
    await persistLog('warn', 'auth:otp:check-rate-limit', 'OTP verification rate limit exceeded', {
      metadata: { phone: phone.data, requestId, ip, durationMs: Date.now() - startedAt },
    })
    return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429, headers })
  }

  if (!(await isOTPValid(phone.data, code))) {
    await persistLog('warn', 'auth:otp:check-invalid-code', 'Incorrect or expired OTP supplied', {
      metadata: { phone: phone.data, requestId, ip, durationMs: Date.now() - startedAt },
    })
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 401, headers })
  }

  await persistLog('info', 'auth:otp:check-valid', 'OTP validated for pending registration', {
    metadata: { phone: phone.data, requestId, ip, durationMs: Date.now() - startedAt },
  })
  return NextResponse.json({ ok: true, requestId }, { headers })
}
