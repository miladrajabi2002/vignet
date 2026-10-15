import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/ratelimit'
import { captureError } from '@/lib/errors/capture'
import { readSmsRequest } from '@/lib/payments/card/http'
import { findDeviceByToken, ingestBankSms } from '@/lib/payments/card/ingest'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ token: string }> }

/**
 * Bank SMS forwarded inside a URL: a forwarder app (or an iPhone Shortcut)
 * calls this address with the message as JSON, a form, raw text or `?text=`.
 * The token in the path is the phone's identity.
 */
async function handle(req: Request, props: Params) {
  const { token } = await props.params
  if (!(await rateLimit(`pay-sms:${token.slice(0, 40)}`, 60, 60, { failClosed: true }))) {
    return NextResponse.json({ ok: false, error: 'RATE_LIMITED' }, { status: 429 })
  }
  const device = await findDeviceByToken(token)
  if (!device) return NextResponse.json({ ok: false, error: 'UNKNOWN_DEVICE' }, { status: 404 })
  try {
    const sms = await readSmsRequest(req)
    const outcome = await ingestBankSms(device, 'URL', sms.text)
    // The forwarder only needs to know the message arrived.
    return NextResponse.json({ ok: true, result: outcome.status })
  } catch (error) {
    captureError('cardpay:sms-url', error, { workspaceId: device.workspaceId })
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
