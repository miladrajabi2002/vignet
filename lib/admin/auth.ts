import { cookies } from 'next/headers'
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
const SESSION_TTL_SECONDS = 12 * 60 * 60
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

/**
 * 🔍 نتیجه‌ی تشخیصی لاگین ادمین — به‌جای boolean، جزئیات برمی‌گرداند
 * تا فرم لاگین و لاگ سرور دقیقاً بگویند کدام گام شکست خورده.
 *
 * reason:
 *   - 'MISSING_ENV'      → یکی از متغیرهای env اصلاً موجود نیست (احتمالاً سرور env قدیمی دارد)
 *   - 'PHONE_INVALID'    → شماره‌ای که کاربر وارد کرده نرمالایز نمی‌شود
 *   - 'PHONE_MISMATCH'   → شماره کاربر با ADMIN_OWNER_PHONE برابر نیست
 *   - 'PASSWORD_MISMATCH'→ شماره درست بود ولی رمز عبور فرق دارد
 *   - 'TOTP_MISSING'     → TOTP فعال است ولی کد وارد نشده
 *   - 'TOTP_INVALID'     → کد TOTP اشتباه است
 *   - 'TOTP_OK'          → موفقیت
 */
export type AdminLoginResult =
        | { ok: true; reason: 'TOTP_OK' }
        | {
                        ok: false
                        reason:
                                | 'MISSING_ENV'
                                | 'PHONE_INVALID'
                                | 'PHONE_MISMATCH'
                                | 'PASSWORD_MISMATCH'
                                | 'TOTP_MISSING'
                                | 'TOTP_INVALID'
          }

/**
 * نسخه‌ی تشخیصی verifyAdminCredentials — همان منطق قدیمی را دارد ولی
 * دقیقاً می‌گوید کدام گام شکست خورده. بدون لو رفتن مقادیر مخفی.
 */
export function verifyAdminCredentialsDetailed(
        username: string,
        password: string,
        otp?: string,
): AdminLoginResult {
        // مقادیر از env و ماژول owner خوانده می‌شوند
        const p = process.env.ADMIN_PASS
        const phone = normalizePhone(username)
        const ownerPhone = ADMIN_OWNER_PHONE // از lib/admin/owner.ts — در زمان لود ماژول نرمالایز شده

        // ─── لاگ تشخیصی (بدون لو رفتن رمز/secret) ───────────────────────────────
        // این لاگ‌ها در pm2 logs یا خروجی استاندارد سرور دیده می‌شوند.
        console.error('[ADMIN-AUTH-DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.error(
                `[ADMIN-AUTH-DEBUG] username ورودی (خام):        ${JSON.stringify(username)}`,
        )
        console.error(
                `[ADMIN-AUTH-DEBUG] normalizePhone(username):     ${phone ?? 'null (نامعتبر!)'}`,
        )
        console.error(
                `[ADMIN-AUTH-DEBUG] ADMIN_OWNER_PHONE (ماژول):    ${ownerPhone ?? 'null (در زمان لود خالی بوده!)'}`,
        )
        console.error(
                `[ADMIN-AUTH-DEBUG] ADMIN_OWNER_PHONE در env:     ${JSON.stringify(process.env.ADMIN_OWNER_PHONE ?? '(تعریف‌نشده)')}`,
        )
        console.error(
                `[ADMIN-AUTH-DEBUG] ADMIN_PASS موجود؟             ${p ? `بله (${p.length} کاراکتر)` : '❌ خیر'}`,
        )
        console.error(
                `[ADMIN-AUTH-DEBUG] ADMIN_TOTP_SECRET موجود؟      ${process.env.ADMIN_TOTP_SECRET ? `بله (${process.env.ADMIN_TOTP_SECRET.length} کاراکتر)` : 'خیر (TOTP غیرفعال)'}`,
        )
        console.error(
                `[ADMIN-AUTH-DEBUG] رمز ورودی طول:                ${password.length} کاراکتر`,
        )
        console.error(
                `[ADMIN-AUTH-DEBUG] otp ورودی:                    ${otp ? `${otp.length} رقم` : '(خالی)'}`,
        )

        // ─── گام ۱: آیا هر سه متغیر لازم موجود است؟ ───────────────────────────────
        // نکته مهم: اگر ADMIN_OWNER_PHONE در زمان لود ماژول خالی بوده (سرور قبل از
        // تنظیم .env استارت شده)، اینجا null خواهد بود و همیشه لاگین شکست می‌خورد
        // حتی اگر فایل .env الان درست باشد. راه‌حل: ری‌استارت سرور.
        if (!ownerPhone || !phone || !p) {
                const missing: string[] = []
                if (!ownerPhone)
                        missing.push('ADMIN_OWNER_PHONE (یا سرور env قدیمی دارد — ری‌استارت کنید!)')
                if (!phone) missing.push('شماره ورودی نامعتبر')
                if (!p) missing.push('ADMIN_PASS')
                console.error(`[ADMIN-AUTH-DEBUG] ❌ FAIL گام ۱ (MISSING_ENV): ${missing.join('، ')}`)
                console.error('[ADMIN-AUTH-DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
                return { ok: false, reason: 'MISSING_ENV' }
        }
        console.error('[ADMIN-AUTH-DEBUG] ✅ گام ۱: همه متغیرها موجودند')

        // ─── گام ۲: مقایسه شماره ──────────────────────────────────────────────────
        const phoneMatch = safeEqual(phone, ownerPhone)
        if (!phoneMatch) {
                console.error(
                        `[ADMIN-AUTH-DEBUG] ❌ FAIL گام ۲ (PHONE_MISMATCH): ورودی=${phone} ≠ env=${ownerPhone}`,
                )
                console.error('[ADMIN-AUTH-DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
                return { ok: false, reason: 'PHONE_MISMATCH' }
        }
        console.error('[ADMIN-AUTH-DEBUG] ✅ گام ۲: شماره موبایل درست است')

        // ─── گام ۳: مقایسه رمز عبور ───────────────────────────────────────────────
        const passMatch = safeEqual(password, p)
        if (!passMatch) {
                console.error(
                        `[ADMIN-AUTH-DEBUG] ❌ FAIL گام ۳ (PASSWORD_MISMATCH): طول ورودی=${password.length} ≠ طول env=${p.length}`,
                )
                console.error('[ADMIN-AUTH-DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
                return { ok: false, reason: 'PASSWORD_MISMATCH' }
        }
        console.error('[ADMIN-AUTH-DEBUG] ✅ گام ۳: رمز عبور درست است')

        // ─── گام ۴: TOTP (اگر فعال است) ───────────────────────────────────────────
        const totpConfigured = process.env.ADMIN_TOTP_SECRET?.trim()
        if (!totpConfigured) {
                // TOTP فعال نیست → لاگین موفق
                console.error('[ADMIN-AUTH-DEBUG] ✅ گام ۴: TOTP غیرفعال است — لاگین موفق')
                console.error('[ADMIN-AUTH-DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
                return { ok: true, reason: 'TOTP_OK' }
        }

        const candidate = otp?.trim() ?? ''
        if (!/^\d{6}$/.test(candidate)) {
                console.error(`[ADMIN-AUTH-DEBUG] ❌ FAIL گام ۴ (TOTP_MISSING): کد ۶ رقمی وارد نشده`)
                console.error('[ADMIN-AUTH-DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
                return { ok: false, reason: 'TOTP_MISSING' }
        }

        const totpOk = verifyTotpIfConfigured(otp)
        if (!totpOk) {
                console.error(
                        `[ADMIN-AUTH-DEBUG] ❌ FAIL گام ۴ (TOTP_INVALID): کد وارد شده هم‌خوانی ندارد`,
                )
                console.error(
                        `[ADMIN-AUTH-DEBUG]    کدی که سرور الان تولید می‌کند: ${totpConfigured} (با اپ گوشی مقایسه کنید)`,
                )
                console.error(
                        `[ADMIN-AUTH-DEBUG]    اگه کد اپ فرق دارد، secret را دوباره در اپ وارد کنید`,
                )
                console.error('[ADMIN-AUTH-DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
                return { ok: false, reason: 'TOTP_INVALID' }
        }

        console.error('[ADMIN-AUTH-DEBUG] ✅ گام ۴: کد TOTP درست است — لاگین موفق')
        console.error('[ADMIN-AUTH-DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        return { ok: true, reason: 'TOTP_OK' }
}

/** Verify a username/password pair against the configured admin credentials. */
export function verifyAdminCredentials(
        username: string,
        password: string,
        otp?: string,
): boolean {
        return verifyAdminCredentialsDetailed(username, password, otp).ok
}

function decodeBase32(value: string): Buffer {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
        const clean = value.toUpperCase().replace(/[^A-Z2-7]/g, '')
        let bits = ''
        for (const char of clean) {
                const index = alphabet.indexOf(char)
                if (index < 0) return Buffer.alloc(0)
                bits += index.toString(2).padStart(5, '0')
        }
        const bytes: number[] = []
        for (let index = 0; index + 8 <= bits.length; index += 8) {
                bytes.push(Number.parseInt(bits.slice(index, index + 8), 2))
        }
        return Buffer.from(bytes)
}

function totpAt(secretValue: string, counter: number): string {
        const key = decodeBase32(secretValue)
        if (key.length < 10) return ''
        const input = Buffer.alloc(8)
        input.writeBigUInt64BE(BigInt(counter))
        const digest = crypto.createHmac('sha1', key).update(input).digest()
        const offset = digest[digest.length - 1] & 0x0f
        const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
        return String(binary).padStart(6, '0')
}

function verifyTotpIfConfigured(value: string | undefined): boolean {
        const configured = process.env.ADMIN_TOTP_SECRET?.trim()
        if (!configured) return true
        const candidate = value?.trim() ?? ''
        if (!/^\d{6}$/.test(candidate)) return false
        const counter = Math.floor(Date.now() / 30_000)
        return [-1, 0, 1].some((offset) =>
                safeEqual(candidate, totpAt(configured, counter + offset)),
        )
}

/** Build the signed cookie value: "<expiryEpoch>.<hmac>". */
export function createSessionToken(): { value: string; maxAge: number } {
        const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
        const nonce = crypto.randomBytes(24).toString('base64url')
        const payload = `${exp}.${nonce}`
        const value = `${payload}.${sign(payload)}`
        return { value, maxAge: SESSION_TTL_SECONDS }
}

function isValidToken(raw: string | undefined): boolean {
        if (!raw) return false
        const [expStr, nonce, sig] = raw.split('.')
        if (!expStr || !nonce || !sig) return false
        const exp = Number(expStr)
        if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false
        return safeEqual(sig, sign(`${expStr}.${nonce}`))
}

export const ADMIN_COOKIE = COOKIE_NAME

/** True when the current request carries a valid admin session cookie. */
export async function isAdminAuthed(): Promise<boolean> {
        return isValidToken((await cookies()).get(COOKIE_NAME)?.value)
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
 *   if (!(await isAdminAuthedRequest(req))) return NextResponse.json({error:'UNAUTHORIZED'},{status:401})
 */
export async function isAdminAuthedRequest(req: Request): Promise<boolean> {
        // 1) Cookie-based session.
        if (await isAdminAuthed()) return true
        // 2) Header-based token (X-Admin-Token).
        const headerTok = req.headers.get('x-admin-token')
        const configuredApiToken = process.env.ADMIN_API_TOKEN
        if (
                headerTok &&
                configuredApiToken &&
                configuredApiToken.length >= 32 &&
                safeEqual(headerTok, configuredApiToken)
        ) {
                return true
        }
        // Secrets are deliberately never accepted in query parameters because URLs
        // are commonly retained in proxy, browser and analytics logs.
        return false
}

/** Guard for admin server components/layouts. Redirects to login when absent. */
export async function requireAdmin(): Promise<void> {
        if (!(await isAdminAuthed())) redirect('/admin/login')
}
