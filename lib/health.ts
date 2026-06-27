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
