/**
 * The Instagram thumbnail relay must stay a narrow, signed-in image pipe:
 * no anonymous callers, no hop outside the Meta allow-list, no SVG.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn() }))

vi.mock('@/auth', () => ({ auth: mocks.auth }))

import { GET } from '@/app/api/instagram/media-image/route'

const CDN = 'https://scontent.cdninstagram.com/v/t51/a.jpg?sig=1'

function request(target: string) {
  return new Request(`https://vigent.ir/api/instagram/media-image?u=${encodeURIComponent(target)}`)
}

function upstream(init: { status?: number; type?: string; location?: string; body?: string }) {
  const headers = new Headers()
  if (init.type) headers.set('content-type', init.type)
  if (init.location) headers.set('location', init.location)
  return new Response(init.status && init.status >= 300 && init.status < 400 ? null : (init.body ?? 'bytes'), {
    status: init.status ?? 200,
    headers,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('instagram media-image relay', () => {
  it('rejects anonymous callers before touching the network', async () => {
    mocks.auth.mockResolvedValue(null)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const res = await GET(request(CDN))

    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses hosts outside the Meta allow-list, credentials and odd ports', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    for (const target of [
      'https://example.com/a.jpg',
      'http://scontent.cdninstagram.com/a.jpg',
      'https://user:pw@scontent.cdninstagram.com/a.jpg',
      'https://scontent.cdninstagram.com:8443/a.jpg',
      'https://cdninstagram.com.evil.test/a.jpg',
    ]) {
      expect((await GET(request(target))).status).toBe(400)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('streams a raster image with private caching and a locked-down CSP', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream({ type: 'image/jpeg; charset=binary' })))

    const res = await GET(request(CDN))

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    expect(res.headers.get('cache-control')).toContain('private')
    expect(res.headers.get('content-security-policy')).toContain('sandbox')
    expect(await res.text()).toBe('bytes')
  })

  it('never relays SVG or HTML — answers with the built-in placeholder', async () => {
    for (const type of ['image/svg+xml', 'text/html']) {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(upstream({ type, body: '<svg onload="alert(1)"/>' })),
      )
      const res = await GET(request(CDN))
      expect(await res.text()).not.toContain('alert(1)')
    }
  })

  it('follows a redirect that stays on the allow-list', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(upstream({ status: 302, location: 'https://scontent-fra.fbcdn.net/b.webp' }))
      .mockResolvedValueOnce(upstream({ type: 'image/webp' }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await GET(request(CDN))

    expect(res.headers.get('content-type')).toBe('image/webp')
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://scontent-fra.fbcdn.net/b.webp')
  })

  it('stops at a redirect that leaves the allow-list', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(upstream({ status: 302, location: 'http://169.254.169.254/latest/meta-data' }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await GET(request(CDN))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(res.headers.get('content-type')).toContain('image/svg+xml') // placeholder
  })
})
