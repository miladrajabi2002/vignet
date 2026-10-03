/**
 * Iran relay (deploy/iran-relay/relay.php): Iranian shop sites may refuse our
 * foreign-hosted server, and during national-internet cutoffs only Iran→Iran
 * traffic works. safeHttpGet/safeHttpPost retry connection failures through
 * a signed relay on Iranian hosting, or go there first in "always" mode.
 */
import { createHmac } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  httpsRequest: vi.fn(),
}))

vi.mock('node:dns/promises', () => ({ default: { lookup: mocks.lookup } }))
vi.mock('node:https', () => ({ default: { request: mocks.httpsRequest } }))

const SECRET = 'relay-test-secret'
const fetchMock = vi.fn()

function relayReply(body: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(
    JSON.stringify({
      ok: true,
      status,
      headers: { 'content-type': 'image/jpeg', ...headers },
      body: Buffer.from(body).toString('base64'),
    }),
    { status: 200 },
  )
}

/** https.request stub whose connection is reset (a foreign-IP block). */
function connectionReset() {
  mocks.httpsRequest.mockImplementation(() => {
    const req = new EventEmitter() as EventEmitter & Record<string, unknown>
    req.setTimeout = () => req
    req.destroy = () => undefined
    req.end = () => {
      queueMicrotask(() => req.emit('error', Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' })))
    }
    return req
  })
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
  mocks.lookup.mockResolvedValue([{ address: '185.143.233.1', family: 4 }])
  process.env.IRAN_RELAY_URL = 'https://relay.example.ir/relay.php'
  process.env.IRAN_RELAY_SECRET = SECRET
  delete process.env.IRAN_RELAY_MODE
  delete process.env.IRAN_RELAY_HOSTS
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.IRAN_RELAY_URL
  delete process.env.IRAN_RELAY_SECRET
  delete process.env.IRAN_RELAY_MODE
})

describe('safeHttpGet with the Iran relay', () => {
  it('retries a reset connection through the relay and keeps the host on it', async () => {
    connectionReset()
    fetchMock.mockImplementation(async () => relayReply('jpeg-bytes'))
    const { safeHttpGet } = await import('@/lib/security/safe-http')

    const res = await safeHttpGet('https://shop.example.com/a.jpg', { allowedContentTypes: ['image/'] })

    expect(res.status).toBe(200)
    expect(res.body.toString()).toBe('jpeg-bytes')
    expect(mocks.httpsRequest).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://relay.example.ir/relay.php')
    const ts = init.headers['X-Relay-Timestamp']
    expect(init.headers['X-Relay-Signature']).toBe(
      createHmac('sha256', SECRET).update(`${ts}.${init.body}`).digest('hex'),
    )
    expect(JSON.parse(init.body)).toMatchObject({ method: 'GET', url: 'https://shop.example.com/a.jpg' })

    // Sticky: the next request skips the direct attempt.
    await safeHttpGet('https://shop.example.com/b.jpg')
    expect(mocks.httpsRequest).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not use the relay when it is switched off', async () => {
    process.env.IRAN_RELAY_MODE = 'off'
    connectionReset()
    const { safeHttpGet } = await import('@/lib/security/safe-http')

    await expect(safeHttpGet('https://shop.example.com/a.jpg')).rejects.toThrow('ECONNRESET')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends .ir hosts straight to the relay in "always" mode and follows redirects hop by hop', async () => {
    process.env.IRAN_RELAY_MODE = 'always'
    fetchMock
      .mockImplementationOnce(async () => relayReply('', 301, { location: 'https://shop.ir/new.jpg' }))
      .mockImplementationOnce(async () => relayReply('moved-bytes'))
    const { safeHttpGet } = await import('@/lib/security/safe-http')

    const res = await safeHttpGet('http://shop.ir/old.jpg')

    expect(mocks.httpsRequest).not.toHaveBeenCalled()
    expect(res.body.toString()).toBe('moved-bytes')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).url).toBe('https://shop.ir/new.jpg')
  })

  it('never asks the relay for a private address', async () => {
    process.env.IRAN_RELAY_MODE = 'always'
    mocks.lookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }])
    const { safeHttpGet } = await import('@/lib/security/safe-http')

    await expect(safeHttpGet('https://intranet.ir/')).rejects.toThrow('UNSAFE_HTTP_TARGET')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports an unconfigured relay to the admin health card', async () => {
    delete process.env.IRAN_RELAY_URL
    const { iranRelayHealth } = await import('@/lib/security/iran-relay')
    await expect(iranRelayHealth()).resolves.toMatchObject({ state: 'unconfigured', mode: 'off' })
  })
})
