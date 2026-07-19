import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ eval: vi.fn() }))

vi.mock('@/lib/redis', () => ({
  getRedis: () => ({ eval: mocks.eval }),
}))

import { rateLimitCost } from '@/lib/ratelimit'

beforeEach(() => {
  mocks.eval.mockReset()
})

describe('weighted rate limits', () => {
  it('atomically accounts for byte cost and rejects a spent budget', async () => {
    mocks.eval.mockResolvedValueOnce(90).mockResolvedValueOnce(110)

    await expect(rateLimitCost('uploads:workspace', 100, 60, 90, { failClosed: true })).resolves.toBe(true)
    await expect(rateLimitCost('uploads:workspace', 100, 60, 20, { failClosed: true })).resolves.toBe(false)
    expect(mocks.eval.mock.calls[0][0]).toContain("redis.call('INCRBY', KEYS[1], ARGV[1])")
    expect(mocks.eval.mock.calls[0].slice(1)).toEqual([
      1,
      expect.stringMatching(/^rlc:uploads:workspace:\d+$/),
      90,
      60,
    ])
  })

  it('fails closed when Redis is unavailable', async () => {
    mocks.eval.mockRejectedValue(new Error('redis down'))
    await expect(rateLimitCost('uploads:workspace', 100, 60, 1, { failClosed: true })).resolves.toBe(false)
  })
})
