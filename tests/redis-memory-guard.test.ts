import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  info: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  fetch: vi.fn(),
}))

vi.mock('@/lib/redis', () => ({
  getRedis: () => ({ info: mocks.info, get: mocks.get, set: mocks.set }),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: { findUnique: vi.fn().mockResolvedValue({ defaultEmbedModel: null }) },
    usageLog: { create: vi.fn().mockResolvedValue({}) },
  },
}))
vi.mock('@/lib/ai/openrouter', () => ({
  OPENROUTER_BASE: 'https://openrouter.test',
  getPlatformOpenRouterKey: () => 'key',
}))

import {
  parseRedisMemoryInfo,
  redisUnderMemoryPressure,
  resetRedisMemoryPressureForTests,
} from '@/lib/redis-memory'
import {
  decodeCachedEmbedding,
  embedText,
  encodeCachedEmbedding,
} from '@/lib/ai/embeddings'

const MB = 1024 * 1024
const memoryInfo = (usedMb: number, maxMb: number) =>
  `# Memory\r\nused_memory:${usedMb * MB}\r\nused_memory_human:${usedMb}.00M\r\nmaxmemory:${maxMb * MB}\r\nmaxmemory_human:${maxMb}.00M\r\n`

const vector = Array.from({ length: 1536 }, (_, i) => Math.sin(i) / 7)

beforeEach(() => {
  vi.clearAllMocks()
  resetRedisMemoryPressureForTests()
  mocks.get.mockResolvedValue(null)
  mocks.set.mockResolvedValue('OK')
  mocks.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ data: [{ index: 0, embedding: vector }], usage: {} }),
  })
  vi.stubGlobal('fetch', mocks.fetch)
})

describe('Redis memory usage', () => {
  it('reads used and max memory from INFO', () => {
    expect(parseRedisMemoryInfo(memoryInfo(128, 512))).toEqual({
      usedBytes: 128 * MB,
      maxBytes: 512 * MB,
      ratio: 0.25,
    })
  })

  it('treats an unlimited Redis as never under pressure', () => {
    expect(parseRedisMemoryInfo(memoryInfo(900, 0))?.ratio).toBe(0)
  })

  it('reports pressure only near the limit and fails open on errors', async () => {
    mocks.info.mockResolvedValue(memoryInfo(100, 512))
    expect(await redisUnderMemoryPressure()).toBe(false)

    resetRedisMemoryPressureForTests()
    mocks.info.mockResolvedValue(memoryInfo(400, 512))
    expect(await redisUnderMemoryPressure()).toBe(true)

    resetRedisMemoryPressureForTests()
    mocks.info.mockRejectedValue(new Error('redis down'))
    expect(await redisUnderMemoryPressure()).toBe(false)
  })
})

describe('embedding cache encoding', () => {
  it('stores a 1536-dim vector in about a quarter of the JSON size', () => {
    const encoded = encodeCachedEmbedding(vector)
    expect(encoded.length).toBeLessThan(8_300)
    expect(encoded.length * 3).toBeLessThan(JSON.stringify(vector).length)
  })

  it('round-trips at float32 precision', () => {
    const decoded = decodeCachedEmbedding(encodeCachedEmbedding(vector))
    expect(decoded).toHaveLength(vector.length)
    decoded!.forEach((value, i) => expect(value).toBeCloseTo(vector[i], 6))
  })

  it('still reads entries cached as JSON before the compact encoding', () => {
    expect(decodeCachedEmbedding(JSON.stringify([0.5, -0.25]))).toEqual([0.5, -0.25])
  })

  it('rejects a truncated entry instead of returning a short vector', () => {
    expect(decodeCachedEmbedding('f32:' + Buffer.from([1, 2, 3]).toString('base64'))).toBeNull()
  })
})

describe('embedding cache writes', () => {
  it('caches the compact encoding when Redis has headroom', async () => {
    mocks.info.mockResolvedValue(memoryInfo(100, 512))
    await embedText('آدرس', 'ws1')
    await vi.waitFor(() => expect(mocks.set).toHaveBeenCalledTimes(1))
    expect(mocks.set.mock.calls[0][1]).toMatch(/^f32:/)
  })

  it('skips the cache write while Redis is under memory pressure', async () => {
    mocks.info.mockResolvedValue(memoryInfo(400, 512))
    expect(await embedText('آدرس', 'ws1')).toEqual(vector)
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(mocks.set).not.toHaveBeenCalled()
  })

  it('does not surface a rejected cache write', async () => {
    mocks.info.mockResolvedValue(memoryInfo(100, 512))
    mocks.set.mockRejectedValue(new Error("OOM command not allowed when used memory > 'maxmemory'"))
    expect(await embedText('آدرس', 'ws1')).toEqual(vector)
    await vi.waitFor(() => expect(mocks.set).toHaveBeenCalledTimes(1))
  })
})
