import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import crypto from 'crypto'

/**
 * Standalone admin authentication — completely separate from the OTP-based
 * user/next-auth system. A fixed ADMIN_USER / ADMIN_PASS (set in .env) guards
 * the /admin monitoring dashboard. The session is a signed, expiring cookie;
 * no database row is involved.
 */

const COOKIE_NAME = 'admin_session'
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET || process.env.AUTH_SECRET
  if (!s) throw new Error('ADMIN_SESSION_SECRET (or AUTH_SECRET) is not set')
  return s
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('hex')
}

/** Constant-time string comparison that tolerates length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) {
    // Still spend the comparison to avoid leaking length via timing.
    crypto.timingSafeEqual(ab, ab)
    return false
  }
  return crypto.timingSafeEqual(ab, bb)
}

/** Verify a username/password pair against the configured admin credentials. */
export function verifyAdminCredentials(username: string, password: string): boolean {
  const u = process.env.ADMIN_USER
  const p = process.env.ADMIN_PASS
  if (!u || !p) return false
  return safeEqual(username, u) && safeEqual(password, p)
}

/** Build the signed cookie value: "<expiryEpoch>.<hmac>". */
export function createSessionToken(): { value: string; maxAge: number } {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const value = `${exp}.${sign(String(exp))}`
  return { value, maxAge: SESSION_TTL_SECONDS }
}

function isValidToken(raw: string | undefined): boolean {
  if (!raw) return false
  const [expStr, sig] = raw.split('.')
  if (!expStr || !sig) return false
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false
  return safeEqual(sig, sign(expStr))
}

export const ADMIN_COOKIE = COOKIE_NAME

/** True when the current request carries a valid admin session cookie. */
export function isAdminAuthed(): boolean {
  return isValidToken(cookies().get(COOKIE_NAME)?.value)
}

/** Guard for admin server components/layouts. Redirects to login when absent. */
export function requireAdmin(): void {
  if (!isAdminAuthed()) redirect('/admin/login')
}
