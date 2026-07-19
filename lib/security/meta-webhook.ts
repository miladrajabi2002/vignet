import crypto from 'node:crypto'

/**
 * Meta signs webhook bodies as `sha256=<hex HMAC>` using the app secret.
 * Verification must run over the exact request bytes, before JSON parsing.
 */
export function verifyMetaWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | null,
  appSecret: string | undefined,
): boolean {
  if (!appSecret || !signatureHeader?.startsWith('sha256=')) return false

  const signatureHex = signatureHeader.slice('sha256='.length)
  if (!/^[a-f0-9]{64}$/i.test(signatureHex)) return false

  const supplied = Buffer.from(signatureHex, 'hex')
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest()
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected)
}

