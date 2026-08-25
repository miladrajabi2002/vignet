import crypto from 'crypto'

const GRANT_TTL_MS = 60_000
export const ADMIN_IMPERSONATION_SESSION_TTL_MS = 60 * 60_000

export type AdminImpersonationGrant = {
  version: 1
  userId: string
  workspaceId: string
  grantExpiresAt: number
  sessionExpiresAt: number
  nonce: string
}

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET || process.env.AUTH_SECRET
  if (!value) throw new Error('ADMIN_SESSION_SECRET_NOT_SET')
  return `${value}:${process.env.ADMIN_PASS ?? ''}:admin-impersonation`
}

function signature(encoded: string): string {
  return crypto.createHmac('sha256', secret()).update(encoded).digest('base64url')
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

/**
 * Issue a very short-lived, signed grant that Auth.js can exchange for a
 * bounded support session. The grant is never a shareable dashboard URL.
 */
export function createAdminImpersonationGrant(
  userId: string,
  workspaceId: string,
  now = Date.now(),
): { token: string; sessionExpiresAt: number } {
  const payload: AdminImpersonationGrant = {
    version: 1,
    userId,
    workspaceId,
    grantExpiresAt: now + GRANT_TTL_MS,
    sessionExpiresAt: now + ADMIN_IMPERSONATION_SESSION_TTL_MS,
    nonce: crypto.randomUUID(),
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return {
    token: `${encoded}.${signature(encoded)}`,
    sessionExpiresAt: payload.sessionExpiresAt,
  }
}

/** Verify a grant and enforce both its exchange and resulting session bounds. */
export function verifyAdminImpersonationGrant(
  token: string,
  now = Date.now(),
): AdminImpersonationGrant | null {
  if (!token || token.length > 4_096) return null
  const [encoded, supplied, extra] = token.split('.')
  if (!encoded || !supplied || extra || !safeEqual(signature(encoded), supplied)) return null

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as Partial<AdminImpersonationGrant>
    const latestAllowedGrantExpiry = now + GRANT_TTL_MS + 5_000
    const latestAllowedSessionExpiry = now + ADMIN_IMPERSONATION_SESSION_TTL_MS + GRANT_TTL_MS

    if (
      payload.version !== 1
      || typeof payload.userId !== 'string'
      || !payload.userId
      || typeof payload.workspaceId !== 'string'
      || !payload.workspaceId
      || typeof payload.nonce !== 'string'
      || !payload.nonce
      || typeof payload.grantExpiresAt !== 'number'
      || payload.grantExpiresAt <= now
      || payload.grantExpiresAt > latestAllowedGrantExpiry
      || typeof payload.sessionExpiresAt !== 'number'
      || payload.sessionExpiresAt <= now
      || payload.sessionExpiresAt > latestAllowedSessionExpiry
    ) {
      return null
    }

    return payload as AdminImpersonationGrant
  } catch {
    return null
  }
}
