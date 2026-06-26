import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { productCreateSchema } from '@/lib/validations/product'
import { syncOnboarding } from '@/lib/onboarding'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const categoryId = searchParams.get('categoryId') ?? undefined
  const sort = searchParams.get('sort') ?? 'newest'

  const orderBy =
    sort === 'price_asc'
      ? { price: 'asc' as const }
      : sort === 'price_desc'
        ? { price: 'desc' as const }
        : sort === 'queried'
          ? { queryCount: 'desc' as const }
          : { createdAt: 'desc' as const }

  const products = await prisma.product.findMany({
    where: {
      workspaceId: user.workspaceId,
      categoryId,
      ...(q
        ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }] }
        : {}),
    },
    orderBy,
    include: { category: { select: { name: true } } },
  })

  return NextResponse.json({ products })
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const json = await req.json().catch(() => null)
  const parsed = productCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const d = parsed.data

  const product = await prisma.product.create({
    data: {
      workspaceId: user.workspaceId,
      name: d.name,
      description: d.description,
      price: d.price ?? null,
      comparePrice: d.comparePrice ?? null,
      sku: d.sku,
      stock: d.stock ?? null,
      categoryId: d.categoryId ?? null,
      images: d.images ?? [],
      attributes: d.attributes,
      tags: d.tags ?? [],
      active: d.active ?? true,
    },
  })

  await syncOnboarding(user.workspaceId)
  return NextResponse.json({ product }, { status: 201 })
}
