import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { agentUpdateSchema } from '@/lib/validations/agent'
import { syncOnboarding } from '@/lib/onboarding'

type Params = { params: { agentId: string } }

async function getOwnedAgent(workspaceId: string, agentId: string) {
  return prisma.agent.findFirst({ where: { id: agentId, workspaceId } })
}

export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    include: {
      channels: true,
      _count: { select: { conversations: true, knowledgeBases: true, catalogItems: true } },
    },
  })
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ agent })
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const existing = await getOwnedAgent(user.workspaceId, params.agentId)
  if (!existing) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const json = await req.json().catch(() => null)
  const parsed = agentUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  // Prisma requires JsonNull (not JS null) when explicitly clearing a nullable
  // JSON column. Convert null/undefined promptConfig to the proper sentinel.
  const data: Record<string, unknown> = { ...parsed.data }
  if (data.promptConfig === null) {
    data.promptConfig = Prisma.JsonNull
  }

  const agent = await prisma.agent.update({
    where: { id: params.agentId },
    data: data as Prisma.Args<typeof prisma.agent, 'update'>['data'],
  })
  return NextResponse.json({ agent })
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const existing = await getOwnedAgent(user.workspaceId, params.agentId)
  if (!existing) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  // Clean up dependent rows that don't cascade in the schema.
  await prisma.$transaction([
    prisma.message.deleteMany({
      where: { conversation: { agentId: params.agentId } },
    }),
    prisma.conversation.deleteMany({ where: { agentId: params.agentId } }),
    prisma.knowledgeChunk.deleteMany({ where: { agentId: params.agentId } }),
    prisma.agentChannel.deleteMany({ where: { agentId: params.agentId } }),
    prisma.knowledgeBase.deleteMany({ where: { agentId: params.agentId } }),
    prisma.agent.delete({ where: { id: params.agentId } }),
  ])

  await syncOnboarding(user.workspaceId)
  return NextResponse.json({ ok: true })
}
