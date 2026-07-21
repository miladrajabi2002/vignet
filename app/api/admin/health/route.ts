import IORedis from 'ioredis'
import { Queue, type ConnectionOptions } from 'bullmq'
import { HeadBucketCommand } from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin/auth'
import { ADMIN_OWNER_PHONE } from '@/lib/admin/auth'
import { getCurrentMonthAiSpendUSD, getOpenRouterAccountUsage } from '@/lib/admin/ai-usage'
import { prisma } from '@/lib/prisma'
import { ADMIN_VISIBLE_RELATED_WHERE, getAdminHiddenWorkspaceIds } from '@/lib/admin/reporting-scope'
import { QUEUE_NAMES, isQueueDisabled } from '@/lib/queue/connection'
import { getBucket, getS3Client, isS3Configured } from '@/lib/storage/s3'

export const dynamic = 'force-dynamic'

type HealthState = 'healthy' | 'warning' | 'down' | 'unconfigured'
type FailedJobLog = {
  id: string
  name: string
  failedReason: string
  stacktrace: string[]
  data: unknown
  timestamp: number
  processedOn: number | null
  finishedOn: number | null
  attemptsMade: number
}
type QueueRow = { name: string; waiting: number; active: number; delayed: number; failed: number; completed: number; failedJobs: FailedJobLog[] }

const SENSITIVE_KEY = /(token|secret|password|authorization|api[-_]?key|cookie|config)/i

function safeJobData(value: unknown, key = ''): unknown {
  if (SENSITIVE_KEY.test(key)) return '[پنهان‌شده]'
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => safeJobData(item))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 50).map(([childKey, child]) => [childKey, safeJobData(child, childKey)]))
  }
  if (typeof value === 'string' && value.length > 500) return `${value.slice(0, 500)}…`
  return value
}

async function timed<T>(work: Promise<T>, timeoutMs = 4_000): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)),
  ])
}

async function databaseHealth() {
  const started = Date.now()
  try {
    await timed(prisma.$queryRaw`SELECT 1`)
    return { state: 'healthy' as HealthState, latencyMs: Date.now() - started, detail: 'PostgreSQL پاسخ‌گو است' }
  } catch {
    return { state: 'down' as HealthState, latencyMs: Date.now() - started, detail: 'اتصال دیتابیس برقرار نشد' }
  }
}

async function redisAndQueuesHealth() {
  if (!process.env.REDIS_URL) {
    return {
      redis: { state: 'unconfigured' as HealthState, latencyMs: null, detail: 'REDIS_URL تنظیم نشده است' },
      queues: [] as QueueRow[],
      queueMode: isQueueDisabled() ? 'inline' : 'queue',
    }
  }

  const started = Date.now()
  const connection = new IORedis(process.env.REDIS_URL, {
    lazyConnect: true,
    connectTimeout: 2_500,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  })
  connection.on('error', () => undefined)
  const queues: Queue[] = []

  try {
    await timed(connection.connect(), 3_000)
    await timed(connection.ping(), 2_000)
    if (isQueueDisabled()) {
      return {
        redis: { state: 'healthy' as HealthState, latencyMs: Date.now() - started, detail: 'Redis پاسخ‌گو است' },
        queues: [],
        queueMode: 'inline',
      }
    }

    const queueRows = await Promise.all(
      Object.values(QUEUE_NAMES).map(async (name) => {
        const queue = new Queue(name, { connection: connection as unknown as ConnectionOptions })
        queues.push(queue)
        const counts = await timed(queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed'), 3_000)
        const failedJobs = await timed(queue.getJobs(['failed'], 0, 99, false), 3_000)
        return {
          name,
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          failed: counts.failed ?? 0,
          completed: counts.completed ?? 0,
          failedJobs: failedJobs.map((job) => ({
            id: String(job.id ?? 'بدون شناسه'),
            name: job.name,
            failedReason: job.failedReason || 'علت ثبت نشده',
            stacktrace: (job.stacktrace ?? []).slice(0, 4),
            data: safeJobData(job.data),
            timestamp: job.timestamp,
            processedOn: job.processedOn ?? null,
            finishedOn: job.finishedOn ?? null,
            attemptsMade: job.attemptsMade,
          })),
        }
      }),
    )
    return {
      redis: { state: 'healthy' as HealthState, latencyMs: Date.now() - started, detail: 'Redis و BullMQ پاسخ‌گو هستند' },
      queues: queueRows,
      queueMode: 'queue',
    }
  } catch {
    return {
      redis: { state: 'down' as HealthState, latencyMs: Date.now() - started, detail: 'Redis یا صف‌ها در دسترس نیستند' },
      queues: [],
      queueMode: isQueueDisabled() ? 'inline' : 'queue',
    }
  } finally {
    await Promise.allSettled(queues.map((queue) => queue.close()))
    connection.disconnect()
  }
}

async function storageHealth() {
  if (!isS3Configured()) {
    return { state: 'unconfigured' as HealthState, latencyMs: null, detail: 'MinIO / S3 تنظیم نشده است' }
  }
  const started = Date.now()
  try {
    await timed(getS3Client().send(new HeadBucketCommand({ Bucket: getBucket() })), 4_000)
    return { state: 'healthy' as HealthState, latencyMs: Date.now() - started, detail: `Bucket ${getBucket()} در دسترس است` }
  } catch {
    return { state: 'down' as HealthState, latencyMs: Date.now() - started, detail: `Bucket ${getBucket()} پاسخ نداد` }
  }
}

async function openRouterHealth() {
  const started = Date.now()
  try {
    const [usage, currentMonthSpendUSD] = await Promise.all([
      timed(getOpenRouterAccountUsage(), 9_000),
      getCurrentMonthAiSpendUSD().catch(() => null),
    ])
    const state: HealthState = usage.status === 'connected' ? 'healthy' : usage.status === 'unconfigured' ? 'unconfigured' : 'down'
    return {
      state,
      latencyMs: Date.now() - started,
      detail: state === 'healthy' ? 'حساب OpenRouter متصل است' : state === 'unconfigured' ? 'کلید OpenRouter تنظیم نشده است' : 'OpenRouter پاسخ نداد',
      creditsRemainingUSD: usage.totalCreditsRemainingUSD,
      usageMonthlyUSD: currentMonthSpendUSD,
    }
  } catch {
    return { state: 'down' as HealthState, latencyMs: Date.now() - started, detail: 'OpenRouter پاسخ نداد', creditsRemainingUSD: null, usageMonthlyUSD: null }
  }
}

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const hiddenWorkspaceIds = await getAdminHiddenWorkspaceIds()
  const visibleErrorWhere = hiddenWorkspaceIds.length
    ? { OR: [{ workspaceId: null }, { workspaceId: { notIn: hiddenWorkspaceIds } }] }
    : {}
  const [database, redisQueues, storage, openRouter, channels, errorCount, failedPayments] = await Promise.all([
    databaseHealth(),
    redisAndQueuesHealth(),
    storageHealth(),
    openRouterHealth(),
    prisma.agentChannel.groupBy({
      by: ['type', 'active'],
      where: { agent: ADMIN_VISIBLE_RELATED_WHERE },
      _count: { _all: true },
      _max: { lastInboundAt: true },
    }).catch(() => []),
    prisma.errorLog.count({ where: { AND: [visibleErrorWhere, { createdAt: { gte: since24h } }] } }).catch(() => -1),
    prisma.payment.count({ where: { ...ADMIN_VISIBLE_RELATED_WHERE, status: 'FAILED', createdAt: { gte: since24h } } }).catch(() => -1),
  ])

  const queueFailed = redisQueues.queues.reduce((sum, queue) => sum + queue.failed, 0)
  const queueBacklog = redisQueues.queues.reduce((sum, queue) => sum + queue.waiting + queue.delayed, 0)
  const attention = [
    database.state === 'down' && 'دیتابیس در دسترس نیست',
    redisQueues.redis.state === 'down' && 'Redis یا Queue در دسترس نیست',
    storage.state === 'down' && 'MinIO / S3 پاسخ نمی‌دهد',
    openRouter.state === 'down' && 'OpenRouter پاسخ نمی‌دهد',
    queueFailed > 0 && `${queueFailed.toLocaleString('fa-IR')} کار صف ناموفق`,
    errorCount > 0 && `${errorCount.toLocaleString('fa-IR')} خطا در ۲۴ ساعت`,
    failedPayments > 0 && `${failedPayments.toLocaleString('fa-IR')} پرداخت ناموفق در ۲۴ ساعت`,
  ].filter(Boolean)

  return NextResponse.json({
    sampledAt: Date.now(),
    services: { database, redis: redisQueues.redis, storage, openRouter },
    queueMode: redisQueues.queueMode,
    queues: redisQueues.queues,
    queueSummary: { failed: queueFailed, backlog: queueBacklog },
    channels: channels.map((row) => ({ type: row.type, active: row.active, count: row._count._all, lastInboundAt: row._max.lastInboundAt })),
    attention,
  })
}

export async function POST(request: Request) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!process.env.REDIS_URL || isQueueDisabled()) return NextResponse.json({ error: 'QUEUE_UNAVAILABLE' }, { status: 409 })

  const body = await request.json().catch(() => null) as { action?: string; queueName?: string } | null
  const queueName = body?.queueName
  const action = body?.action
  if (!queueName || !Object.values(QUEUE_NAMES).includes(queueName as (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES])) {
    return NextResponse.json({ error: 'INVALID_QUEUE' }, { status: 400 })
  }
  if (action !== 'retryFailed' && action !== 'clearFailed') {
    return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 })
  }

  const connection = new IORedis(process.env.REDIS_URL, { lazyConnect: true, connectTimeout: 2_500, maxRetriesPerRequest: null, enableOfflineQueue: false, retryStrategy: () => null })
  connection.on('error', () => undefined)
  let queue: Queue | null = null
  try {
    await timed(connection.connect(), 3_000)
    queue = new Queue(queueName, { connection: connection as unknown as ConnectionOptions })
    let affected = 0
    if (action === 'retryFailed') {
      const jobs = await timed(queue.getJobs(['failed'], 0, 99, false), 4_000)
      const results = await Promise.allSettled(jobs.map((job) => job.retry()))
      affected = results.filter((result) => result.status === 'fulfilled').length
    } else {
      const removed = await timed(queue.clean(0, 1_000, 'failed'), 5_000)
      affected = removed.length
    }

    await prisma.adminAuditLog.create({
      data: {
        adminPhone: ADMIN_OWNER_PHONE || 'unconfigured',
        action: action === 'retryFailed' ? 'RETRY_FAILED_QUEUE_JOBS' : 'CLEAR_FAILED_QUEUE_LOGS',
        targetType: 'Queue',
        targetId: queueName,
        payload: { affected },
      },
    })
    return NextResponse.json({ ok: true, affected })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'QUEUE_ACTION_FAILED' }, { status: 500 })
  } finally {
    await queue?.close().catch(() => undefined)
    if (connection.status !== 'end') connection.disconnect()
  }
}
