import { getRedis } from '@/lib/redis'

/**
 * Fixed-window rate limiter backed by Redis.
 * Returns true if the action is allowed, false if the limit is exceeded.
 *
 * Failure mode when Redis is unavailable:
 *  - default (fail open): allow — right for authenticated, low-abuse routes.
 *  - `failClosed: true`: deny — required on public/unauthenticated routes
 *    (web widget, webhooks) where failing open lets attackers drain the
 *    tenant's OpenRouter credit while Redis is down.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  opts?: { failClosed?: boolean },
): Promise<boolean> {
  try {
    const redis = getRedis()
    const window = Math.floor(Date.now() / 1000 / windowSeconds)
    const redisKey = `rl:${key}:${window}`
    const count = await redis.incr(redisKey)
    if (count === 1) await redis.expire(redisKey, windowSeconds)
    return count <= limit
  } catch (e) {
    console.error(
      `[ratelimit] error (failing ${opts?.failClosed ? 'closed' : 'open'}):`,
      e,
    )
    return !opts?.failClosed
  }
}
