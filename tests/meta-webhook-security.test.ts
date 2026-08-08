import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyMetaWebhookSignature } from '@/lib/security/meta-webhook'

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(async (_data: { global: string; body: unknown }) => undefined),
}))

vi.mock('@/lib/queue/jobs', () => ({
  dispatchGlobalInbound: mocks.dispatch,
}))
vi.mock('@/lib/channels/webhook-debug', () => ({ logWebhookPayload: vi.fn() }))
vi.mock('@/lib/errors/capture', () => ({ captureError: vi.fn() }))

import { POST as postInstagram } from '@/app/api/webhook/instagram/route'

const originalInstagramSecret = process.env.INSTAGRAM_APP_SECRET

function signature(body: string, secret: string): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`
}

function request(path: string, body: string, value?: string): Request {
  return new Request(`https://vigent.ir${path}`, {
    method: 'POST',
    headers: value ? { 'x-hub-signature-256': value } : undefined,
    body,
  })
}

beforeEach(() => {
  mocks.dispatch.mockClear().mockResolvedValue(undefined)
  process.env.INSTAGRAM_APP_SECRET = 'instagram-app-secret'
})

afterEach(() => {
  if (originalInstagramSecret === undefined) delete process.env.INSTAGRAM_APP_SECRET
  else process.env.INSTAGRAM_APP_SECRET = originalInstagramSecret
})

describe('Meta webhook signatures', () => {
  it('uses a timing-safe HMAC over the exact raw body', () => {
    const raw = Buffer.from('{"entry":[{"id":"1"}]}')
    const valid = signature(raw.toString('utf8'), 'secret')
    expect(verifyMetaWebhookSignature(raw, valid, 'secret')).toBe(true)
    expect(verifyMetaWebhookSignature(Buffer.from('{"entry":[]}'), valid, 'secret')).toBe(false)
    expect(verifyMetaWebhookSignature(raw, 'sha256=not-hex', 'secret')).toBe(false)
    expect(verifyMetaWebhookSignature(raw, valid, undefined)).toBe(false)
  })

  it('rejects unsigned and forged Instagram events before dispatch', async () => {
    const body = '{"entry":[{"id":"account-1"}]}'
    expect((await postInstagram(request('/api/webhook/instagram', body))).status).toBe(401)
    expect((await postInstagram(request('/api/webhook/instagram', body, signature(body, 'wrong')))).status).toBe(401)
    expect(mocks.dispatch).not.toHaveBeenCalled()
  })

  it('enqueues correctly signed Instagram events for durable processing', async () => {
    const body = '{"entry":[{"id":"account-1"}]}'
    const response = await postInstagram(
      request('/api/webhook/instagram', body, signature(body, 'instagram-app-secret')),
    )
    expect(response.status).toBe(200)
    expect(mocks.dispatch).toHaveBeenCalledWith({
      global: 'INSTAGRAM',
      body: JSON.parse(body),
    })
  })

  it('answers 503 when the queue is unavailable so Meta redelivers', async () => {
    mocks.dispatch.mockRejectedValueOnce(new Error('redis down'))
    const body = '{"entry":[{"id":"account-1"}]}'
    const response = await postInstagram(
      request('/api/webhook/instagram', body, signature(body, 'instagram-app-secret')),
    )
    expect(response.status).toBe(503)
  })
})
