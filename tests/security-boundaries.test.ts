import { afterEach, describe, expect, it } from 'vitest'
import { assertSafeHttpUrl, UnsafeHttpTargetError } from '@/lib/security/safe-http'
import { createPublicConversationToken, verifyPublicConversationToken } from '@/lib/security/public-conversation'
import { getClientIp } from '@/lib/security/request-ip'

const originalAuthSecret = process.env.AUTH_SECRET
const originalTrustProxy = process.env.TRUST_PROXY_HEADERS
const originalAllowPrivate = process.env.ALLOW_PRIVATE_HTTP_TARGETS

afterEach(() => {
  if (originalAuthSecret === undefined) delete process.env.AUTH_SECRET
  else process.env.AUTH_SECRET = originalAuthSecret
  if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY_HEADERS
  else process.env.TRUST_PROXY_HEADERS = originalTrustProxy
  if (originalAllowPrivate === undefined) delete process.env.ALLOW_PRIVATE_HTTP_TARGETS
  else process.env.ALLOW_PRIVATE_HTTP_TARGETS = originalAllowPrivate
})

describe('public security boundaries', () => {
  it('rejects loopback and private HTTP targets', async () => {
    delete process.env.ALLOW_PRIVATE_HTTP_TARGETS
    await expect(assertSafeHttpUrl('http://127.0.0.1:3000/admin')).rejects.toBeInstanceOf(UnsafeHttpTargetError)
    await expect(assertSafeHttpUrl('http://10.0.0.1/')).rejects.toBeInstanceOf(UnsafeHttpTargetError)
    await expect(assertSafeHttpUrl('http://[::ffff:7f00:1]/')).rejects.toBeInstanceOf(UnsafeHttpTargetError)
  })

  it('binds public conversation tokens to scope and audience', () => {
    process.env.AUTH_SECRET = 'test-secret-at-least-32-characters-long'
    const token = createPublicConversationToken('widget', 'conversation-1', 'agent-1')
    expect(verifyPublicConversationToken('widget', 'conversation-1', 'agent-1', token)).toBe(true)
    expect(verifyPublicConversationToken('chat-link', 'conversation-1', 'agent-1', token)).toBe(false)
    expect(verifyPublicConversationToken('widget', 'conversation-1', 'agent-2', token)).toBe(false)
  })

  it('ignores spoofed proxy headers unless proxy trust is explicitly enabled', () => {
    const headers = new Headers({
      'x-vigent-client-ip': '203.0.113.10',
      'x-real-ip': '203.0.113.11',
      'user-agent': 'test-agent',
    })
    delete process.env.TRUST_PROXY_HEADERS
    expect(getClientIp(headers)).toMatch(/^fp:/)
    process.env.TRUST_PROXY_HEADERS = '1'
    expect(getClientIp(headers)).toBe('203.0.113.10')
  })
})
