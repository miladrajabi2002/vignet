import { cookies, type UnsafeUnwrappedCookies } from 'next/headers';
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
  return isValidToken((cookies() as unknown as UnsafeUnwrappedCookies).get(COOKIE_NAME)?.value);
}

/**
 * Auth check for API route handlers. Accepts the admin session cookie (from the
 * normal /admin login flow) AND, as a fallback for direct API calls (fresh tab,
 * Postman, curl — where the cookie isn't sent), an `admin_token` supplied via
 * either the `?admin_token=…` query parameter or the `X-Admin-Token` header.
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
  if (headerTok && process.env.ADMIN_PASS && safeEqual(headerTok, process.env.ADMIN_PASS)) {
    return true
  }
  // 3) Query-param token (?admin_token=…).
  try {
    const q = new URL(req.url).searchParams.get('admin_token')
    if (q && process.env.ADMIN_PASS && safeEqual(q, process.env.ADMIN_PASS)) {
      return true
    }
  } catch {
    /* req.url malformed — ignore */
  }
  return false
}

/** Guard for admin server components/layouts. Redirects to login when absent. */
export function requireAdmin(): void {
  if (!isAdminAuthed()) redirect('/admin/login')
}
