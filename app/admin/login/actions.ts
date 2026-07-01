'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
	verifyAdminCredentials,
	createSessionToken,
	ADMIN_COOKIE,
} from '@/lib/admin/auth'

export type AdminLoginState = { error?: string }

export async function adminLogin(
	_prev: AdminLoginState,
	formData: FormData,
): Promise<AdminLoginState> {
	const username = String(formData.get('username') ?? '')
	const password = String(formData.get('password') ?? '')

	if (!verifyAdminCredentials(username, password)) {
		return { error: 'نام کاربری یا رمز عبور اشتباه است' }
	}

	const { value, maxAge } = createSessionToken()
	cookies().set(ADMIN_COOKIE, value, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		path: '/',
		maxAge,
	})

	redirect('/admin')
}

export async function adminLogout(): Promise<void> {
	cookies().delete(ADMIN_COOKIE)
	redirect('/admin/login')
}
