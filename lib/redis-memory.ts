import { getRedis } from '@/lib/redis'

export interface RedisMemoryUsage {
  usedBytes: number
  /** 0 means Redis has no maxmemory limit. */
  maxBytes: number
  /** used / max, or 0 when there is no limit. */
  ratio: number
}

/**
 * Redis runs with `noeviction` because BullMQ jobs and idempotency markers
 * must never be evicted. The flip side: once memory is full EVERY write is
 * rejected, including the webhook enqueue, so customer messages are refused.
 * Best-effort caches share this instance and must stop writing well before
 * that point; above this ratio they skip the write and recompute instead.
 */
export const REDIS_CACHE_PRESSURE_RATIO = 0.7
/** Above this the scheduler alerts ops: the queue itself is close to refusing writes. */
export const REDIS_ALERT_RATIO = 0.8

const PRESSURE_CHECK_INTERVAL_MS = 15_000

export function parseRedisMemoryInfo(info: string): RedisMemoryUsage | null {
  const read = (field: string): number | null => {
    const match = info.match(new RegExp(`^${field}:(\\d+)`, 'm'))
    return match ? Number(match[1]) : null
  }
  const usedBytes = read('used_memory')
  const maxBytes = read('maxmemory')
  if (usedBytes === null || maxBytes === null) return null
  return { usedBytes, maxBytes, ratio: maxBytes > 0 ? usedBytes / maxBytes : 0 }
}

export async function readRedisMemoryUsage(): Promise<RedisMemoryUsage | null> {
  return parseRedisMemoryInfo(await getRedis().info('memory'))
}

let pressureCheckedAt = 0
let underPressure = false

/**
 * True when Redis is close enough to maxmemory that optional cache writes
 * should be skipped. Sampled at most every 15s per process. Fails open (no
 * pressure) when Redis cannot be read — the cache write then fails on its own.
 */
export async function redisUnderMemoryPressure(): Promise<boolean> {
  const now = Date.now()
  if (now - pressureCheckedAt < PRESSURE_CHECK_INTERVAL_MS) return underPressure
  pressureCheckedAt = now
  try {
    const usage = await readRedisMemoryUsage()
    underPressure = usage !== null && usage.ratio >= REDIS_CACHE_PRESSURE_RATIO
  } catch {
    underPressure = false
  }
  return underPressure
}

export function resetRedisMemoryPressureForTests(): void {
  pressureCheckedAt = 0
  underPressure = false
}
