'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import {
        verifyAdminCredentialsDetailed,
        createSessionToken,
        ADMIN_COOKIE,
} from '@/lib/admin/auth'
import { rateLimit } from '@/lib/ratelimit'
import { getClientIp } from '@/lib/security/request-ip'
import { normalizePhone } from '@/lib/phone'

export type AdminLoginState = { error?: string }

/**
 * 🔍 نسخه‌ی تشخیصی adminLogin — به‌جای یک پیام خطای کلی، دقیقاً می‌گوید
 * کدام گام شکست خورده. این فقط برای دیباگ است؛ بعد از حل مشکل می‌توانید
 * به نسخه‌ی اصلی برگردید.
 *
 * پیام‌های خطا (موقت برای دیباگ):
 *   - شماره موبایل اشتباه است
 *   - رمز عبور اشتباه است
 *   - کد یک‌بارمصرف اشتباه است
 *   - کد یک‌بارمصرف وارد نشده است
 *   - خطای پیکربندی سرور (env قدیمی — سرور را ری‌استارت کنید)
 */
const REASON_MESSAGES_FA: Record<string, string> = {
        MISSING_ENV:
                'خطای پیکربندی سرور: یکی از متغیرهای محیطی موجود نیست. احتمالاً سرور env قدیمی دارد — سرور را ری‌استارت کنید (pm2 restart all / systemctl restart vignet / docker compose restart)',
        PHONE_INVALID: 'شماره موبایل وارد شده نامعتبر است. فرمت درست: 09123456789',
        PHONE_MISMATCH: 'شماره موبایل اشتباه است (با شماره مدیر پلتفرم برابر نیست)',
        PASSWORD_MISMATCH: 'شماره موبایل درست بود، ولی رمز عبور اشتباه است',
        TOTP_MISSING: 'کد یک‌بارمصرف امنیتی وارد نشده است',
        TOTP_INVALID:
                'شماره و رمز درست بودند، ولی کد یک‌بارمصرف اشتباه است (با اپ احراز هویت چک کنید)',
}

export async function adminLogin(
        _prev: AdminLoginState,
        formData: FormData,
): Promise<AdminLoginState> {
        const username = String(formData.get('username') ?? '')
        const password = String(formData.get('password') ?? '')
        const otp = String(formData.get('otp') ?? '')
        const ip = getClientIp(await headers())
        const accountKey = normalizePhone(username) || 'invalid'
        const [ipAllowed, accountAllowed] = await Promise.all([
                rateLimit(`admin-login-ip:${ip}`, 8, 15 * 60, { failClosed: true }),
                rateLimit(`admin-login-account:${accountKey}`, 5, 15 * 60, { failClosed: true }),
        ])
        if (!ipAllowed || !accountAllowed) {
                return {
                        error: 'تلاش‌های ورود بیش از حد مجاز است؛ ۱۵ دقیقه دیگر دوباره امتحان کنید.',
                }
        }

        // 🔍 نسخه‌ی تشخیصی: به‌جای boolean، دلیل دقیق شکست را می‌گیریم
        const result = verifyAdminCredentialsDetailed(username, password, otp)

        if (!result.ok) {
                // پیام مشخص بر اساس دلیل
                const specificMessage = REASON_MESSAGES_FA[result.reason] || 'خطای ناشناخته'
                return {
                        error: `❌ ${specificMessage} (کد: ${result.reason})`,
                }
        }

        const { value, maxAge } = createSessionToken()
        const cookieStore = await cookies()
        cookieStore.set(ADMIN_COOKIE, value, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge,
        })

        redirect('/admin')
}

export async function adminLogout(): Promise<void> {
        const cookieStore = await cookies()
        cookieStore.delete(ADMIN_COOKIE)
        redirect('/admin/login')
}
