import { NextResponse } from 'next/server'
import { runHealthChecks } from '@/lib/health'

export const dynamic = 'force-dynamic'

export async function GET() {
  const report = await runHealthChecks()
  const httpStatus = report.status === 'down' ? 503 : 200
  // Keep provider/driver exception text out of the unauthenticated health API;
  // connection errors can contain internal hosts, ports and deployment paths.
  const publicReport = {
    ...report,
    checks: report.checks.map((check) => ({
      name: check.name,
      ok: check.ok,
      latencyMs: check.latencyMs,
    })),
  }
  return NextResponse.json(publicReport, {
    status: httpStatus,
    headers: { 'Cache-Control': 'no-store' },
  })
}
