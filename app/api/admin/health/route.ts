import IORedis from 'ioredis'
import { Queue, type ConnectionOptions } from 'bullmq'
import { HeadBucketCommand } from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin/auth'
import { getOpenRouterAccountUsage } from '@/lib/admin/ai-usage'
import { prisma } from '@/lib/prisma'
import { QUEUE_NAMES, isQueueDisabled } from '@/lib/queue/connection'
import { getBucket, getS3Client, isS3Configured } from '@/lib/storage/s3'

export const dynamic = 'force-dynamic'

type HealthState = 'healthy' | 'warning' | 'down' | 'unconfigured'

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
      queues: [] as Array<{ name: string; waiting: number; active: number; delayed: number; failed: number; completed: number }>,
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
        return {
          name,
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          failed: counts.failed ?? 0,
          completed: counts.completed ?? 0,
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
    const usage = await timed(getOpenRouterAccountUsage(), 9_000)
    const state: HealthState = usage.status === 'connected' ? 'healthy' : usage.status === 'unconfigured' ? 'unconfigured' : 'down'
    return {
      state,
      latencyMs: Date.now() - started,
      detail: state === 'healthy' ? 'حساب OpenRouter متصل است' : state === 'unconfigured' ? 'کلید OpenRouter تنظیم نشده است' : 'OpenRouter پاسخ نداد',
      creditsRemainingUSD: usage.totalCreditsRemainingUSD,
      usageMonthlyUSD: usage.usageMonthlyUSD,
    }
  } catch {
    return { state: 'down' as HealthState, latencyMs: Date.now() - started, detail: 'OpenRouter پاسخ نداد', creditsRemainingUSD: null, usageMonthlyUSD: null }
  }
}

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [database, redisQueues, storage, openRouter, channels, errorCount, failedPayments] = await Promise.all([
    databaseHealth(),
    redisAndQueuesHealth(),
    storageHealth(),
    openRouterHealth(),
    prisma.agentChannel.groupBy({
      by: ['type', 'active'],
      _count: { _all: true },
      _max: { lastInboundAt: true },
    }).catch(() => []),
    prisma.errorLog.count({ where: { createdAt: { gte: since24h } } }).catch(() => -1),
    prisma.payment.count({ where: { status: 'FAILED', createdAt: { gte: since24h } } }).catch(() => -1),
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
