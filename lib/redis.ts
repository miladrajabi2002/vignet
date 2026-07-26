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
let lastConnectionErrorAt = 0
const REDIS_ERROR_LOG_INTERVAL_MS = 30_000

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
    const now = Date.now()
    if (now - lastConnectionErrorAt >= REDIS_ERROR_LOG_INTERVAL_MS) {
      lastConnectionErrorAt = now
      console.error('[redis] connection error:', err.message)
    }
  })

  client.on('ready', () => {
    lastConnectionErrorAt = 0
  })

  // Cache unconditionally. One shared multiplexed connection per process is
  // exactly what ioredis is designed for. Skipping the cache in production
  // meant every rate-limit check, embedding-cache hit, entitlement check and
  // health ping opened a brand-new TCP connection that was never quit() —
  // hundreds of sockets per minute on a busy account until Redis hit
  // maxclients and every dependent path (fail-closed rate limits, OTP) broke.
  globalForRedis.redis = client
  return client
}

export default getRedis
