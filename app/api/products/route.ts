import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { productCreateSchema } from '@/lib/validations/product'
import { syncOnboarding } from '@/lib/onboarding'
import {
  assertWorkspaceResourceCapacity,
  checkWorkspaceActive,
  checkWorkspaceResourceCreateAllowed,
  WorkspaceResourceLimitError,
} from '@/lib/billing/entitlements'
import { dispatchProductEmbed } from '@/lib/queue/jobs'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const categoryId = searchParams.get('categoryId') ?? undefined
  const stock = searchParams.get('stock')
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
      ...(stock === 'in_stock'
        ? { OR: [{ stock: null }, { stock: { gt: 0 } }] }
        : stock === 'out_of_stock'
          ? { stock: 0 }
          : {}),
      ...(q
        ? { AND: [{ OR: [{ name: { contains: q, mode: 'insensitive' } }, { sku: { contains: q, mode: 'insensitive' } }] }] }
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
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed) {
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
  }

  const json = await req.json().catch(() => null)
  const parsed = productCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const d = parsed.data

  const capacity = await checkWorkspaceResourceCreateAllowed(user.workspaceId, 'products')
  if (!capacity.allowed) {
    return NextResponse.json(
      { error: capacity.reason, limit: capacity.limit, used: capacity.used },
      { status: 409 },
    )
  }

  const product = await prisma.$transaction(async (tx) => {
    await assertWorkspaceResourceCapacity(tx, user.workspaceId, 'products', capacity.limit)
    return tx.product.create({
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
        externalUrl: d.externalUrl ?? null,
        active: d.active ?? true,
      },
    })
  }).catch((error: unknown) => {
    if (error instanceof WorkspaceResourceLimitError) return null
    throw error
  })

  if (!product) {
    return NextResponse.json(
      { error: 'PRODUCT_LIMIT', limit: capacity.limit, used: capacity.limit },
      { status: 409 },
    )
  }

  // Auto-assign the new product to every agent in the workspace so catalog
  // injection stays in sync without manual visits to the catalog page.
  if (product.active) {
    const agents = await prisma.agent.findMany({
      where: { workspaceId: user.workspaceId },
      select: { id: true },
    })
    if (agents.length > 0) {
      await Promise.all([
        prisma.agentCatalog.createMany({
          data: agents.map((a) => ({ agentId: a.id, productId: product.id })),
          skipDuplicates: true,
        }),
        prisma.agent.updateMany({
          where: { workspaceId: user.workspaceId, productAccessConfigured: false },
          data: { productAccessEnabled: true },
        }),
      ])
    }

    // Product search is semantic as well as lexical. New dashboard products
    // must be embedded immediately, just like WooCommerce imports and edits;
    // otherwise natural requests can miss them until the first manual edit.
    await dispatchProductEmbed({
      productId: product.id,
      workspaceId: user.workspaceId,
      agentIds: agents.map((agent) => agent.id),
    })
  }

  await syncOnboarding(user.workspaceId)
  return NextResponse.json({ product }, { status: 201 })
}
