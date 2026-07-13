import { cookies, type UnsafeUnwrappedCookies } from 'next/headers';
import { redirect } from 'next/navigation'
import crypto from 'crypto'
import { normalizePhone } from '@/lib/phone'
import { ADMIN_OWNER_PHONE } from '@/lib/admin/owner'

export { ADMIN_OWNER_NAME, ADMIN_OWNER_PHONE } from '@/lib/admin/owner'

/**
 * Standalone admin authentication — completely separate from the OTP-based
 * user/next-auth system. The single ADMIN_OWNER_PHONE plus ADMIN_PASS guard
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
  const p = process.env.ADMIN_PASS
  const phone = normalizePhone(username)
  if (!ADMIN_OWNER_PHONE || !phone || !p) return false
  return safeEqual(phone, ADMIN_OWNER_PHONE) && safeEqual(password, p)
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
  return isValidToken((cookies() as unknown as UnsafeUnwrappedCookies).get(COOKIE_NAME)?.value);
}

/**
 * Auth check for API route handlers. Accepts the admin session cookie (from the
 * normal /admin login flow) AND, as a fallback for direct API calls (fresh tab,
 * Postman or curl — where the cookie isn't sent), the admin password supplied
 * via `X-Admin-Token` together with the fixed owner phone in `X-Admin-Phone`.
 *
 * The fallback token must equal the ADMIN_PASS env var — the same secret the
 * operator typed at the /admin login screen. This keeps diagnostics gated
 * behind a secret without forcing the operator to manage a second credential.
 *
 * Usage in a route handler:
 *   if (!isAdminAuthedRequest(req)) return NextResponse.json({error:'UNAUTHORIZED'},{status:401})
 */
export function isAdminAuthedRequest(req: Request): boolean {
  // 1) Cookie-based session.
  if (isAdminAuthed()) return true
  // 2) Header-based token (X-Admin-Token).
  const headerTok = req.headers.get('x-admin-token')
  const headerPhone = normalizePhone(req.headers.get('x-admin-phone') || '')
  if (headerTok && headerPhone && ADMIN_OWNER_PHONE && process.env.ADMIN_PASS
    && safeEqual(headerPhone, ADMIN_OWNER_PHONE)
    && safeEqual(headerTok, process.env.ADMIN_PASS)) {
    return true
  }
  // Secrets are deliberately never accepted in query parameters because URLs
  // are commonly retained in proxy, browser and analytics logs.
  return false
}

/** Guard for admin server components/layouts. Redirects to login when absent. */
export function requireAdmin(): void {
  if (!isAdminAuthed()) redirect('/admin/login')
}
