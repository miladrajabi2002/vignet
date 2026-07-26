import crypto from 'node:crypto'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'
import {
  resolveWooCredentials,
  syncWooOrders,
  syncWooProducts,
  verifyWooWebhookSignature,
  type StoreIntegrationInput,
} from '@/lib/integrations/woocommerce'
import { prisma } from '@/lib/prisma'
import {
  dispatchWooWebhook,
  type WooWebhookBatchJobData,
  type WooWebhookEvent,
} from '@/lib/queue/jobs'
import { readBoundedRequestBody, RequestBodyTooLargeError } from '@/lib/security/request-body'
import { getCurrentUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

const MAX_WEBHOOK_BYTES = 4 * 1024 * 1024
const eventSchema = z.object({
  event_id: z.string().min(1).max(128),
  topic: z.string().min(1).max(80),
  data: z.unknown(),
  changed_at: z.string().max(64).optional(),
})
const batchSchema = z.object({
  version: z.literal(1),
  site_url: z.string().min(1).max(2048),
  events: z.array(eventSchema).min(1).max(100),
})

function digest(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function normalizeSiteUrl(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    url.search = ''
    url.hash = ''
    url.pathname = url.pathname.replace(/\/+$/, '')
    return url.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

function sameSiteUrl(a: string, b: string): boolean {
  const left = normalizeSiteUrl(a)
  const right = normalizeSiteUrl(b)
  return Boolean(left && right && left === right)
}

function pluginVersionFromHeaders(req: Request): string | undefined {
  const value = req.headers.get('x-vigent-plugin-version')?.trim()
  return value && value.length <= 40 ? value : undefined
}

async function loadManualIntegration(integrationId: string, workspaceId: string) {
  const row = await prisma.storeIntegration.findFirst({
    where: { id: integrationId, workspaceId, active: true, type: 'WOOCOMMERCE' },
    select: {
      id: true,
      workspaceId: true,
      storeUrl: true,
      credentials: true,
      lastWebhookAt: true,
      lastSyncAt: true,
      lastSyncStatus: true,
    },
  })
  if (!row) return null
  try {
    return {
      integration: {
        id: row.id,
        workspaceId: row.workspaceId,
        storeUrl: row.storeUrl,
        credentials: resolveWooCredentials(row.credentials),
      } satisfies StoreIntegrationInput,
      webhookOnly: false,
      row,
    }
  } catch {
    return {
      integration: {
        id: row.id,
        workspaceId: row.workspaceId,
        storeUrl: row.storeUrl,
        credentials: { consumerKey: '', consumerSecret: '' },
      } satisfies StoreIntegrationInput,
      webhookOnly: true,
      row,
    }
  }
}

function parseDelivery(
  topic: string,
  json: unknown,
  rawBody: string,
  integration: { id: string; workspaceId: string; storeUrl: string },
  req: Request,
): WooWebhookBatchJobData | { error: string } {
  let events: WooWebhookEvent[]
  let deliveryId: string

  if (topic === 'sync.batch') {
    const parsed = batchSchema.safeParse(json)
    if (!parsed.success) return { error: 'INVALID_BATCH' }
    if (!sameSiteUrl(parsed.data.site_url, integration.storeUrl)) {
      return { error: 'SITE_URL_MISMATCH' }
    }
    events = parsed.data.events.map((event) => ({
      eventId: event.event_id,
      topic: event.topic,
      data: event.data,
      changedAt: event.changed_at,
    }))
    deliveryId = `batch-${digest(events.map((event) => event.eventId).join('\u0000'))}`
  } else {
    if (!topic || topic.length > 80) return { error: 'INVALID_TOPIC' }
    const eventId =
      req.headers.get('x-vigent-event-id')?.slice(0, 128) ||
      `legacy-${digest(`${topic}\u0000${rawBody}`)}`
    events = [{ eventId, topic, data: json }]
    deliveryId =
      req.headers.get('x-vigent-delivery-id')?.slice(0, 160) ||
      `single-${digest(eventId)}`
  }

  return {
    integrationId: integration.id,
    workspaceId: integration.workspaceId,
    storeUrl: integration.storeUrl,
    deliveryId,
    pluginVersion: pluginVersionFromHeaders(req),
    events,
  }
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token && searchParams.get('integrationId')) return handleManualSync(req)
  if (!token || token.length > 256) {
    return NextResponse.json({ error: 'MISSING_TOKEN' }, { status: 400 })
  }

  const integration = await prisma.storeIntegration.findFirst({
    where: { webhookSecret: token, type: 'WOOCOMMERCE' },
    select: {
      id: true,
      workspaceId: true,
      storeUrl: true,
      webhookSecret: true,
      active: true,
    },
  })
  if (!integration?.webhookSecret) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }
  if (!(await checkWorkspaceActive(integration.workspaceId)).allowed) {
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  }

  let rawBody: string
  try {
    rawBody = (await readBoundedRequestBody(req, MAX_WEBHOOK_BYTES)).toString('utf8')
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
    }
    throw error
  }
  const signature = req.headers.get('x-wc-webhook-signature') ?? ''
  const topic = req.headers.get('x-wc-webhook-topic')?.trim() ?? ''
  if (!verifyWooWebhookSignature(rawBody, signature, integration.webhookSecret)) {
    console.warn(`[woo-webhook] invalid signature for integration ${integration.id}`)
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 })
  }

  let json: unknown
  try {
    json = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }
  if (topic.startsWith('content.')) {
    return NextResponse.json({ ok: true, ignored: 'content_deprecated' })
  }

  const job = parseDelivery(topic, json, rawBody, integration, req)
  if ('error' in job) {
    return NextResponse.json({ error: job.error }, { status: 400 })
  }

  const payloadHash = digest(rawBody)
  let delivery = await prisma.storeWebhookDelivery.findUnique({
    where: {
      integrationId_deliveryId: {
        integrationId: integration.id,
        deliveryId: job.deliveryId,
      },
    },
    select: { id: true, payloadHash: true, status: true },
  })
  if (!delivery) {
    try {
      delivery = await prisma.storeWebhookDelivery.create({
        data: {
          integrationId: integration.id,
          deliveryId: job.deliveryId,
          payloadHash,
          eventCount: job.events.length,
        },
        select: { id: true, payloadHash: true, status: true },
      })
    } catch {
      delivery = await prisma.storeWebhookDelivery.findUnique({
        where: {
          integrationId_deliveryId: {
            integrationId: integration.id,
            deliveryId: job.deliveryId,
          },
        },
        select: { id: true, payloadHash: true, status: true },
      })
    }
  }
  if (!delivery) {
    return NextResponse.json({ error: 'DELIVERY_REGISTRATION_FAILED' }, { status: 503 })
  }
  if (delivery.payloadHash !== payloadHash) {
    return NextResponse.json({ error: 'DELIVERY_CONFLICT' }, { status: 409 })
  }
  if (delivery.status === 'processed') {
    return NextResponse.json({ ok: true, duplicate: true })
  }
  const canReactivate = job.events.every((event) =>
    event.topic === 'test.connection' || event.topic === 'connection.test',
  )
  if (!integration.active && !canReactivate) {
    return NextResponse.json({ error: 'INTEGRATION_DISCONNECTED' }, { status: 409 })
  }

  try {
    await dispatchWooWebhook(job)
  } catch (error) {
    await prisma.storeWebhookDelivery.update({
      where: { id: delivery.id },
      data: { status: 'error', error: error instanceof Error ? error.message.slice(0, 1000) : 'QUEUE_UNAVAILABLE' },
    }).catch(() => undefined)
    return NextResponse.json({ error: 'QUEUE_UNAVAILABLE' }, { status: 503 })
  }
  return NextResponse.json({ ok: true, accepted: job.events.length }, { status: 202 })
}

async function handleManualSync(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed) {
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  }
  const integrationId = new URL(req.url).searchParams.get('integrationId')
  if (!integrationId) {
    return NextResponse.json({ error: 'MISSING_INTEGRATION_ID' }, { status: 400 })
  }
  const loaded = await loadManualIntegration(integrationId, user.workspaceId)
  if (!loaded) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  if (loaded.webhookOnly) {
    const pending = await prisma.storeWebhookDelivery.count({
      where: { integrationId, status: { in: ['pending', 'processing', 'error'] } },
    })
    return NextResponse.json({
      ok: true,
      mode: 'webhook-only',
      message: pending > 0
        ? `${pending} بسته در صف همگام‌سازی است.`
        : 'اتصال فعال است؛ تغییرات به‌صورت خودکار همگام می‌شوند.',
      status: {
        pending,
        lastWebhookAt: loaded.row.lastWebhookAt,
        lastSyncAt: loaded.row.lastSyncAt,
        lastSyncStatus: loaded.row.lastSyncStatus,
      },
      products: { count: 0, errors: [], skipped: true },
      orders: { count: 0, skipped: true },
    })
  }

  const [products, orders] = await Promise.all([
    syncWooProducts(loaded.integration),
    syncWooOrders(loaded.integration, { sinceDays: 30 }),
  ])
  return NextResponse.json({
    ok: true,
    message: `${products.count} محصول و ${orders.count} سفارش بررسی شد.`,
    products: { count: products.count, errors: products.errors },
    orders: { count: orders.count },
  })
}
