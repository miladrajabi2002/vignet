import IORedis from 'ioredis'
import type { ConnectionOptions } from 'bullmq'

export const QUEUE_NAMES = {
  ingestion: 'knowledge-ingestion',
  productEmbed: 'product-embed',
  conversationSummary: 'conversation-summary',
  notifications: 'notifications',
  inboundMessage: 'inbound-message',
  campaigns: 'campaigns',
  wooWebhook: 'woo-webhook',
} as const

/**
 * BullMQ requires a dedicated connection with maxRetriesPerRequest: null.
 * Do not share this with the app's general-purpose Redis client.
 *
 * `failFast` is for PRODUCERS (web-process enqueues): when Redis is down,
 * add() must reject immediately so webhook routes can answer 503 (the
 * platform redelivers later) instead of hanging on ioredis's offline queue
 * until the platform times the request out. Workers keep the offline queue so
 * they ride out short Redis blips.
 *
 * BullMQ bundles its own ioredis copy, so the instance type differs from our
 * top-level ioredis; the cast bridges the (runtime-compatible) duplicate types.
 */
export function createQueueConnection(opts?: { failFast?: boolean }): ConnectionOptions {
  const url = process.env.REDIS_URL || 'redis://localhost:6379'
  return new IORedis(url, {
    maxRetriesPerRequest: null,
    ...(opts?.failFast ? { enableOfflineQueue: false, connectTimeout: 5_000 } : {}),
  }) as unknown as ConnectionOptions
}

/** Queues are disabled when explicitly turned off (dev runs ingestion inline). */
export function isQueueDisabled(): boolean {
  return process.env.DISABLE_QUEUE === '1'
}
