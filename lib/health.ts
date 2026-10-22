import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'

export interface HealthCheck {
  name: string
  ok: boolean
  latencyMs: number
  detail?: string
}

export interface HealthReport {
  status: 'operational' | 'degraded' | 'down'
  checks: HealthCheck[]
  checkedAt: string
}

const TIMEOUT_MS = 3000

function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms),
    ),
  ])
}

async function timed(
  name: string,
  fn: () => Promise<unknown>,
): Promise<HealthCheck> {
  const start = Date.now()
  try {
    await withTimeout(fn())
    return { name, ok: true, latencyMs: Date.now() - start }
  } catch (e) {
    return {
      name,
      ok: false,
      latencyMs: Date.now() - start,
      detail: e instanceof Error ? e.message : 'error',
    }
  }
}

export interface ServiceCheck {
  /** Key into the status page copy. */
  name: 'ai' | 'instagram' | 'telegram' | 'bale' | 'rubika' | 'sms'
  state: 'ok' | 'degraded' | 'idle'
  /** When the service last did real work, for the «x minutes ago» line. */
  lastActivityAt: string | null
}

const HOUR = 3_600_000

/**
 * What customers actually depend on, read from what the platform already
 * records instead of probing third parties from a public page:
 *   • AI replies — the newest successful reply (UsageLog).
 *   • Messengers — the worker's provider probes (AgentChannel.healthStatus):
 *     «degraded» there means the provider itself was unreachable.
 *   • Bank SMS — the newest deposit message any gateway phone forwarded.
 * Kept out of runHealthChecks so /api/health (deploys, uptime monitors) keeps
 * reporting only our own infrastructure.
 */
export async function runServiceChecks(now = new Date()): Promise<ServiceCheck[]> {
  const since = new Date(now.getTime() - 12 * HOUR)
  const [lastReply, probes, lastSms] = await Promise.all([
    prisma.usageLog.findFirst({ orderBy: { date: 'desc' }, select: { date: true } }).catch(() => null),
    prisma.agentChannel.groupBy({
      by: ['type', 'healthStatus'],
      where: { active: true, type: { in: ['INSTAGRAM', 'TELEGRAM', 'BALE', 'RUBIKA'] }, healthCheckedAt: { gte: since } },
      _count: { _all: true },
      _max: { healthCheckedAt: true },
    }).catch(() => []),
    prisma.bankSms.findFirst({ orderBy: { receivedAt: 'desc' }, select: { receivedAt: true } }).catch(() => null),
  ])
  const recent = (at: Date | null | undefined, hours: number) => Boolean(at && now.getTime() - at.getTime() < hours * HOUR)
  const messenger = (type: 'INSTAGRAM' | 'TELEGRAM' | 'BALE' | 'RUBIKA', name: ServiceCheck['name']): ServiceCheck => {
    const rows = probes.filter((row) => row.type === type)
    const degraded = rows.some((row) => row.healthStatus === 'degraded' && row._count._all > 0)
    const okRow = rows.find((row) => row.healthStatus === 'ok')
    return {
      name,
      state: degraded && !okRow ? 'degraded' : okRow ? 'ok' : 'idle',
      lastActivityAt: (okRow?._max.healthCheckedAt ?? rows[0]?._max.healthCheckedAt)?.toISOString() ?? null,
    }
  }
  return [
    { name: 'ai', state: recent(lastReply?.date, 2) ? 'ok' : 'idle', lastActivityAt: lastReply?.date.toISOString() ?? null },
    messenger('INSTAGRAM', 'instagram'),
    messenger('TELEGRAM', 'telegram'),
    messenger('BALE', 'bale'),
    messenger('RUBIKA', 'rubika'),
    { name: 'sms', state: recent(lastSms?.receivedAt, 6) ? 'ok' : 'idle', lastActivityAt: lastSms?.receivedAt.toISOString() ?? null },
  ]
}

/** Run all platform health checks (database, redis). */
export async function runHealthChecks(): Promise<HealthReport> {
  const checks = await Promise.all([
    timed('database', () => prisma.$queryRaw`SELECT 1`),
    timed('redis', () => getRedis().ping()),
  ])

  const downCount = checks.filter((c) => !c.ok).length
  const status: HealthReport['status'] =
    downCount === 0 ? 'operational' : downCount === checks.length ? 'down' : 'degraded'

  return { status, checks, checkedAt: new Date().toISOString() }
}
