import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendSms } from '@/lib/sms/ippanel'

const ORIGINAL_ENV = { ...process.env }

describe('IPPanel free-form SMS contract', () => {
  beforeEach(() => {
    process.env.IPPANEL_PROXY_URL = 'https://sms.example.ir/vigent'
    process.env.IPPANEL_PROXY_SECRET = 'proxy-secret'
    process.env.IPPANEL_FROM_NUMBER = '+983000505'
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.unstubAllGlobals()
  })

  it('sends recipients in params for IPPanel webservice mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ meta: { status: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(sendSms('09128352271', 'اعلان مالی ویجنت')).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(request.body)) as Record<string, unknown>
    expect(body).toMatchObject({
      sending_type: 'webservice',
      from_number: '+983000505',
      message: 'اعلان مالی ویجنت',
      params: { recipients: ['+989128352271'] },
    })
    expect(body).not.toHaveProperty('recipients')
  })
})
