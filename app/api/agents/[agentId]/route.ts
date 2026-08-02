import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { agentUpdateSchema } from '@/lib/validations/agent'
import { syncOnboarding } from '@/lib/onboarding'
import { getPlatformAiConfig } from '@/lib/ai/platform-config'
import { invalidateWidgetConfig } from '@/lib/widget/cache'
import {
  AGENT_MAX_RESPONSE_TOKENS,
  AGENT_RESPONSE_TEMPERATURE,
} from '@/lib/ai/agent-runtime'

type Params = { params: Promise<{ agentId: string }> }

async function getOwnedAgent(workspaceId: string, agentId: string) {
  return prisma.agent.findFirst({ where: { id: agentId, workspaceId } })
}

export async function GET(_req: Request, props: Params) {
  const params = await props.params;
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const agent = await prisma.agent.findFirst({
    where: { id: params.agentId, workspaceId: user.workspaceId },
    include: {
      channels: {
        select: {
          id: true,
          type: true,
          active: true,
          lastInboundAt: true,
          createdAt: true,
        },
      },
      _count: { select: { conversations: true, knowledgeBases: true, catalogItems: true } },
    },
  })
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ agent })
}

export async function PATCH(req: Request, props: Params) {
  const params = await props.params;
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

  if (parsed.data.model) {
    const [workspace, policy] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: user.workspaceId }, select: { plan: true } }),
      getPlatformAiConfig(),
    ])
    const allowed = workspace?.plan === 'TRIAL'
      ? [policy.trialModel]
      : policy.enabledModels
    if (!allowed.includes(parsed.data.model)) {
      return NextResponse.json({ error: 'MODEL_DISABLED' }, { status: 400 })
    }
  }

  // Prisma requires JsonNull (not JS null) when explicitly clearing a nullable
  // JSON column. Convert null/undefined promptConfig to the proper sentinel.
  const data: Record<string, unknown> = { ...parsed.data }
  // Generation controls are platform-managed and deliberately absent from the
  // public form/API contract. Also normalize legacy rows on every edit.
  data.temperature = AGENT_RESPONSE_TEMPERATURE
  data.maxTokens = AGENT_MAX_RESPONSE_TOKENS
  if (data.promptConfig === null) {
    data.promptConfig = Prisma.JsonNull
  }

  const agent = await prisma.agent.update({
    where: { id: params.agentId },
    data: data as Prisma.Args<typeof prisma.agent, 'update'>['data'],
  })
  await invalidateWidgetConfig(agent.id)
  return NextResponse.json({ agent })
}

export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
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
