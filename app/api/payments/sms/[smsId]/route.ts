import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { resolveBankSms } from '@/lib/payments/card/ingest'

type Params = { params: Promise<{ smsId: string }> }

// paymentId = attach this deposit to that payment (confirming it); null = it belongs to no order.
const schema = z.object({ paymentId: z.string().min(1).nullable() })

export async function PATCH(req: Request, props: Params) {
  const { smsId } = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const ok = await resolveBankSms(user.workspaceId, smsId, parsed.data.paymentId)
  if (!ok) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
