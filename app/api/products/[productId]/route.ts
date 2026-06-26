import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { productUpdateSchema } from '@/lib/validations/product'
import { dispatchProductEmbed } from '@/lib/queue/jobs'

type Params = { params: { productId: string } }

async function ownProduct(workspaceId: string, productId: string) {
  return prisma.product.findFirst({
    where: { id: productId, workspaceId },
    select: { id: true },
  })
}

export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const product = await prisma.product.findFirst({
    where: { id: params.productId, workspaceId: user.workspaceId },
    include: {
      category: { select: { id: true, name: true } },
      catalogItems: { select: { agentId: true } },
    },
  })
  if (!product) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ product })
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await ownProduct(user.workspaceId, params.productId)))
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const json = await req.json().catch(() => null)
  const parsed = productUpdateSchema.safeParse(json)
  if (!parsed.success)
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const product = await prisma.product.update({
    where: { id: params.productId },
    data: parsed.data,
  })

  // Re-embed for every agent that knows about this product.
  await dispatchProductEmbed({
    productId: product.id,
    workspaceId: user.workspaceId,
  })

  return NextResponse.json({ product })
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await ownProduct(user.workspaceId, params.productId)))
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  // Capture assigned agents before the catalog rows cascade away.
  const links = await prisma.agentCatalog.findMany({
    where: { productId: params.productId },
    select: { agentId: true },
  })
  const agentIds = links.map((l) => l.agentId)

  await prisma.product.delete({ where: { id: params.productId } })

  await dispatchProductEmbed({
    productId: params.productId,
    workspaceId: user.workspaceId,
    agentIds,
    deleted: true,
  })

  return NextResponse.json({ ok: true })
}
