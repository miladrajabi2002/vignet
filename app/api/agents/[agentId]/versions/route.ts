import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
  AGENT_MAX_RESPONSE_TOKENS,
  AGENT_RESPONSE_TEMPERATURE,
} from '@/lib/ai/agent-runtime'

type Params = { params: Promise<{ agentId: string }> }

async function ownAgent(workspaceId: string, agentId: string) {
  return prisma.agent.findFirst({
    where: { id: agentId, workspaceId },
    select: {
      id: true,
      systemPrompt: true,
      promptConfig: true,
      roleTemplate: true,
      model: true,
      language: true,
    },
  })
}

/** List saved versions (newest first). */
export async function GET(_req: Request, props: Params) {
  const params = await props.params;
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await ownAgent(user.workspaceId, params.agentId)))
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const items = await prisma.agentVersion.findMany({
    where: { agentId: params.agentId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      label: true,
      note: true,
      promptConfig: true,
      roleTemplate: true,
      model: true,
      createdAt: true,
    },
  })
  return NextResponse.json({ items })
}

const saveSchema = z.object({ note: z.string().max(200).optional() })

/** Snapshot the agent's current prompt/config as a new version. */
export async function POST(req: Request, props: Params) {
  const params = await props.params;
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const agent = await ownAgent(user.workspaceId, params.agentId)
  if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const json = await req.json().catch(() => ({}))
  const parsed = saveSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const count = await prisma.agentVersion.count({ where: { agentId: agent.id } })
  const version = await prisma.agentVersion.create({
    data: {
      agentId: agent.id,
      label: `${agent.language === 'en' ? 'Version' : 'نسخه'} ${count + 1}`,
      systemPrompt: agent.systemPrompt,
      promptConfig: agent.promptConfig === null ? Prisma.JsonNull : agent.promptConfig,
      roleTemplate: agent.roleTemplate,
      model: agent.model,
      temperature: AGENT_RESPONSE_TEMPERATURE,
      maxTokens: AGENT_MAX_RESPONSE_TOKENS,
      note: parsed.data.note ?? null,
    },
    select: { id: true, label: true, createdAt: true },
  })

  return NextResponse.json({ version }, { status: 201 })
}
