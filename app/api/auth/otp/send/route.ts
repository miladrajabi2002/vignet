import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendOTP, OtpRateLimitError } from '@/lib/sms/smsir'
import { phoneSchema } from '@/lib/phone'
import { rateLimit } from '@/lib/ratelimit'

export async function POST(req: Request) {
  // Per-phone limiting lives in sendOTP (3/hour). Add a per-IP cap so an
  // attacker can't rotate phone numbers from one source to spam SMS / our cost.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon'
  const ipAllowed = await rateLimit(`otp_ip:${ip}`, 10, 3600)
  if (!ipAllowed) {
    return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400 })
  }

  const parsed = phoneSchema.safeParse((body as { phone?: string })?.phone)
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400 })
  }

  const phone = parsed.data
  try {
    const existing = await prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    })
    await sendOTP(phone)
    return NextResponse.json({ ok: true, isNewUser: !existing })
  } catch (e) {
    if (e instanceof OtpRateLimitError) {
      return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 })
    }
    console.error('[otp/send] error:', e)
    return NextResponse.json({ error: 'SMS_FAILED' }, { status: 500 })
  }
}
