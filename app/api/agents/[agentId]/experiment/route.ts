import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

type Params = { params: { agentId: string } }

async function ownAgent(workspaceId: string, agentId: string) {
  return prisma.agent.findFirst({
    where: { id: agentId, workspaceId },
    select: {
      id: true,
      systemPrompt: true,
      experimentActive: true,
      experimentVariantPrompt: true,
      experimentSplit: true,
    },
  })
}

interface VariantStat {
  variant: string
  total: number
  rated: number
  avgRating: number | null
  handoff: number
}

/** Return experiment config + per-variant outcome comparison. */
export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const agent = await ownAgent(user.workspaceId, params.agentId)
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const grouped = await prisma.conversation.groupBy({
    by: ['variant'],
    where: { agentId: agent.id },
    _count: { _all: true },
    _avg: { rating: true },
  })

  const handoffGrouped = await prisma.conversation.groupBy({
    by: ['variant'],
    where: { agentId: agent.id, status: 'HANDED_OFF' },
    _count: { _all: true },
  })
  const ratedGrouped = await prisma.conversation.groupBy({
    by: ['variant'],
    where: { agentId: agent.id, rating: { not: null } },
    _count: { _all: true },
  })

  const handoffByVariant = new Map(
    handoffGrouped.map((g) => [g.variant ?? 'A', g._count._all]),
  )
  const ratedByVariant = new Map(
    ratedGrouped.map((g) => [g.variant ?? 'A', g._count._all]),
  )

  const stats: VariantStat[] = ['A', 'B'].map((v) => {
    const row = grouped.find((g) => (g.variant ?? 'A') === v)
    return {
      variant: v,
      total: row?._count._all ?? 0,
      rated: ratedByVariant.get(v) ?? 0,
      avgRating: row?._avg.rating ?? null,
      handoff: handoffByVariant.get(v) ?? 0,
    }
  })

  return NextResponse.json({
    config: {
      active: agent.experimentActive,
      variantPrompt: agent.experimentVariantPrompt ?? '',
      split: agent.experimentSplit,
      basePrompt: agent.systemPrompt,
    },
    stats,
  })
}

const updateSchema = z.object({
  active: z.boolean().optional(),
  variantPrompt: z.string().max(8000).optional(),
  split: z.number().int().min(1).max(99).optional(),
})

/** Update the A/B experiment config. */
export async function PUT(req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await ownAgent(user.workspaceId, params.agentId)))
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const json = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  // Can't activate an experiment with no variant prompt.
  if (parsed.data.active && parsed.data.variantPrompt !== undefined && !parsed.data.variantPrompt.trim()) {
    return NextResponse.json({ error: 'EMPTY_VARIANT' }, { status: 400 })
  }

  await prisma.agent.update({
    where: { id: params.agentId },
    data: {
      ...(parsed.data.active !== undefined ? { experimentActive: parsed.data.active } : {}),
      ...(parsed.data.variantPrompt !== undefined
        ? { experimentVariantPrompt: parsed.data.variantPrompt.trim() || null }
        : {}),
      ...(parsed.data.split !== undefined ? { experimentSplit: parsed.data.split } : {}),
    },
  })

  return NextResponse.json({ ok: true })
}
