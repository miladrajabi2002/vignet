import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { invalidateWidgetConfig } from '@/lib/widget/cache'
import {
  AGENT_MAX_RESPONSE_TOKENS,
  AGENT_RESPONSE_TEMPERATURE,
} from '@/lib/ai/agent-runtime'

type Params = { params: Promise<{ agentId: string; versionId: string }> }

async function ownAgent(workspaceId: string, agentId: string) {
  return prisma.agent.findFirst({
    where: { id: agentId, workspaceId },
    select: { id: true },
  })
}

/** Restore a saved version onto the agent (applies its prompt/config). */
export async function POST(_req: Request, props: Params) {
  const params = await props.params;
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await ownAgent(user.workspaceId, params.agentId)))
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const version = await prisma.agentVersion.findFirst({
    where: { id: params.versionId, agentId: params.agentId },
    select: {
      systemPrompt: true,
      promptConfig: true,
      roleTemplate: true,
      model: true,
    },
  })
  if (!version) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  await prisma.agent.update({
    where: { id: params.agentId },
    data: {
      systemPrompt: version.systemPrompt,
      promptConfig: version.promptConfig === null ? Prisma.JsonNull : version.promptConfig,
      roleTemplate: version.roleTemplate,
      model: version.model,
      temperature: AGENT_RESPONSE_TEMPERATURE,
      maxTokens: AGENT_MAX_RESPONSE_TOKENS,
    },
  })
  await invalidateWidgetConfig(params.agentId)

  return NextResponse.json({ ok: true })
}

/** Delete a saved version. */
export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await ownAgent(user.workspaceId, params.agentId)))
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  await prisma.agentVersion.deleteMany({
    where: { id: params.versionId, agentId: params.agentId },
  })

  return NextResponse.json({ ok: true })
}
