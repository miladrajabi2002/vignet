import 'dotenv/config'
import { Worker } from 'bullmq'
import { QUEUE_NAMES, createQueueConnection } from '@/lib/queue/connection'
import { processIngestion } from '@/lib/knowledge/ingest'
import { processProductEmbed } from '@/lib/products/catalog'
import { processSummary } from '@/lib/conversations/summary'
import { processNotification } from '@/lib/notifications/notify'
import { startScheduler } from '@/worker/scheduler'

/**
 * Standalone BullMQ worker. Run with: npm run worker
 * Processes knowledge ingestion, product re-embedding, conversation summaries,
 * and notification jobs. Also runs the node-cron scheduler for periodic tasks.
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

const summaryWorker = new Worker(
  QUEUE_NAMES.conversationSummary,
  async (job) => {
    console.log(`[worker] summary job ${job.id}`)
    await processSummary(job.data)
  },
  { connection, concurrency: 2 },
)

const notificationWorker = new Worker(
  QUEUE_NAMES.notifications,
  async (job) => {
    console.log(`[worker] notification job ${job.id}`)
    await processNotification(job.data)
  },
  { connection, concurrency: 4 },
)

for (const [name, w] of [
  ['ingestion', ingestionWorker],
  ['product-embed', productWorker],
  ['summary', summaryWorker],
  ['notifications', notificationWorker],
] as const) {
  w.on('failed', (job, err) =>
    console.error(`[worker:${name}] job ${job?.id} failed:`, err.message),
  )
}

const stopScheduler = startScheduler()

console.log('[worker] started — listening for jobs')

async function shutdown() {
  console.log('[worker] shutting down…')
  stopScheduler()
  await Promise.all([
    ingestionWorker.close(),
    productWorker.close(),
    summaryWorker.close(),
    notificationWorker.close(),
  ])
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
