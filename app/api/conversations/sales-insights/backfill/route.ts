import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { backfillWorkspaceSalesInsights } from '@/lib/ai/sales-intelligence'

/**
 * Authenticated, workspace-scoped historical backfill. Each invocation is
 * deliberately capped at 50 conversations and performs no LLM requests.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { limit?: unknown }
  const requestedLimit = typeof body.limit === 'number' && Number.isFinite(body.limit)
    ? body.limit
    : 20
  const result = await backfillWorkspaceSalesInsights(user.workspaceId, requestedLimit)

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}
