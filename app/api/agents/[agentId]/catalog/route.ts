import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { dispatchProductEmbed } from '@/lib/queue/jobs'

type Params = { params: { agentId: string } }

const bodySchema = z.object({ productIds: z.array(z.string()) })

async function ownAgent(workspaceId: string, agentId: string) {
  return prisma.agent.findFirst({
    where: { id: agentId, workspaceId },
    select: { id: true },
  })
}

export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await ownAgent(user.workspaceId, params.agentId)))
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const links = await prisma.agentCatalog.findMany({
    where: { agentId: params.agentId },
    select: { productId: true },
  })
  return NextResponse.json({ productIds: links.map((l) => l.productId) })
}

// Replace the agent's assigned product set, re-embedding the delta.
export async function PUT(req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await ownAgent(user.workspaceId, params.agentId)))
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success)
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  // Only allow products belonging to this workspace.
  const validProducts = await prisma.product.findMany({
    where: { id: { in: parsed.data.productIds }, workspaceId: user.workspaceId },
    select: { id: true },
  })
  const next = new Set(validProducts.map((p) => p.id))

  const current = new Set(
    (
      await prisma.agentCatalog.findMany({
        where: { agentId: params.agentId },
        select: { productId: true },
      })
    ).map((l) => l.productId),
  )

  const toAdd = [...next].filter((id) => !current.has(id))
  const toRemove = [...current].filter((id) => !next.has(id))

  await prisma.$transaction([
    prisma.agentCatalog.createMany({
      data: toAdd.map((productId) => ({ agentId: params.agentId, productId })),
      skipDuplicates: true,
    }),
    prisma.agentCatalog.deleteMany({
      where: { agentId: params.agentId, productId: { in: toRemove } },
    }),
  ])

  // Embed newly assigned products, remove chunks for unassigned ones.
  for (const productId of toAdd) {
    await dispatchProductEmbed({
      productId,
      workspaceId: user.workspaceId,
      agentIds: [params.agentId],
    })
  }
  for (const productId of toRemove) {
    await dispatchProductEmbed({
      productId,
      workspaceId: user.workspaceId,
      agentIds: [params.agentId],
      deleted: true,
    })
  }

  return NextResponse.json({ ok: true, count: next.size })
}
