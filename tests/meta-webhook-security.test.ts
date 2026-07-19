import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyMetaWebhookSignature } from '@/lib/security/meta-webhook'

const mocks = vi.hoisted(() => ({
  instagram: vi.fn(async () => undefined),
  whatsapp: vi.fn(async () => undefined),
}))

vi.mock('@/lib/channels/handler', () => ({
  handleInstagramGlobalInbound: mocks.instagram,
}))
vi.mock('@/lib/whatsapp/webhook', () => ({
  handleWhatsappGlobalInbound: mocks.whatsapp,
}))
vi.mock('@/lib/channels/webhook-debug', () => ({ logWebhookPayload: vi.fn() }))
vi.mock('@/lib/errors/capture', () => ({ captureError: vi.fn() }))

import { POST as postInstagram } from '@/app/api/webhook/instagram/route'
import { POST as postWhatsapp } from '@/app/api/webhook/whatsapp/route'

const originalInstagramSecret = process.env.INSTAGRAM_APP_SECRET
const originalMetaSecret = process.env.META_APP_SECRET

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
  mocks.instagram.mockClear()
  mocks.whatsapp.mockClear()
  process.env.INSTAGRAM_APP_SECRET = 'instagram-app-secret'
  process.env.META_APP_SECRET = 'meta-app-secret'
})

afterEach(() => {
  if (originalInstagramSecret === undefined) delete process.env.INSTAGRAM_APP_SECRET
  else process.env.INSTAGRAM_APP_SECRET = originalInstagramSecret
  if (originalMetaSecret === undefined) delete process.env.META_APP_SECRET
  else process.env.META_APP_SECRET = originalMetaSecret
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
    expect(mocks.instagram).not.toHaveBeenCalled()
  })

  it('accepts only correctly signed Instagram events', async () => {
    const body = '{"entry":[{"id":"account-1"}]}'
    const response = await postInstagram(
      request('/api/webhook/instagram', body, signature(body, 'instagram-app-secret')),
    )
    expect(response.status).toBe(200)
    expect(mocks.instagram).toHaveBeenCalledWith(JSON.parse(body))
  })

  it('rejects unsigned WhatsApp events and accepts a valid Meta signature', async () => {
    const body = '{"entry":[{"changes":[]}]}'
    expect((await postWhatsapp(request('/api/webhook/whatsapp', body))).status).toBe(401)
    expect(mocks.whatsapp).not.toHaveBeenCalled()

    const response = await postWhatsapp(
      request('/api/webhook/whatsapp', body, signature(body, 'meta-app-secret')),
    )
    expect(response.status).toBe(200)
    expect(mocks.whatsapp).toHaveBeenCalledWith(JSON.parse(body))
  })
})

