import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { categoryUpdateSchema } from '@/lib/validations/product'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'

type Params = { params: Promise<{ categoryId: string }> }

export async function PATCH(req: Request, props: Params) {
  const params = await props.params;
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await checkWorkspaceActive(user.workspaceId)).allowed)
    return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })

  const owned = await prisma.productCategory.findFirst({
    where: { id: params.categoryId, workspaceId: user.workspaceId },
    select: { id: true },
  })
  if (!owned) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const json = await req.json().catch(() => null)
  const parsed = categoryUpdateSchema.safeParse(json)
  if (!parsed.success)
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const category = await prisma.productCategory.update({
    where: { id: params.categoryId },
    data: {
      name: parsed.data.name,
      parentId: parsed.data.parentId,
      sortOrder: parsed.data.sortOrder,
    },
  })
  return NextResponse.json({ category })
}

/**
 * `?impact=1`: what deleting this category would touch, so the dialog can say
 * it before anything happens — products left without a category, child
 * categories moved to the top level, and whether a connected store would
 * bring it back on the next sync.
 */
export async function GET(req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const category = await prisma.productCategory.findFirst({
    where: { id: params.categoryId, workspaceId: user.workspaceId },
    select: { id: true, name: true, sourceIntegrationId: true },
  })
  if (!category) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (new URL(req.url).searchParams.get('impact') !== '1') return NextResponse.json({ category })

  const [products, activeProducts, children] = await Promise.all([
    prisma.product.count({ where: { workspaceId: user.workspaceId, categoryId: category.id } }),
    prisma.product.count({ where: { workspaceId: user.workspaceId, categoryId: category.id, active: true } }),
    prisma.productCategory.findMany({
      where: { workspaceId: user.workspaceId, parentId: category.id },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { name: true },
      take: 20,
    }),
  ])
  return NextResponse.json({
    impact: {
      products,
      activeProducts,
      children: children.map((child) => child.name),
      synced: Boolean(category.sourceIntegrationId),
    },
  })
}

/**
 * Delete a category. Its products are detached, or moved into `?moveTo=`
 * (another category of the same workspace); child categories move up to the
 * top level. Products themselves are never deleted.
 */
export async function DELETE(req: Request, props: Params) {
  const params = await props.params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const owned = await prisma.productCategory.findFirst({
    where: { id: params.categoryId, workspaceId: user.workspaceId },
    select: { id: true },
  })
  if (!owned) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const moveTo = new URL(req.url).searchParams.get('moveTo')
  if (moveTo) {
    const target = moveTo === owned.id
      ? null
      : await prisma.productCategory.findFirst({ where: { id: moveTo, workspaceId: user.workspaceId }, select: { id: true } })
    if (!target) return NextResponse.json({ error: 'INVALID_TARGET' }, { status: 400 })
  }

  const [moved] = await prisma.$transaction([
    prisma.product.updateMany({
      where: { workspaceId: user.workspaceId, categoryId: params.categoryId },
      data: { categoryId: moveTo || null },
    }),
    prisma.productCategory.updateMany({
      where: { workspaceId: user.workspaceId, parentId: params.categoryId },
      data: { parentId: null },
    }),
    prisma.productCategory.delete({ where: { id: params.categoryId } }),
  ])
  return NextResponse.json({ ok: true, products: moved.count, movedTo: moveTo || null })
}
