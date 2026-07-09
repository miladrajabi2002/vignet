import { PhoneOtpForm } from '@/components/auth/phone-otp-form'

const PAID_PLANS = new Set(['STARTER', 'PRO', 'BUSINESS'])

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
