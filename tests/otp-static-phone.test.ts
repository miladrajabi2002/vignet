import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  eval: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  otpLogCreate: vi.fn(),
  otpLogFindFirst: vi.fn(),
  otpLogUpdate: vi.fn(),
  smsDeliveryCreate: vi.fn(),
  persistLog: vi.fn(),
  captureError: vi.fn(),
  captureWarning: vi.fn(),
}))

vi.mock('@/lib/redis', () => ({
  getRedis: () => ({ eval: mocks.eval, incr: mocks.incr, expire: mocks.expire, set: mocks.set, del: mocks.del }),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    oTPLog: { create: mocks.otpLogCreate, findFirst: mocks.otpLogFindFirst, update: mocks.otpLogUpdate },
    smsDelivery: { create: mocks.smsDeliveryCreate },
  },
}))
vi.mock('@/lib/errors/capture', () => ({
  captureError: mocks.captureError,
  captureWarning: mocks.captureWarning,
  persistLog: mocks.persistLog,
}))

import { isOTPValid, sendOTP, verifyOTP } from '@/lib/sms/ippanel'
import { isStaticOtpPhone, matchesStaticOtpCode } from '@/lib/sms/static-otp'

const originalEnv = { ...process.env }

/** The operator-approved shared company login phone. */
const STATIC_PHONE = '09357356164'
const STATIC_E164 = '+989357356164'

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.incr.mockResolvedValue(1)
  mocks.expire.mockResolvedValue(1)
  mocks.set.mockResolvedValue('OK')
  mocks.del.mockResolvedValue(1)
  mocks.otpLogCreate.mockResolvedValue({})
  mocks.smsDeliveryCreate.mockResolvedValue({})
  mocks.persistLog.mockResolvedValue(undefined)
  delete process.env.IPPANEL_PROXY_URL
  delete process.env.IPPANEL_API_KEY
  delete process.env.IPPANEL_PATTERN_CODE
  delete process.env.IPPANEL_FROM_NUMBER
  delete process.env.STATIC_OTP_PHONES
  delete process.env.STATIC_OTP_CODE
})

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('static OTP phone configuration', () => {
  it('treats the default shared phone as static in every common format', () => {
    expect(isStaticOtpPhone(STATIC_PHONE)).toBe(true)
    expect(isStaticOtpPhone('+989357356164')).toBe(true)
    expect(isStaticOtpPhone('989357356164')).toBe(true)
    expect(isStaticOtpPhone('۰۹۳۵۷۳۵۶۱۶۴')).toBe(true)
  })

  it('keeps regular phones on the SMS OTP path', () => {
    expect(isStaticOtpPhone('09123456789')).toBe(false)
    expect(isStaticOtpPhone('')).toBe(false)
  })

  it('honors a custom STATIC_OTP_PHONES list from the environment', () => {
    process.env.STATIC_OTP_PHONES = '09121110000, 09357356164'
    expect(isStaticOtpPhone('09121110000')).toBe(true)
    expect(isStaticOtpPhone('09357356164')).toBe(true)
    expect(isStaticOtpPhone('09351112222')).toBe(false)
  })

  it('accepts only the configured 6-digit fixed code', () => {
    expect(matchesStaticOtpCode('112358')).toBe(true)
    expect(matchesStaticOtpCode('000000')).toBe(false)
    expect(matchesStaticOtpCode('')).toBe(false)
    process.env.STATIC_OTP_CODE = '654321'
    expect(matchesStaticOtpCode('654321')).toBe(true)
    expect(matchesStaticOtpCode('112358')).toBe(false)
  })
})

describe('sendOTP for the shared static phone', () => {
  it('sends no SMS, stores no Redis code and writes no OTP audit row', async () => {
    await expect(sendOTP(STATIC_PHONE, { ip: 'office-ip', requestId: 'req-1' })).resolves.toBeUndefined()

    expect(mocks.incr).not.toHaveBeenCalled()
    expect(mocks.set).not.toHaveBeenCalled()
    expect(mocks.otpLogCreate).not.toHaveBeenCalled()
    expect(mocks.smsDeliveryCreate).not.toHaveBeenCalled()
    expect(mocks.persistLog).toHaveBeenCalledWith(
      'info',
      'auth:otp:static-phone-send-skipped',
      expect.any(String),
      expect.objectContaining({ metadata: expect.objectContaining({ phone: STATIC_E164 }) }),
    )
  })

  it('keeps regular phones on the development delivery path', async () => {
    await sendOTP('09123456789', { ip: 'test-ip' })

    expect(mocks.set).toHaveBeenCalledWith('otp:+989123456789', expect.stringMatching(/^\d{6}$/), 'EX', 600)
    expect(mocks.otpLogCreate).toHaveBeenCalledOnce()
  })
})

describe('verification for the shared static phone', () => {
  it('accepts the fixed code on sign-in without touching Redis', async () => {
    await expect(verifyOTP(STATIC_PHONE, '112358')).resolves.toBe(true)
    expect(mocks.eval).not.toHaveBeenCalled()
    expect(mocks.otpLogFindFirst).not.toHaveBeenCalled()
  })

  it('rejects a wrong fixed code on sign-in', async () => {
    await expect(verifyOTP(STATIC_PHONE, '999999')).resolves.toBe(false)
    expect(mocks.eval).not.toHaveBeenCalled()
  })

  it('accepts the fixed code during registration check without consuming it', async () => {
    await expect(isOTPValid(STATIC_PHONE, '112358')).resolves.toBe(true)
    expect(mocks.eval).not.toHaveBeenCalled()
  })

  it('still verifies regular phones through Redis', async () => {
    mocks.eval.mockResolvedValue(1)
    mocks.otpLogFindFirst.mockResolvedValue(null)

    await expect(verifyOTP('09123456789', '123456')).resolves.toBe(true)
    expect(mocks.eval).toHaveBeenCalledOnce()
    expect(mocks.eval.mock.calls[0][2]).toBe('otp:+989123456789')
  })

  it('honors a rotated STATIC_OTP_CODE from the environment', async () => {
    process.env.STATIC_OTP_CODE = '246810'
    await expect(verifyOTP(STATIC_PHONE, '112358')).resolves.toBe(false)
    await expect(verifyOTP(STATIC_PHONE, '246810')).resolves.toBe(true)
  })
})
