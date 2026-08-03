import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendSubscriptionExpiringSms } from '@/lib/sms/ippanel'

const ORIGINAL_ENV = { ...process.env }

describe('IPPanel dedicated pattern contract', () => {
  beforeEach(() => {
    process.env.IPPANEL_PROXY_URL = 'https://sms.example.ir/vigent'
    process.env.IPPANEL_PROXY_SECRET = 'proxy-secret'
    process.env.IPPANEL_FROM_NUMBER = '+983000505'
    process.env.IPPANEL_SUBSCRIPTION_EXPIRING_PATTERN_CODE = 'expiry-pattern'
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
})
