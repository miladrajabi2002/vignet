import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { rateLimit } from '@/lib/ratelimit'
import { readSmsSample } from '@/lib/payments/card/sms-sample'

export const dynamic = 'force-dynamic'

const schema = z.object({ text: z.string().trim().min(8).max(600) })

/** Setup: read a pasted deposit SMS for the forwarding rule's filter (the deposit word and the account number). */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  if (!(await rateLimit(`pay-sms-sample:${user.workspaceId}`, 30, 3600))) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 })
  return NextResponse.json(await readSmsSample(user.workspaceId, parsed.data.text))
}
