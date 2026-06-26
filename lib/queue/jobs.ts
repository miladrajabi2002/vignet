import type { Queue } from 'bullmq'
import { QUEUE_NAMES, createQueueConnection, isQueueDisabled } from '@/lib/queue/connection'
import type { IngestionJobData } from '@/lib/knowledge/ingest'
import type { ProductEmbedJobData } from '@/lib/products/catalog'

// Lazily-created Queue singletons (bullmq is imported dynamically to keep it
// out of the edge/runtime bundle until actually needed).
const queues = new Map<string, Queue>()

async function getQueue(name: string): Promise<Queue> {
  const existing = queues.get(name)
  if (existing) return existing
  const { Queue } = await import('bullmq')
  const q = new Queue(name, { connection: createQueueConnection() })
  queues.set(name, q)
  return q
}

/**
 * Enqueue a knowledge-ingestion job. Falls back to inline processing when the
 * queue is disabled or unavailable (so dev works without a running worker).
 */
export async function dispatchIngestion(data: IngestionJobData): Promise<void> {
  if (isQueueDisabled()) return runInlineIngestion(data)
  try {
    const q = await getQueue(QUEUE_NAMES.ingestion)
    await q.add('ingest', data, {
      removeOnComplete: true,
      removeOnFail: 50,
      attempts: 2,
    })
  } catch (e) {
    console.warn('[queue] ingestion enqueue failed, running inline:', e)
    return runInlineIngestion(data)
  }
}

/** Enqueue a product re-embedding job (per affected agent). */
export async function dispatchProductEmbed(
  data: ProductEmbedJobData,
): Promise<void> {
  if (isQueueDisabled()) return runInlineProductEmbed(data)
  try {
    const q = await getQueue(QUEUE_NAMES.productEmbed)
    await q.add('embed', data, {
      removeOnComplete: true,
      removeOnFail: 50,
      attempts: 2,
    })
  } catch (e) {
    console.warn('[queue] product-embed enqueue failed, running inline:', e)
    return runInlineProductEmbed(data)
  }
}

function runInlineIngestion(data: IngestionJobData): void {
  void import('@/lib/knowledge/ingest').then(({ processIngestion }) =>
    processIngestion(data).catch((e) =>
      console.error('[queue] inline ingestion failed:', e),
    ),
  )
}

function runInlineProductEmbed(data: ProductEmbedJobData): void {
  void import('@/lib/products/catalog').then(({ processProductEmbed }) =>
    processProductEmbed(data).catch((e) =>
      console.error('[queue] inline product-embed failed:', e),
    ),
  )
}
