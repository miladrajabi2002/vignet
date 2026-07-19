import { rateLimit } from '@/lib/ratelimit'
import { getClientIp } from '@/lib/security/request-ip'

const VERIFY_WINDOW_SECONDS = 10 * 60
const VERIFY_MAX_PER_PHONE = 10
const VERIFY_MAX_PER_CLIENT = 30

/**
 * Limit anonymous OTP verification, not just OTP delivery. Without this gate a
 * six-digit code can be brute-forced through the Credentials callback.
 */
export async function allowOtpVerificationAttempt(
  phone: string,
  headers: Pick<Headers, 'get'>,
): Promise<boolean> {
  const ip = getClientIp(headers)
  const [phoneAllowed, clientAllowed] = await Promise.all([
    rateLimit(`otp_verify_phone:${phone}`, VERIFY_MAX_PER_PHONE, VERIFY_WINDOW_SECONDS, {
      failClosed: true,
    }),
    rateLimit(`otp_verify_client:${ip}`, VERIFY_MAX_PER_CLIENT, VERIFY_WINDOW_SECONDS, {
      failClosed: true,
    }),
  ])
  return phoneAllowed && clientAllowed
}

