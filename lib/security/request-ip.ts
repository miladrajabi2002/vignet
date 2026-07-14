import crypto from 'node:crypto'

type HeaderSource = Pick<Headers, 'get'>

/**
 * Only headers overwritten by our reverse proxy are trusted. Never consume the
 * left-most X-Forwarded-For value directly: clients can supply it themselves.
 */
export function getClientIp(headers: HeaderSource): string {
  if (process.env.TRUST_PROXY_HEADERS === '1') {
    const trusted = headers.get('x-vigent-client-ip')?.trim()
    if (trusted) return trusted.slice(0, 64)
    const realIp = headers.get('x-real-ip')?.trim()
    if (realIp) return realIp.slice(0, 64)
  }

  // A stable, non-reversible fallback is preferable to one shared "anon" key.
  const fingerprint = [
    headers.get('user-agent') ?? '',
    headers.get('accept-language') ?? '',
  ].join('|')
  return `fp:${crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 24)}`
}
