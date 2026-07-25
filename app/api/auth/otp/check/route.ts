import { NextResponse } from 'next/server'
import { isOTPValid } from '@/lib/sms/ippanel'
import { phoneSchema } from '@/lib/phone'
import { allowOtpVerificationAttempt } from '@/lib/security/otp-attempts'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 })
  }

  const input = body && typeof body === 'object'
    ? (body as { phone?: unknown; code?: unknown })
    : {}
  const phone = phoneSchema.safeParse(input.phone)
  const code = typeof input.code === 'string' ? input.code : ''
  if (!phone.success || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 })
  }

  if (!(await allowOtpVerificationAttempt(phone.data, req.headers))) {
    return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
  }

  if (!(await isOTPValid(phone.data, code))) {
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
