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
 * پیام خطای کلاینت عمداً عمومی است: گفتن اینکه «کدام مرحله» شکست خورد
 * (شماره درست بود؟ رمز درست بود؟ فقط TOTP مانده؟) به مهاجم ناشناس یک
 * Oracle مرحله‌به‌مرحله می‌دهد. فقط خطای پیکربندی سرور — که ربطی به
 * صحت اطلاعات ورودی ندارد — جدا اعلام می‌شود؛ کد دلیل دقیق در لاگ سرور
 * (بدون هیچ مقدار حساس) ثبت می‌شود.
 */
const GENERIC_LOGIN_ERROR_FA = 'اطلاعات ورود نادرست است.'
const MISSING_ENV_ERROR_FA =
        'خطای پیکربندی سرور: متغیرهای محیطی ادمین کامل نیست. سرور را بررسی و ری‌استارت کنید.'

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

        const result = verifyAdminCredentialsDetailed(username, password, otp)

        if (!result.ok) {
                return {
                        error:
                                result.reason === 'MISSING_ENV'
                                        ? MISSING_ENV_ERROR_FA
                                        : GENERIC_LOGIN_ERROR_FA,
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
