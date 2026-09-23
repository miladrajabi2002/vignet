import { normalizePhone } from '@/lib/phone'

/**
 * Static-OTP bypass for shared company logins.
 *
 * Some business accounts sign in from several shared workstations during the
 * day, and the SIM that would receive the OTP SMS is not always reachable.
 * For those phones the login flow keeps every step (send → check → sign-in →
 * registration/onboarding) but the SMS delivery step is skipped and both
 * verification paths accept the fixed code below instead of a Redis OTP.
 *
 * The phone list and the code are environment configuration on purpose, so
 * they can be rotated without a redeploy:
 *   STATIC_OTP_PHONES — comma-separated Iranian mobiles (any common format).
 *   STATIC_OTP_CODE   — the fixed 6-digit code accepted for those phones.
 *
 * Security posture (explicit operator decision, account-owner's risk):
 *  - Attempt limits keep applying: `allowOtpVerificationAttempt` still gates
 *    every check/sign-in for these phones, so the fixed code cannot be
 *    brute-forced faster than 10 tries per phone per 10 minutes.
 *  - No OTP SMS is sent and no `OTPLog`/`SmsDelivery` row is written for
 *    these phones — the audit trail is the persistLog events instead.
 *  - Registration/onboarding is untouched: a first-time static-phone login
 *    still requires a name and creates the workspace exactly as before.
 */

/** Default: the operator-approved shared company login (09357356164). */
const DEFAULT_STATIC_PHONES = ['09357356164']

/** Default fixed code; overridable via STATIC_OTP_CODE (must stay 6 digits). */
const DEFAULT_STATIC_CODE = '112358'

function configuredStaticPhones(): string[] {
  const raw = process.env.STATIC_OTP_PHONES ?? DEFAULT_STATIC_PHONES.join(',')
  return raw
    .split(',')
    .map((value) => normalizePhone(value.trim()))
    .filter((phone): phone is string => Boolean(phone))
}

/** True when this phone logs in with the fixed code instead of SMS OTP. */
export function isStaticOtpPhone(mobile: string): boolean {
  const normalized = normalizePhone(mobile)
  if (!normalized) return false
  return configuredStaticPhones().includes(normalized)
}

/** Compare a candidate code against the configured fixed code. */
export function matchesStaticOtpCode(code: string): boolean {
  const expected = (process.env.STATIC_OTP_CODE ?? DEFAULT_STATIC_CODE)
    .replace(/\D/g, '')
  return expected.length === 6 && code === expected
}
