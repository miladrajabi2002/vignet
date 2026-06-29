import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

type Params = { params: { agentId: string; versionId: string } }

async function ownAgent(workspaceId: string, agentId: string) {
  return prisma.agent.findFirst({
    where: { id: agentId, workspaceId },
    select: { id: true },
  })
}

/** Restore a saved version onto the agent (applies its prompt/config). */
export async function POST(_req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await ownAgent(user.workspaceId, params.agentId)))
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const version = await prisma.agentVersion.findFirst({
    where: { id: params.versionId, agentId: params.agentId },
    select: { systemPrompt: true, model: true, temperature: true, maxTokens: true },
  })
  if (!version) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  await prisma.agent.update({
    where: { id: params.agentId },
    data: {
      systemPrompt: version.systemPrompt,
      model: version.model,
      temperature: version.temperature,
      maxTokens: version.maxTokens,
    },
  })

  return NextResponse.json({ ok: true })
}

/** Delete a saved version. */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await ownAgent(user.workspaceId, params.agentId)))
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  await prisma.agentVersion.deleteMany({
    where: { id: params.versionId, agentId: params.agentId },
  })

  return NextResponse.json({ ok: true })
}
