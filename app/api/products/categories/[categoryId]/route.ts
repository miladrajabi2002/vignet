import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { categoryUpdateSchema } from '@/lib/validations/product'

type Params = { params: { categoryId: string } }

export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

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

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const owned = await prisma.productCategory.findFirst({
    where: { id: params.categoryId, workspaceId: user.workspaceId },
    select: { id: true },
  })
  if (!owned) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  // Detach products and child categories, then delete.
  await prisma.$transaction([
    prisma.product.updateMany({
      where: { categoryId: params.categoryId },
      data: { categoryId: null },
    }),
    prisma.productCategory.updateMany({
      where: { parentId: params.categoryId },
      data: { parentId: null },
    }),
    prisma.productCategory.delete({ where: { id: params.categoryId } }),
  ])
  return NextResponse.json({ ok: true })
}
