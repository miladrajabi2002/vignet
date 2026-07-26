import type { Queue } from 'bullmq'
import { QUEUE_NAMES, createQueueConnection, isQueueDisabled } from '@/lib/queue/connection'
import type { IngestionJobData } from '@/lib/knowledge/ingest'
import type { ProductEmbedJobData } from '@/lib/products/catalog'
import type { SummaryJobData } from '@/lib/conversations/summary'
import type { NotificationJobData } from '@/lib/notifications/notify'
import type { CampaignJobData } from '@/lib/campaigns/process'
import crypto from 'node:crypto'

export interface InboundMessageJobData {
  type: string
  token: string
  body: unknown
}

/**
 * A signature-verified payload from one of the GLOBAL Meta webhooks
 * (`/api/webhook/instagram`, `/api/webhook/whatsapp`). Routed to the matching
 * per-tenant channel inside the worker (`handle*GlobalInbound`).
 */
export interface GlobalInboundJobData {
  global: 'INSTAGRAM' | 'WHATSAPP'
  body: unknown
}

export interface WooWebhookEvent {
  eventId: string
  topic: string
  data: unknown
  changedAt?: string
}

export interface WooWebhookBatchJobData {
  integrationId: string
  workspaceId: string
  storeUrl: string
  deliveryId: string
  pluginVersion?: string
  events: WooWebhookEvent[]
}

// Lazily-created Queue singletons (bullmq is imported dynamically to keep it
// out of the edge/runtime bundle until actually needed).
const queues = new Map<string, Queue>()

async function getQueue(name: string): Promise<Queue> {
  const existing = queues.get(name)
  if (existing) return existing
  const { Queue } = await import('bullmq')
  // Producer connection: fail fast when Redis is down so callers can fall
  // back (inline in dev) or surface 503 to webhook platforms for redelivery.
  const q = new Queue(name, { connection: createQueueConnection({ failFast: true }) })
  queues.set(name, q)
  return q
}

/**
 * Enqueue a knowledge-ingestion job. Falls back to inline processing when the
 * queue is disabled or unavailable (so dev works without a running worker).
 */
export async function dispatchIngestion(data: IngestionJobData): Promise<void> {
  if (isQueueDisabled()) return await runInlineIngestion(data)
  try {
    const q = await getQueue(QUEUE_NAMES.ingestion)
    await q.add('ingest', data, {
      removeOnComplete: true,
      removeOnFail: 50,
      // Embedding-provider blips (429/5xx) are the dominant failure mode —
      // immediate same-second retries just fail again; back off instead.
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
    })
  } catch (e) {
    return handleEnqueueFailure('ingestion', e, () => runInlineIngestion(data))
  }
}

/** Enqueue a product re-embedding job (per affected agent). */
export async function dispatchProductEmbed(
  data: ProductEmbedJobData,
): Promise<void> {
  if (isQueueDisabled()) return await runInlineProductEmbed(data)
  try {
    const q = await getQueue(QUEUE_NAMES.productEmbed)
    await q.add('embed', data, {
      removeOnComplete: true,
      removeOnFail: 50,
      attempts: 2,
    })
  } catch (e) {
    return handleEnqueueFailure('product-embed', e, () => runInlineProductEmbed(data), true)
  }
}

/** Queue an authenticated WooCommerce delivery for durable, retryable processing. */
export async function dispatchWooWebhook(data: WooWebhookBatchJobData): Promise<void> {
  if (isQueueDisabled()) return await runInlineWooWebhook(data)
  try {
    const q = await getQueue(QUEUE_NAMES.wooWebhook)
    const idHash = crypto
      .createHash('sha256')
      .update(`${data.integrationId}:${data.deliveryId}`)
      .digest('hex')
    const jobId = `woo-${idHash}`
    const existing = await q.getJob(jobId)
    if (existing) {
      if ((await existing.getState()) === 'failed') await existing.retry()
      return
    }
    await q.add('sync-batch', data, {
      jobId,
      removeOnComplete: 1000,
      // Retain failed jobs (including their event payload) for inspection and
      // manual retry. WordPress has already removed locally accepted events.
      removeOnFail: 1000,
      attempts: 5,
      backoff: { type: 'exponential', delay: 2_000 },
    })
  } catch (e) {
    return handleEnqueueFailure('woo-webhook', e, () => runInlineWooWebhook(data), true)
  }
}

/** Enqueue a conversation-summary job. Falls back to inline processing. */
export async function dispatchSummary(data: SummaryJobData): Promise<void> {
  if (isQueueDisabled()) return await runInlineSummary(data)
  try {
    const q = await getQueue(QUEUE_NAMES.conversationSummary)
    await q.add('summary', data, {
      removeOnComplete: true,
      removeOnFail: 50,
      attempts: 2,
    })
  } catch (e) {
    return handleEnqueueFailure('summary', e, () => runInlineSummary(data))
  }
}

/** Enqueue a notification (email/SMS/ops). Falls back to inline processing. */
export async function dispatchNotification(
  data: NotificationJobData,
): Promise<void> {
  if (isQueueDisabled()) return await runInlineNotification(data)
  try {
    const q = await getQueue(QUEUE_NAMES.notifications)
    await q.add('notify', data, {
      removeOnComplete: true,
      removeOnFail: 50,
      attempts: 3,
    })
  } catch (e) {
    return handleEnqueueFailure('notification', e, () => runInlineNotification(data))
  }
}

/** Queue an explicitly-confirmed campaign. Creation/preview never call this. */
export async function dispatchCampaign(data: CampaignJobData): Promise<void> {
  if (isQueueDisabled()) return await runInlineCampaign(data)
  try {
    const q = await getQueue(QUEUE_NAMES.campaigns)
    await q.add('campaign', data, {
      jobId: `campaign:${data.campaignId}`,
      removeOnComplete: true,
      removeOnFail: 50,
      // Recipient claiming is idempotent. A second worker attempt resumes
      // PENDING rows while SENDING rows become DELIVERY_UNCERTAIN, so a crash
      // cannot leave the whole campaign stuck or resend an acknowledged row.
      attempts: 2,
      backoff: { type: 'exponential', delay: 2_000 },
    })
  } catch (e) {
    return handleEnqueueFailure('campaign', e, () => runInlineCampaign(data), true)
  }
}

async function runInlineIngestion(data: IngestionJobData): Promise<void> {
  const { processIngestion } = await import('@/lib/knowledge/ingest')
  await processIngestion(data)
}

async function runInlineProductEmbed(data: ProductEmbedJobData): Promise<void> {
  const { processProductEmbed } = await import('@/lib/products/catalog')
  await processProductEmbed(data)
}

async function runInlineSummary(data: SummaryJobData): Promise<void> {
  const { processSummary } = await import('@/lib/conversations/summary')
  await processSummary(data)
}

async function runInlineNotification(data: NotificationJobData): Promise<void> {
  const { processNotification } = await import('@/lib/notifications/notify')
  await processNotification(data)
}

async function runInlineCampaign(data: CampaignJobData): Promise<void> {
  const { processCampaign } = await import('@/lib/campaigns/process')
  await processCampaign(data)
}

async function runInlineWooWebhook(data: WooWebhookBatchJobData): Promise<void> {
  const { processWooWebhookBatch } = await import('@/lib/integrations/woocommerce')
  await processWooWebhookBatch(data)
}

/**
 * Enqueue an inbound messenger webhook update for durable processing in the
 * worker (LLM reply generation off the web process; survives restarts and
 * gets 2 attempts). Falls back to inline fire-and-forget processing when the
 * queue is disabled/unavailable so dev works without a worker.
 */
export async function dispatchInbound(data: InboundMessageJobData): Promise<void> {
  if (isQueueDisabled()) return await runInlineInbound(data)
  try {
    const q = await getQueue(QUEUE_NAMES.inboundMessage)
    await q.add('inbound', data, {
      // Retain failed inbound jobs for inspection and manual retry: the
      // platform already ACKed, so this record is the only remaining copy of
      // the customer's message.
      removeOnComplete: true,
      removeOnFail: 500,
      // Retries are safe now that per-message idempotency claims skip the
      // messages that already succeeded. Back off so a DB/provider blip has
      // time to clear instead of burning both attempts in the same second.
      attempts: 3,
      backoff: { type: 'exponential', delay: 3_000 },
    })
  } catch (e) {
    return handleEnqueueFailure('inbound', e, () => runInlineInbound(data), true)
  }
}

async function runInlineInbound(data: InboundMessageJobData): Promise<void> {
  const { handleInbound } = await import('@/lib/channels/handler')
  await handleInbound(
    data.type as Parameters<typeof handleInbound>[0],
    data.token,
    data.body,
  )
}

/**
 * Enqueue a GLOBAL Meta webhook payload (Instagram / WhatsApp OAuth) for
 * durable processing in the worker. Previously these payloads were processed
 * fire-and-forget inside the web process after the 200 ACK: a deploy/restart
 * or transient DB/LLM failure silently lost the customer's message with no
 * retry. The queue gives the same durability the per-token webhooks have.
 *
 * The jobId is a content hash, so a Meta redelivery of the identical payload
 * dedupes against the still-retained job record instead of double-processing.
 * Throws in production when the queue is unavailable — the webhook route
 * answers 503 so Meta redelivers later.
 */
export async function dispatchGlobalInbound(data: GlobalInboundJobData): Promise<void> {
  if (isQueueDisabled()) {
    // Dev without a worker: keep the fast ACK, process fire-and-forget.
    void runInlineGlobalInbound(data).catch((e) =>
      console.error(`[queue] inline ${data.global} global inbound failed:`, e),
    )
    return
  }
  try {
    const q = await getQueue(QUEUE_NAMES.inboundMessage)
    const idHash = crypto
      .createHash('sha256')
      .update(`${data.global}:${JSON.stringify(data.body)}`)
      .digest('hex')
    const jobId = `global-${idHash}`
    const existing = await q.getJob(jobId)
    if (existing) {
      if ((await existing.getState()) === 'failed') await existing.retry()
      return
    }
    await q.add('inbound-global', data, {
      jobId,
      // Keep recent completed records so redeliveries dedupe via jobId.
      removeOnComplete: 500,
      removeOnFail: 100,
      attempts: 2,
      backoff: { type: 'exponential', delay: 2_000 },
    })
  } catch (e) {
    return handleEnqueueFailure(
      'inbound-global',
      e,
      () => runInlineGlobalInbound(data),
      true,
    )
  }
}

async function runInlineGlobalInbound(data: GlobalInboundJobData): Promise<void> {
  if (data.global === 'INSTAGRAM') {
    const { handleInstagramGlobalInbound } = await import('@/lib/channels/handler')
    await handleInstagramGlobalInbound(data.body)
  } else {
    const { handleWhatsappGlobalInbound } = await import('@/lib/whatsapp/webhook')
    await handleWhatsappGlobalInbound(data.body)
  }
}

async function handleEnqueueFailure(
  name: string,
  error: unknown,
  runInline: () => Promise<void>,
  queueRequired = false,
): Promise<void> {
  if (process.env.NODE_ENV === 'production' && queueRequired) {
    console.error(`[queue] ${name} enqueue failed; refusing non-durable fallback:`, error)
    throw error
  }
  console.warn(`[queue] ${name} enqueue failed; awaiting inline fallback:`, error)
  await runInline()
}
