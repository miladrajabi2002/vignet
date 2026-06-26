import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { categoryCreateSchema, slugify } from '@/lib/validations/product'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const categories = await prisma.productCategory.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { _count: { select: { products: true } } },
  })
  return NextResponse.json({ categories })
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const json = await req.json().catch(() => null)
  const parsed = categoryCreateSchema.safeParse(json)
  if (!parsed.success)
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  let slug = slugify(parsed.data.name)
  const exists = await prisma.productCategory.findFirst({
    where: { workspaceId: user.workspaceId, slug },
    select: { id: true },
  })
  if (exists) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`

  const category = await prisma.productCategory.create({
    data: {
      workspaceId: user.workspaceId,
      name: parsed.data.name,
      slug,
      parentId: parsed.data.parentId ?? null,
      sortOrder: parsed.data.sortOrder ?? 0,
    },
  })
  return NextResponse.json({ category }, { status: 201 })
}
