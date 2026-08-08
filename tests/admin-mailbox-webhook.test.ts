import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  ingest: vi.fn(),
}))

vi.mock('@/lib/email/resend', () => ({
  getResendClient: () => ({ webhooks: { verify: mocks.verify } }),
}))

vi.mock('@/lib/email/admin-mailbox', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/email/admin-mailbox')>()
  return { ...original, ingestAdminMailboxEmail: mocks.ingest }
})

import { POST } from '@/app/api/webhook/resend/route'

function request(headers: Record<string, string> = {}) {
  return new Request('https://vigent.ir/api/webhook/resend', {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'email.received' }),
  })
}

const signedHeaders = {
  'svix-id': 'event-1',
  'svix-timestamp': '1786200000',
  'svix-signature': 'v1,signature',
}

describe('Resend admin mailbox webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('RESEND_WEBHOOK_SECRET', 'webhook-secret')
    mocks.ingest.mockResolvedValue({ created: true, forwarded: true })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('rejects unsigned and invalid events before reading mail', async () => {
    expect((await POST(request())).status).toBe(400)

    mocks.verify.mockImplementation(() => { throw new Error('invalid signature') })
    expect((await POST(request(signedHeaders))).status).toBe(401)
    expect(mocks.ingest).not.toHaveBeenCalled()
  })

  it('accepts only verified mail addressed to the admin inbox', async () => {
    mocks.verify.mockReturnValue({
      type: 'email.received',
      data: {
        email_id: 'email-1',
        created_at: '2026-08-08T10:00:00.000Z',
        from: 'customer@example.com',
        to: ['info@vigent.ir'],
        subject: 'Question',
      },
    })

    const response = await POST(request(signedHeaders))
    expect(response.status).toBe(200)
    expect(mocks.verify).toHaveBeenCalledWith(expect.objectContaining({
      webhookSecret: 'webhook-secret',
      headers: { id: 'event-1', timestamp: '1786200000', signature: 'v1,signature' },
    }))
    expect(mocks.ingest).toHaveBeenCalledWith(expect.objectContaining({ email_id: 'email-1' }), 'event-1')
  })

  it('asks Resend to retry transient processing failures', async () => {
    mocks.verify.mockReturnValue({
      type: 'email.received',
      data: { email_id: 'email-1', created_at: '', from: 'x@example.com', to: ['info@vigent.ir'] },
    })
    mocks.ingest.mockRejectedValue(new Error('database down'))

    expect((await POST(request(signedHeaders))).status).toBe(503)
  })
})
