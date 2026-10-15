import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminAuthed } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { resolveBankSms } from '@/lib/payments/card/ingest'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ smsId: string }> }

const schema = z.object({ paymentId: z.string().min(1).max(64).nullable() })

/** Attach an unmatched deposit to a payment of the same business (confirming it), or dismiss it. */
export async function POST(req: Request, props: Params) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const { smsId } = await props.params
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const sms = await prisma.bankSms.findUnique({ where: { id: smsId }, select: { workspaceId: true } })
  if (!sms) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const done = await resolveBankSms(sms.workspaceId, smsId, parsed.data.paymentId, 'ADMIN')
  if (!done) return NextResponse.json({ error: 'ALREADY_FINAL' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
