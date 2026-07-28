import { NextResponse } from 'next/server'
import { persistLog } from '@/lib/errors/capture'
import { rateLimit } from '@/lib/ratelimit'
import { getClientIp } from '@/lib/security/request-ip'
import { getRequestId, requestIdHeaders } from '@/lib/observability/request-context'

export async function POST(req: Request) {
  const requestId = getRequestId(req.headers)
  const headers = requestIdHeaders(requestId)
  const ip = getClientIp(req.headers)
  if (!(await rateLimit(`client_error:${ip}`, 30, 60, { failClosed: true }))) {
    return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429, headers })
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400, headers })
  }

  const source = typeof body.source === 'string'
    ? `client:${body.source.slice(0, 120)}`
    : 'client:unknown'
  const error = new Error(body.message.slice(0, 4_000))
  if (typeof body.stack === 'string') error.stack = body.stack.slice(0, 8_000)

  await persistLog('error', source, error, {
    metadata: {
      requestId,
      ip,
      digest: typeof body.digest === 'string' ? body.digest.slice(0, 200) : undefined,
      path: typeof body.path === 'string' ? body.path.slice(0, 500) : undefined,
    },
  })
  return NextResponse.json({ ok: true, requestId }, { headers })
}
