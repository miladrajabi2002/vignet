import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const redis = vi.hoisted(() => ({
  set: vi.fn(),
  eval: vi.fn(),
}))

vi.mock('@/lib/redis', () => ({ getRedis: () => redis }))

import {
  consumeOAuthState,
  createOAuthState,
} from '@/lib/security/oauth-state'
import {
  signState as signInstagramState,
  verifyState as verifyInstagramState,
} from '@/lib/instagram/oauth'

const binding = {
  userId: 'user-1',
  workspaceId: 'workspace-1',
  agentId: 'agent-1',
}
const nonce = '12345678-1234-1234-1234-123456789abc'

describe('OAuth state security', () => {
  beforeEach(() => {
    vi.stubEnv('INSTAGRAM_APP_SECRET', 'instagram-secret-for-tests')
    vi.stubEnv('META_APP_SECRET', 'meta-secret-for-tests')
    vi.stubEnv('ENCRYPTION_KEY', '11'.repeat(32))
    redis.set.mockReset()
    redis.eval.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('stores a server-side state with a short TTL and NX semantics', async () => {
    redis.set.mockResolvedValue('OK')

    await createOAuthState('instagram', nonce, binding)

    expect(redis.set).toHaveBeenCalledWith(
      `oauth-state:instagram:${nonce}`,
      JSON.stringify(binding),
      'EX',
      600,
      'NX',
    )
  })

  it('consumes a matching state atomically and rejects replay/mismatch', async () => {
    redis.eval.mockResolvedValueOnce(1).mockResolvedValueOnce(0)

    await expect(
      consumeOAuthState('instagram', nonce, binding),
    ).resolves.toBe(true)
    await expect(
      consumeOAuthState('instagram', nonce, binding),
    ).resolves.toBe(false)

    expect(String(redis.eval.mock.calls[0]?.[0])).toContain("redis.call('DEL'")
  })

  it('validates signed state shape and never throws on wrong signature length', () => {
    const instagramState = signInstagramState({ ...binding, nonce })
    expect(verifyInstagramState(instagramState)).toMatchObject(binding)
    expect(() => verifyInstagramState(`${instagramState.split('.')[0]}.x`)).not.toThrow()
    expect(verifyInstagramState(`${instagramState.split('.')[0]}.x`)).toBeNull()
  })
})
