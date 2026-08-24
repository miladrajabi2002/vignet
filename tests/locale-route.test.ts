import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  setCookie: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ set: mocks.setCookie })),
}))

import { POST } from '@/app/api/locale/route'

function request(body: string, contentType = 'application/json') {
  return new Request('https://vigent.ir/api/locale', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  })
}

beforeEach(() => {
  mocks.setCookie.mockClear()
})

describe('locale preference route', () => {
  it.each(['fa', 'en'])('stores the supported %s locale without a Server Action', async (locale) => {
    const response = await POST(request(JSON.stringify({ locale })))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ locale })
    expect(mocks.setCookie).toHaveBeenCalledWith(
      'locale',
      locale,
      expect.objectContaining({ path: '/', httpOnly: true, sameSite: 'lax' }),
    )
  })

  it('rejects unsupported locales without changing the cookie', async () => {
    const response = await POST(request(JSON.stringify({ locale: 'de' })))

    expect(response.status).toBe(400)
    expect(mocks.setCookie).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON and non-JSON requests', async () => {
    expect((await POST(request('{'))).status).toBe(400)
    expect((await POST(request('{}', 'text/plain'))).status).toBe(415)
    expect(mocks.setCookie).not.toHaveBeenCalled()
  })
})
