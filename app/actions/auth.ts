'use server'

import { cookies } from 'next/headers'
import { signOut } from '@/auth'
import { ONBOARDING_SKIP_COOKIE } from '@/lib/onboarding'

export async function logout() {
  await signOut({ redirectTo: '/login' })
}

/** Hide the onboarding flow without marking it complete (per spec). */
export async function skipOnboarding() {
  cookies().set(ONBOARDING_SKIP_COOKIE, '1', {
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
  })
}
