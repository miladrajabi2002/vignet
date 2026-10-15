import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ cardId: string }> }

const schema = z.object({
  active: z.boolean().optional(),
  holderName: z.string().trim().min(2).max(80).optional(),
  // Whole tomans; null removes the cap.
  dailyCap: z.number().int().positive().max(2_000_000_000).nullable().optional(),
})

export async function PATCH(req: Request, props: Params) {
  const { cardId } = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 })
  const updated = await prisma.payCard.updateMany({ where: { id: cardId, workspaceId: user.workspaceId, deletedAt: null }, data: parsed.data })
  if (!updated.count) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

/** Payments keep their card row, so a removed card is hidden, not deleted. */
export async function DELETE(_req: Request, props: Params) {
  const { cardId } = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const updated = await prisma.payCard.updateMany({ where: { id: cardId, workspaceId: user.workspaceId, deletedAt: null }, data: { deletedAt: new Date(), active: false } })
  if (!updated.count) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
