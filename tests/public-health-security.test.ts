import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/health', () => ({
  runHealthChecks: vi.fn(async () => ({
    status: 'degraded',
    checkedAt: '2026-07-19T00:00:00.000Z',
    checks: [
      {
        name: 'database',
        ok: false,
        latencyMs: 12,
        detail: 'connect ECONNREFUSED postgres.internal:5432',
      },
    ],
  })),
}))

import { GET } from '@/app/api/health/route'

describe('public health endpoint', () => {
  it('does not expose internal provider error details', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const body = await response.json()
    expect(body.checks[0]).toEqual({ name: 'database', ok: false, latencyMs: 12 })
    expect(JSON.stringify(body)).not.toContain('postgres.internal')
  })
})

