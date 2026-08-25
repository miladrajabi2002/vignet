import { describe, expect, it } from 'vitest'
import { validateProductionEnv } from '@/lib/config/production-env'

const validEnv = {
  DATABASE_URL: 'postgresql://app:secret@db:5432/vigent',
  DIRECT_URL: 'postgresql://app:secret@db:5432/vigent',
  AUTH_SECRET: 'a'.repeat(32),
  NEXTAUTH_SECRET: 'b'.repeat(32),
  NEXTAUTH_URL: 'https://vigent.ir',
  NEXT_PUBLIC_APP_URL: 'https://vigent.ir',
  NEXT_PUBLIC_SITE_URL: 'https://vigent.ir',
  NEXT_PUBLIC_WIDGET_URL: 'https://vigent.ir',
  ADMIN_OWNER_PHONE: '+989121234567',
  ADMIN_PASS: 'c'.repeat(16),
  ADMIN_SESSION_SECRET: 'd'.repeat(32),
  ADMIN_TOTP_SECRET: 'JBSWY3DPEHPK3PXP',
  PUBLIC_CONVERSATION_SECRET: 'e'.repeat(32),
  ENCRYPTION_KEY: 'f'.repeat(64),
  REDIS_URL: 'redis://127.0.0.1:6379',
  OPENROUTER_API_KEY: 'sk-or-v1-production',
  S3_ENDPOINT: 'http://127.0.0.1:9000',
  S3_ACCESS_KEY: 'vigent-storage',
  S3_SECRET_KEY: 'g'.repeat(24),
  BACKUP_S3_ENDPOINT: 'https://backups.example.net',
  BACKUP_S3_ACCESS_KEY: 'vigent-offsite',
  BACKUP_S3_SECRET_KEY: 'i'.repeat(24),
  ZARINPAY_ACCESS_TOKEN: 'zarinpay-production-token',
  ZARINPAY_STORE_ID: '42',
  TRUST_PROXY_HEADERS: '1',
  IPPANEL_PROXY_URL: 'https://sms.example.ir/vigent-otp',
  IPPANEL_PROXY_SECRET: 'h'.repeat(32),
  IPPANEL_PATTERN_CODE: 'otp-pattern',
  IPPANEL_FROM_NUMBER: '+983000505',
  IPPANEL_ADMIN_SUBSCRIPTION_PURCHASED_PATTERN_CODE: 'admin-purchase-pattern',
  IPPANEL_ADMIN_SUBSCRIPTION_RENEWED_PATTERN_CODE: 'admin-renewal-pattern',
  IPPANEL_ADMIN_CREDIT_TOPPED_UP_PATTERN_CODE: 'admin-credit-pattern',
  FINANCE_USD_TO_IRR: '900000',
}

describe('production environment gate', () => {
  it('accepts a complete launch configuration without exposing values', () => {
    expect(validateProductionEnv(validEnv)).toEqual({ errors: [], warnings: [] })
  })

  it('rejects local public URLs, disabled TLS verification and missing OTP delivery', () => {
    const { errors } = validateProductionEnv({
      ...validEnv,
      NEXT_PUBLIC_APP_URL: 'http://localhost:3003',
      NODE_TLS_REJECT_UNAUTHORIZED: '0',
      IPPANEL_PROXY_URL: '',
      IPPANEL_PROXY_SECRET: '',
      IPPANEL_PATTERN_CODE: '',
      IPPANEL_FROM_NUMBER: '',
    })

    expect(errors).toContain('NEXT_PUBLIC_APP_URL: production URL must use https')
    expect(errors).toContain('NEXT_PUBLIC_APP_URL: production URL cannot point to a local host')
    expect(errors).toContain('NODE_TLS_REJECT_UNAUTHORIZED: must never be 0 in production')
    expect(errors.some((error) => error.startsWith('OTP delivery:'))).toBe(true)
  })

  it('flags partial optional integrations without blocking launch', () => {
    const report = validateProductionEnv({ ...validEnv, NOWPAYMENTS_API_KEY: 'configured' })
    expect(report.errors).toEqual([])
    expect(report.warnings).toContain('NOWPayments: partial configuration; missing NOWPAYMENTS_IPN_SECRET')
  })

  it('rejects an invalid commercial SMS recipient instead of silently dropping alerts', () => {
    const { errors } = validateProductionEnv({
      ...validEnv,
      ADMIN_COMMERCIAL_SMS_PHONE: 'not-a-phone',
    })

    expect(errors).toContain('ADMIN_COMMERCIAL_SMS_PHONE: invalid Iranian mobile number')
  })

  it('requires all three pre-approved admin commercial patterns', () => {
    const { errors } = validateProductionEnv({
      ...validEnv,
      IPPANEL_ADMIN_SUBSCRIPTION_RENEWED_PATTERN_CODE: '',
    })

    expect(errors).toContain('IPPANEL_ADMIN_SUBSCRIPTION_RENEWED_PATTERN_CODE: missing')
  })

  it('rejects any production configuration that exposes OTP codes in logs', () => {
    const { errors } = validateProductionEnv({ ...validEnv, LOG_OTP_CODES: 'true' })

    expect(errors).toContain(
      'LOG_OTP_CODES: must be false in production; OTPs must never be written to logs',
    )
  })
})
