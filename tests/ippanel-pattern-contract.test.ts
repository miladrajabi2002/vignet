import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const logMocks = vi.hoisted(() => ({
  persistLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/errors/capture', () => ({
  persistLog: logMocks.persistLog,
  captureError: vi.fn(),
  captureWarning: vi.fn(),
}))

import {
  sendActivationReminderSms,
  sendSubscriptionExpiringSms,
} from '@/lib/sms/ippanel'

const ORIGINAL_ENV = { ...process.env }

describe('IPPanel dedicated pattern contract', () => {
  beforeEach(() => {
    logMocks.persistLog.mockClear()
    process.env.IPPANEL_PROXY_URL = 'https://sms.example.ir/vigent'
    process.env.IPPANEL_PROXY_SECRET = 'proxy-secret'
    process.env.IPPANEL_FROM_NUMBER = '+983000505'
    process.env.IPPANEL_SUBSCRIPTION_EXPIRING_PATTERN_CODE = 'expiry-pattern'
    process.env.IPPANEL_ACTIVATION_REMINDER_PATTERN_CODE = 'stalled-pattern'
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.unstubAllGlobals()
  })

  it('sends every variable required by the subscription-expiry pattern', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ meta: { status: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(sendSubscriptionExpiringSms('09128352271', {
      plan: 'PRO',
      daysRemaining: 3,
      currentPeriodEnd: new Date('2026-08-05T00:00:00.000Z'),
    })).resolves.toBe(true)

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(request.body)) as Record<string, unknown>
    expect(body).toMatchObject({
      sending_type: 'pattern',
      code: 'expiry-pattern',
      recipients: ['+989128352271'],
      params: {
        plan: 'حرفه‌ای',
        days: '3',
      },
    })
    expect(body.params).toEqual(expect.objectContaining({ expiry: expect.any(String) }))
  })

  it('sends the stalled onboarding stage as the pattern step variable', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ meta: { status: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(sendActivationReminderSms('09128352271', {
      nextStep: 'اتصال اولین کانال',
    })).resolves.toBe(true)

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(request.body))).toMatchObject({
      sending_type: 'pattern',
      code: 'stalled-pattern',
      params: { step: 'اتصال اولین کانال' },
    })
    expect(logMocks.persistLog).toHaveBeenCalledWith(
      'info',
      'sms:activation-reminder:attempt',
      'Sending pattern SMS to provider',
      expect.objectContaining({ metadata: expect.objectContaining({ phone: '+989128352271' }) }),
    )
    expect(logMocks.persistLog).toHaveBeenCalledWith(
      'info',
      'sms:activation-reminder:accepted',
      'Pattern SMS accepted by provider',
      expect.objectContaining({ metadata: expect.objectContaining({ accepted: true }) }),
    )
  })

  it('persists the exact missing configuration when a pattern SMS is skipped', async () => {
    delete process.env.IPPANEL_PROXY_URL
    delete process.env.IPPANEL_API_KEY
    delete process.env.IPPANEL_FROM_NUMBER

    await expect(sendActivationReminderSms('09128352271', {
      nextStep: 'اتصال اولین کانال',
    })).resolves.toBe(false)

    expect(logMocks.persistLog).toHaveBeenCalledWith(
      'warn',
      'sms:activation-reminder:configuration',
      'Pattern SMS skipped because provider configuration is incomplete',
      expect.objectContaining({
        metadata: expect.objectContaining({
          phone: '+989128352271',
          missing: ['IPPANEL_PROXY_URL_OR_API_KEY', 'IPPANEL_FROM_NUMBER'],
        }),
      }),
    )
  })
})
