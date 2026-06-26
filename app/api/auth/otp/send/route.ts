import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendOTP, OtpRateLimitError } from '@/lib/sms/smsir'
import { phoneSchema } from '@/lib/phone'

export async function POST(req: Request) {
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
