import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  incr: vi.fn(),
  expire: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  otpLogCreate: vi.fn(),
  persistLog: vi.fn(),
  captureError: vi.fn(),
  captureWarning: vi.fn(),
}))

vi.mock('@/lib/redis', () => ({
  getRedis: () => ({ incr: mocks.incr, expire: mocks.expire, set: mocks.set, del: mocks.del }),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { oTPLog: { create: mocks.otpLogCreate } },
}))
vi.mock('@/lib/errors/capture', () => ({
  persistLog: mocks.persistLog,
  captureError: mocks.captureError,
  captureWarning: mocks.captureWarning,
}))

import { OtpRateLimitError, sendOTP } from '@/lib/sms/ippanel'

const originalEnv = { ...process.env }

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.incr.mockResolvedValue(1)
  mocks.expire.mockResolvedValue(1)
  mocks.set.mockResolvedValue('OK')
  mocks.del.mockResolvedValue(1)
  mocks.otpLogCreate.mockResolvedValue({})
  mocks.persistLog.mockResolvedValue(undefined)
  delete process.env.IPPANEL_PROXY_URL
  delete process.env.IPPANEL_API_KEY
  delete process.env.IPPANEL_PATTERN_CODE
  delete process.env.IPPANEL_FROM_NUMBER
})

afterEach(() => {
  vi.unstubAllEnvs()
  process.env = { ...originalEnv }
  vi.unstubAllGlobals()
})

describe('OTP send observability', () => {
  it('logs the generated code and creates the OTP audit row in development', async () => {
    await sendOTP('09123456789', { ip: 'test-ip', requestId: 'request-12345678' })

    expect(mocks.set).toHaveBeenCalledWith('otp:+989123456789', expect.stringMatching(/^\d{6}$/), 'EX', 600)
    expect(mocks.otpLogCreate).toHaveBeenCalledWith({
      data: { phone: '+989123456789', ip: 'test-ip' },
    })
    expect(mocks.persistLog).toHaveBeenCalledWith(
      'info',
      'auth:otp:generated',
      'OTP generated for phone login',
      expect.objectContaining({
        exposeOtpCode: true,
        metadata: expect.objectContaining({
          phone: '+989123456789',
          otpCode: expect.stringMatching(/^\d{6}$/),
          requestId: 'request-12345678',
        }),
      }),
    )
  })

  it('never exposes a generated OTP in production even when the legacy override is enabled', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('LOG_OTP_CODES', 'true')
    process.env.IPPANEL_PROXY_URL = 'https://sms.example.test/otp'
    process.env.IPPANEL_PATTERN_CODE = 'pattern'
    process.env.IPPANEL_FROM_NUMBER = '+983000505'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ meta: { status: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ))

    await sendOTP('09123456789', { requestId: 'request-12345678' })

    expect(mocks.persistLog).toHaveBeenCalledWith(
      'info',
      'auth:otp:generated',
      'OTP generated for phone login',
      expect.objectContaining({ exposeOtpCode: false }),
    )
  })

  it('logs and rejects phone send-rate limits before generating a code', async () => {
    mocks.incr.mockResolvedValue(4)

    await expect(sendOTP('09123456789', { requestId: 'request-12345678' })).rejects.toBeInstanceOf(OtpRateLimitError)
    expect(mocks.set).not.toHaveBeenCalled()
    expect(mocks.persistLog).toHaveBeenCalledWith(
      'warn',
      'auth:otp:send-rate-limit',
      expect.any(String),
      expect.objectContaining({ metadata: expect.objectContaining({ attempts: 4 }) }),
    )
  })

  it('invalidates an undelivered OTP when the provider fails', async () => {
    process.env.IPPANEL_PROXY_URL = 'https://sms.example.test/otp'
    process.env.IPPANEL_PATTERN_CODE = 'pattern'
    process.env.IPPANEL_FROM_NUMBER = '+983000505'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('provider down', { status: 503 })))

    await expect(sendOTP('09123456789', { requestId: 'request-12345678' })).rejects.toThrow('SMS_FAILED')
    expect(mocks.del).toHaveBeenCalledWith('otp:+989123456789')
    expect(mocks.captureError).toHaveBeenCalledWith(
      'auth:otp:send-failed',
      expect.any(Error),
      expect.objectContaining({ metadata: expect.objectContaining({ requestId: 'request-12345678' }) }),
    )
  })
})
