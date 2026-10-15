/**
 * Sites that create payments through the API. One key per site, shown once;
 * only its hash is stored. The callback secret signs outgoing callbacks.
 */
import crypto from 'node:crypto'
import type { PaySite } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function newSiteCredentials(): { key: string; secret: string; fields: { keyHash: string; keyHint: string; secretEncrypted: string } } {
  const key = `vgp_${crypto.randomBytes(24).toString('base64url')}`
  const secret = `whs_${crypto.randomBytes(24).toString('base64url')}`
  return { key, secret, fields: { keyHash: sha256(key), keyHint: `${key.slice(0, 8)}…${key.slice(-4)}`, secretEncrypted: encrypt(secret) } }
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(\S+)$/i.exec(header)
  return match ? match[1] : null
}

export async function siteFromRequest(req: Request): Promise<PaySite | null> {
  const key = bearerToken(req)
  if (!key || !key.startsWith('vgp_')) return null
  const site = await prisma.paySite.findUnique({ where: { keyHash: sha256(key) } })
  if (!site?.active) return null
  // Best effort; never blocks the request.
  void prisma.paySite.update({ where: { id: site.id }, data: { lastUsedAt: new Date() } }).catch(() => {})
  return site
}
