import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeHttpPost } from '@/lib/security/safe-http'
import { rateLimit } from '@/lib/ratelimit'
import { getClientIp } from '@/lib/security/request-ip'

export const dynamic = 'force-dynamic'

const PAIRING_NONCE_RE = /^[A-Za-z0-9._~-]{32,128}$/

function normalizeSiteUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim())
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    url.search = ''
    url.hash = ''
    url.pathname = url.pathname.replace(/\/+$/, '')
    return url.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

/**
 * WordPress pairing lookup. The webhook secret is returned only after the
 * registered store proves that it owns the short-lived nonce supplied by the
 * plugin. The callback is DNS-pinned and cannot target private/link-local IPs.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const siteUrl = normalizeSiteUrl(searchParams.get('site_url') ?? '')
  const pairingNonce = searchParams.get('pairing_nonce') ?? ''

  if (!siteUrl || !PAIRING_NONCE_RE.test(pairingNonce)) {
    return NextResponse.json({ error: 'INVALID_PAIRING_REQUEST' }, { status: 400 })
  }

  const siteKey = crypto.createHash('sha256').update(siteUrl).digest('hex').slice(0, 24)
  const allowed = await rateLimit(
    `woo-pair:${siteKey}:${getClientIp(req.headers)}`,
    10,
    60,
    { failClosed: process.env.NODE_ENV === 'production' },
  )
  if (!allowed) {
    return NextResponse.json({ error: 'PAIRING_RATE_LIMITED' }, { status: 429 })
  }

  const integration = await prisma.storeIntegration.findFirst({
    where: {
      type: 'WOOCOMMERCE',
      storeUrl: { in: [siteUrl, `${siteUrl}/`] },
      active: true,
    },
    orderBy: { createdAt: 'desc' },
    select: { webhookSecret: true, active: true },
  })

  // Use the same response for an unknown site, a consumed nonce and a failed
  // callback so the public endpoint does not become an integration oracle.
  if (!integration?.webhookSecret) {
    return NextResponse.json({ error: 'PAIRING_NOT_VERIFIED' }, { status: 403 })
  }

  try {
    const challengeUrl = `${siteUrl}/wp-json/vigent-woo/v1/pairing-challenge`
    const response = await safeHttpPost(
      challengeUrl,
      JSON.stringify({ nonce: pairingNonce }),
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeoutMs: 8_000,
        maxBytes: 64 * 1024,
        maxRedirects: 0,
        allowedContentTypes: ['application/json'],
      },
    )

    if (response.status < 200 || response.status >= 300) throw new Error('PAIRING_REJECTED')
    const proof = JSON.parse(response.body.toString('utf8')) as { verified?: unknown }
    if (proof.verified !== true) throw new Error('PAIRING_REJECTED')
  } catch (error) {
    console.warn('[woocommerce:pairing] challenge failed', {
      siteUrl,
      reason: error instanceof Error ? error.message : 'unknown',
    })
    return NextResponse.json({ error: 'PAIRING_NOT_VERIFIED' }, { status: 403 })
  }

  const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/+$/, '')
  const webhookUrl = `${appBaseUrl}/api/sync/woocommerce?token=${encodeURIComponent(integration.webhookSecret)}`

  return NextResponse.json({
    webhook_url: webhookUrl,
    webhook_secret: integration.webhookSecret,
    active: integration.active,
  })
}
