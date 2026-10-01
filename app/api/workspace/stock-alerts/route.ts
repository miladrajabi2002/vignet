import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { LOW_STOCK_MAX_THRESHOLD } from '@/lib/commerce/low-stock'

const schema = z.object({
  /** Units at or below which a tracked product alerts; 0 turns alerts off. */
  threshold: z.number().int().min(0).max(LOW_STOCK_MAX_THRESHOLD),
})

export async function PATCH(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  await prisma.workspace.update({
    where: { id: user.workspaceId },
    data: { lowStockThreshold: parsed.data.threshold },
  })
  return NextResponse.json({ ok: true, threshold: parsed.data.threshold })
}
