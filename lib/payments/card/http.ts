/** Shared request reading for the two bank-SMS doors (JSON, form, raw text or query string). */
import { readForwardedSms, type ForwardedSms } from '@/lib/payments/card/sms-parse'

export async function readSmsRequest(req: Request): Promise<ForwardedSms> {
  const url = new URL(req.url)
  const query: Record<string, string> = {}
  url.searchParams.forEach((value, key) => { query[key] = value })
  let body: unknown = undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const type = req.headers.get('content-type') ?? ''
    const raw = (await req.text().catch(() => '')).slice(0, 8_000)
    if (type.includes('application/x-www-form-urlencoded')) {
      const form: Record<string, string> = {}
      new URLSearchParams(raw).forEach((value, key) => { form[key] = value })
      body = form
    } else {
      body = raw
    }
  }
  return readForwardedSms({ body, query })
}
