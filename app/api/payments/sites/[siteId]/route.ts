import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ siteId: string }> }

const schema = z.object({ active: z.boolean() })

export async function PATCH(req: Request, props: Params) {
  const { siteId } = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const updated = await prisma.paySite.updateMany({ where: { id: siteId, workspaceId: user.workspaceId }, data: parsed.data })
  if (!updated.count) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, props: Params) {
  const { siteId } = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const deleted = await prisma.paySite.deleteMany({ where: { id: siteId, workspaceId: user.workspaceId } })
  if (!deleted.count) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
