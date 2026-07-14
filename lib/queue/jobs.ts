import type { Queue } from 'bullmq'
import { QUEUE_NAMES, createQueueConnection, isQueueDisabled } from '@/lib/queue/connection'
import type { IngestionJobData } from '@/lib/knowledge/ingest'
import type { ProductEmbedJobData } from '@/lib/products/catalog'
import type { SummaryJobData } from '@/lib/conversations/summary'
import type { NotificationJobData } from '@/lib/notifications/notify'
import type { CampaignJobData } from '@/lib/campaigns/process'

export interface InboundMessageJobData {
  type: string
  token: string
  body: unknown
}

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
  if (isQueueDisabled()) return await runInlineIngestion(data)
  try {
    const q = await getQueue(QUEUE_NAMES.ingestion)
    await q.add('ingest', data, {
      removeOnComplete: true,
      removeOnFail: 50,
      attempts: 2,
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
    return handleEnqueueFailure('product-embed', e, () => runInlineProductEmbed(data))
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
      removeOnComplete: true,
      removeOnFail: 50,
      attempts: 2,
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
