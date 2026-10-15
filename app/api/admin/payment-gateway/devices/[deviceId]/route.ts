import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminAuthed } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ deviceId: string }> }

const schema = z.object({ active: z.boolean() })

/** Stop (or allow again) the SMS of one phone — e.g. a number that forwards someone else's messages. */
export async function PATCH(req: Request, props: Params) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const { deviceId } = await props.params
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const updated = await prisma.payDevice.updateMany({ where: { id: deviceId }, data: { active: parsed.data.active } })
  if (!updated.count) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
