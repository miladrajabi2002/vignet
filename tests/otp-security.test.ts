import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  eval: vi.fn(),
  rateLimit: vi.fn(),
}))

vi.mock('@/lib/redis', () => ({
  getRedis: () => ({ eval: mocks.eval }),
}))
vi.mock('@/lib/ratelimit', () => ({
  rateLimit: mocks.rateLimit,
}))

import { isOTPValid, verifyOTP } from '@/lib/sms/ippanel'
import { allowOtpVerificationAttempt } from '@/lib/security/otp-attempts'

beforeEach(() => {
  mocks.eval.mockReset()
  mocks.rateLimit.mockReset()
})

describe('OTP verification security', () => {
  it('atomically consumes a matching OTP', async () => {
    mocks.eval.mockResolvedValue(1)

    await expect(verifyOTP('09123456789', '123456')).resolves.toBe(true)
    expect(mocks.eval).toHaveBeenCalledOnce()
    const [script, keyCount, key, value] = mocks.eval.mock.calls[0]
    expect(script).toContain("redis.call('GET', KEYS[1])")
    expect(script).toContain("redis.call('DEL', KEYS[1])")
    expect([keyCount, key, value]).toEqual([1, 'otp:+989123456789', '123456'])
  })

  it('does not accept an OTP that Redis did not consume', async () => {
    mocks.eval.mockResolvedValue(0)
    await expect(verifyOTP('09123456789', '000000')).resolves.toBe(false)
  })

  it('can validate an OTP without consuming it during registration', async () => {
    mocks.eval.mockResolvedValue(1)

    await expect(isOTPValid('09123456789', '123456')).resolves.toBe(true)
    const [script, keyCount, key, value] = mocks.eval.mock.calls[0]
    expect(script).toContain("redis.call('GET', KEYS[1])")
    expect(script).not.toContain("redis.call('DEL', KEYS[1])")
    expect([keyCount, key, value]).toEqual([1, 'otp:+989123456789', '123456'])
  })

  it('fails closed on either the phone or client verification limit', async () => {
    mocks.rateLimit.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const headers = new Headers({ 'user-agent': 'vitest', 'accept-language': 'fa' })

    await expect(allowOtpVerificationAttempt('989123456789', headers)).resolves.toBe(false)
    expect(mocks.rateLimit).toHaveBeenCalledTimes(2)
    expect(mocks.rateLimit.mock.calls[0]).toEqual([
      'otp_verify_phone:989123456789',
      10,
      600,
      { failClosed: true },
    ])
    expect(mocks.rateLimit.mock.calls[1][0]).toMatch(/^otp_verify_client:fp:/)
    expect(mocks.rateLimit.mock.calls[1].slice(1)).toEqual([30, 600, { failClosed: true }])
  })
})
