import { NextResponse } from 'next/server'
import { runHealthChecks } from '@/lib/health'

export const dynamic = 'force-dynamic'

export async function GET() {
  const report = await runHealthChecks()
  const httpStatus = report.status === 'down' ? 503 : 200
  return NextResponse.json(report, { status: httpStatus })
}
