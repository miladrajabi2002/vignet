import 'dotenv/config'
import { Worker } from 'bullmq'
import { QUEUE_NAMES, createQueueConnection } from '@/lib/queue/connection'
import { processIngestion } from '@/lib/knowledge/ingest'
import { processProductEmbed } from '@/lib/products/catalog'

/**
 * Standalone BullMQ worker. Run with: npm run worker
 * Processes knowledge ingestion and product re-embedding jobs.
 */

const connection = createQueueConnection()

const ingestionWorker = new Worker(
  QUEUE_NAMES.ingestion,
  async (job) => {
    console.log(`[worker] ingestion job ${job.id}`)
    await processIngestion(job.data)
  },
  { connection, concurrency: 2 },
)

const productWorker = new Worker(
  QUEUE_NAMES.productEmbed,
  async (job) => {
    console.log(`[worker] product-embed job ${job.id}`)
    await processProductEmbed(job.data)
  },
  { connection, concurrency: 2 },
)

for (const [name, w] of [
  ['ingestion', ingestionWorker],
  ['product-embed', productWorker],
] as const) {
  w.on('failed', (job, err) =>
    console.error(`[worker:${name}] job ${job?.id} failed:`, err.message),
  )
}

console.log('[worker] started — listening for jobs')

async function shutdown() {
  console.log('[worker] shutting down…')
  await Promise.all([ingestionWorker.close(), productWorker.close()])
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
