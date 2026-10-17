import type { Metadata } from 'next'
import { PhoneOtpForm } from '@/components/auth/phone-otp-form'

const PAID_PLANS = new Set(['STARTER', 'PRO', 'BUSINESS'])
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir'

export const metadata: Metadata = {
  title: 'ورود و ثبت‌نام',
  alternates: { canonical: `${SITE_URL}/login` },
  robots: { index: false, follow: true, noarchive: true, nosnippet: true },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; next?: string }>
}) {
  const query = await searchParams
  const plan = query.plan && PAID_PLANS.has(query.plan) ? query.plan : undefined
  const nextPath = query.next?.startsWith('/') && !query.next.startsWith('//')
    ? query.next
    : undefined

  return <PhoneOtpForm preferredPlan={plan} nextPath={nextPath} />
}
