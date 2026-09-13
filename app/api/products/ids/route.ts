import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Ids of every product matching the CURRENT list filters — powers the
 * "انتخاب همه N نتیجه" action on the products page. Mirrors the where-builder
 * of the products list page. Capped at 20 000 ids.
 */

const MAX_IDS = 20_000

export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const params = new URL(request.url).searchParams
  const q = params.get('q')?.trim() ?? ''
  const categoryId = params.get('categoryId') ?? ''
  const stock = ['in_stock', 'out_of_stock'].includes(params.get('stock') ?? '')
    ? params.get('stock')!
    : ''

  const where: Prisma.ProductWhereInput = {
    workspaceId: user.workspaceId,
    ...(categoryId ? { categoryId } : {}),
    ...(stock === 'in_stock'
      ? { OR: [{ stock: null }, { stock: { gt: 0 } }] }
      : stock === 'out_of_stock'
        ? { stock: 0 }
        : {}),
    ...(q
      ? {
          AND: [{
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { sku: { contains: q, mode: 'insensitive' } },
            ],
          }],
        }
      : {}),
  }

  const rows = await prisma.product.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: { id: true },
    take: MAX_IDS,
  })
  const ids = rows.map((row) => row.id)
  return NextResponse.json({ ids, capped: rows.length === MAX_IDS })
}
