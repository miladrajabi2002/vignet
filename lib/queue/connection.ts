import IORedis from 'ioredis'
import type { ConnectionOptions } from 'bullmq'

export const QUEUE_NAMES = {
  ingestion: 'knowledge-ingestion',
  productEmbed: 'product-embed',
  conversationSummary: 'conversation-summary',
  notifications: 'notifications',
} as const

/**
 * BullMQ requires a dedicated connection with maxRetriesPerRequest: null.
 * Do not share this with the app's general-purpose Redis client.
 *
 * BullMQ bundles its own ioredis copy, so the instance type differs from our
 * top-level ioredis; the cast bridges the (runtime-compatible) duplicate types.
 */
export function createQueueConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL || 'redis://localhost:6379'
  return new IORedis(url, {
    maxRetriesPerRequest: null,
  }) as unknown as ConnectionOptions
}

/** Queues are disabled when explicitly turned off (dev runs ingestion inline). */
export function isQueueDisabled(): boolean {
  return process.env.DISABLE_QUEUE === '1'
}
