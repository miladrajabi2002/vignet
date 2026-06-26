import { getRedis } from '@/lib/redis'

/**
 * Fixed-window rate limiter backed by Redis.
 * Returns true if the action is allowed, false if the limit is exceeded.
 * Fails open (allows) if Redis is unavailable.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const redis = getRedis()
    const window = Math.floor(Date.now() / 1000 / windowSeconds)
    const redisKey = `rl:${key}:${window}`
    const count = await redis.incr(redisKey)
    if (count === 1) await redis.expire(redisKey, windowSeconds)
    return count <= limit
  } catch (e) {
    console.error('[ratelimit] error (failing open):', e)
    return true
  }
}
