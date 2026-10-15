import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/ratelimit'
import { captureError } from '@/lib/errors/capture'
import { readSmsRequest } from '@/lib/payments/card/http'
import { findDeviceByPhone, ingestBankSms } from '@/lib/payments/card/ingest'
import { getPlatformGatewaySettings } from '@/lib/payments/card/platform'

export const dynamic = 'force-dynamic'

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/**
 * Inbound webhook of the platform's SMS line. The owner's phone forwards the
 * bank's deposit SMS to the line; the SMS panel calls this address with
 * `from`, `to` and the text. The sender's number must be a registered phone —
 * a message from any other number is dropped without being stored.
 */
async function handle(req: Request) {
  const url = new URL(req.url)
  const settings = await getPlatformGatewaySettings()
  const key = url.searchParams.get('key') ?? ''
  if (!settings.inboundSecret || !key || !sameSecret(key, settings.inboundSecret)) {
    return new NextResponse('FORBIDDEN', { status: 403 })
  }
  try {
    const sms = await readSmsRequest(req)
    const line = sms.to.replace(/\D/g, '').replace(/^98/, '')
    const lines = settings.inboundLines.map((value) => value.replace(/\D/g, '').replace(/^98/, ''))
    if (line && lines.length && !lines.includes(line)) return new NextResponse('OK')
    if (!(await rateLimit(`pay-sms-line:${sms.from.replace(/\D/g, '').slice(-10)}`, 60, 60, { failClosed: true }))) return new NextResponse('OK')
    const device = await findDeviceByPhone(sms.from)
    if (device) await ingestBankSms(device, 'SMS', sms.text)
  } catch (error) {
    captureError('cardpay:sms-line', error)
  }
  // Always 200: SMS panels retry on anything else and would flood the line.
  return new NextResponse('OK')
}

export const GET = handle
export const POST = handle
