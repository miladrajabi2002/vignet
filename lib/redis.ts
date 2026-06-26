import Redis from 'ioredis'

/**
 * Shared ioredis connection. Used for OTP storage and rate limiting.
 * BullMQ creates its own connections (it requires maxRetriesPerRequest: null),
 * so do not reuse this instance for queues.
 */

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined
}

let warnedNoUrl = false

export function getRedis(): Redis {
  if (globalForRedis.redis) return globalForRedis.redis

  const url = process.env.REDIS_URL
  if (!url && !warnedNoUrl) {
    warnedNoUrl = true
    console.warn('[redis] REDIS_URL not set — falling back to redis://localhost:6379')
  }

  const client = new Redis(url || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  })

  client.on('error', (err) => {
    console.error('[redis] connection error:', err.message)
  })

  if (process.env.NODE_ENV !== 'production') globalForRedis.redis = client
  return client
}

export default getRedis
