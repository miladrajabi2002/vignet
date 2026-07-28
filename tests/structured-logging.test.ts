import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ create: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: { errorLog: { create: mocks.create } },
}))

import { persistLog } from '@/lib/errors/capture'

beforeEach(() => {
  mocks.create.mockReset().mockResolvedValue({})
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  vi.spyOn(console, 'debug').mockImplementation(() => undefined)
})

afterEach(() => vi.restoreAllMocks())

describe('structured application logging', () => {
  it('persists searchable info records and redacts secrets recursively', async () => {
    await persistLog('info', 'test:source', 'something happened', {
      metadata: {
        requestId: 'request-12345678',
        authorization: 'Bearer secret',
        nested: { password: 'do-not-store', messageCode: 'provider-42' },
      },
    })

    expect(mocks.create).toHaveBeenCalledOnce()
    const data = mocks.create.mock.calls[0][0].data
    expect(data).toMatchObject({ level: 'info', source: 'test:source', message: 'something happened' })
    expect(data.metadata).toMatchObject({
      requestId: 'request-12345678',
      authorization: '[REDACTED]',
      nested: { password: '[REDACTED]', messageCode: 'provider-42' },
    })
  })

  it('exposes only the explicit otpCode field when deliberately enabled', async () => {
    await persistLog('info', 'auth:otp:generated', 'generated', {
      metadata: { otpCode: '123456', code: '654321', apiKey: 'secret' },
      exposeOtpCode: true,
    })

    expect(mocks.create.mock.calls[0][0].data.metadata).toEqual({
      otpCode: '123456',
      code: '[REDACTED]',
      apiKey: '[REDACTED]',
    })
  })

  it('keeps debug output console-only unless persistence is requested', async () => {
    await persistLog('debug', 'test:debug', 'details')
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
