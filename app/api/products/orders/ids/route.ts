import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Ids of every order matching the CURRENT list filters — powers the
 * "انتخاب همه N نتیجه" action on the orders page. Mirrors the where-builder
 * of the orders list page. Capped at 20 000 ids.
 */

const ORDER_STATUSES = [
  'pending',
  'processing',
  'on-hold',
  'completed',
  'cancelled',
  'refunded',
  'failed',
] as const

const MAX_IDS = 20_000

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const params = new URL(request.url).searchParams
  const q = params.get('q')?.trim() ?? ''
  const status = ORDER_STATUSES.includes(params.get('status') as (typeof ORDER_STATUSES)[number])
    ? params.get('status')!
    : ''

  const where: Prisma.StoreOrderWhereInput = {
    workspaceId: user.workspaceId,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { externalOrderId: { contains: q, mode: 'insensitive' } },
            { customerName: { contains: q, mode: 'insensitive' } },
            { customerPhone: { contains: q, mode: 'insensitive' } },
            { customerEmail: { contains: q, mode: 'insensitive' } },
            { trackingCode: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const rows = await prisma.storeOrder.findMany({
    where,
    orderBy: [{ orderDate: 'desc' }, { createdAt: 'desc' }],
    select: { id: true },
    take: MAX_IDS,
  })
  const ids = rows.map((row) => row.id)
  return NextResponse.json({ ids, capped: rows.length === MAX_IDS })
}
