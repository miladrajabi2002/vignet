import 'dotenv/config'
import { Worker } from 'bullmq'
import { QUEUE_NAMES, createQueueConnection } from '@/lib/queue/connection'
import { processIngestion } from '@/lib/knowledge/ingest'
import { processProductEmbed } from '@/lib/products/catalog'
import { processSummary } from '@/lib/conversations/summary'
import { processNotification } from '@/lib/notifications/notify'
import { handleInbound, handleInstagramGlobalInbound } from '@/lib/channels/handler'
import { handleWhatsappGlobalInbound } from '@/lib/whatsapp/webhook'
import { processCampaign } from '@/lib/campaigns/process'
import { processWooWebhookBatch } from '@/lib/integrations/woocommerce'
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

const inboundWorker = new Worker(
  QUEUE_NAMES.inboundMessage,
  async (job) => {
    console.log(`[worker] inbound-message job ${job.id}`)
    const data = job.data as {
      global?: 'INSTAGRAM' | 'WHATSAPP'
      type?: Parameters<typeof handleInbound>[0]
      token?: string
      body: unknown
    }
    // Global Meta webhooks (signature already verified at the route) carry no
    // per-channel token — they demux to the owning tenant inside the handler.
    if (data.global === 'INSTAGRAM') {
      await handleInstagramGlobalInbound(data.body)
    } else if (data.global === 'WHATSAPP') {
      await handleWhatsappGlobalInbound(data.body)
    } else if (data.type && data.token) {
      await handleInbound(data.type, data.token, data.body)
    }
  },
  // Each job may hold an LLM round-trip — allow real parallelism.
  { connection, concurrency: 8 },
)

const campaignWorker = new Worker(
  QUEUE_NAMES.campaigns,
  async (job) => {
    console.log(`[worker] campaign job ${job.id}`)
    await processCampaign(job.data)
  },
  // Provider calls are rate-limited inside the processor. One campaign per
  // worker avoids bursts and keeps per-recipient ordering predictable.
  { connection, concurrency: 1 },
)

const wooWebhookWorker = new Worker(
  QUEUE_NAMES.wooWebhook,
  async (job) => {
    console.log(`[worker] woo-webhook job ${job.id}`)
    await processWooWebhookBatch(job.data)
  },
  { connection, concurrency: 3 },
)

for (const [name, w] of [
  ['ingestion', ingestionWorker],
  ['product-embed', productWorker],
  ['summary', summaryWorker],
  ['notifications', notificationWorker],
  ['inbound-message', inboundWorker],
  ['campaigns', campaignWorker],
  ['woo-webhook', wooWebhookWorker],
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
    inboundWorker.close(),
    campaignWorker.close(),
    wooWebhookWorker.close(),
  ])
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
