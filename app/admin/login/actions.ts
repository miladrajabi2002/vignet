'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import {
	verifyAdminCredentials,
	createSessionToken,
	ADMIN_COOKIE,
} from '@/lib/admin/auth'
import { rateLimit } from '@/lib/ratelimit'
import { getClientIp } from '@/lib/security/request-ip'
import { normalizePhone } from '@/lib/phone'

export type AdminLoginState = { error?: string }

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
		return { error: 'تلاش‌های ورود بیش از حد مجاز است؛ ۱۵ دقیقه دیگر دوباره امتحان کنید.' }
	}

	if (!verifyAdminCredentials(username, password, otp)) {
		return { error: 'نام کاربری یا رمز عبور اشتباه است' }
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
