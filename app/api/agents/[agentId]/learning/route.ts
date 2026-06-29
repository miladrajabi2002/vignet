import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type Params = { params: { agentId: string } }

async function ownAgent(workspaceId: string, agentId: string) {
  return prisma.agent.findFirst({
    where: { id: agentId, workspaceId },
    select: { id: true },
  })
}

/** List unanswered questions awaiting the operator's review (newest first). */
export async function GET(_req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await ownAgent(user.workspaceId, params.agentId)))
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const rows = await prisma.message.findMany({
    where: {
      role: 'ASSISTANT',
      unanswered: true,
      conversation: { agentId: params.agentId, workspaceId: user.workspaceId },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, metadata: true, createdAt: true, conversationId: true },
  })

  const items = rows
    .map((m) => {
      const meta = m.metadata as Record<string, unknown> | null
      const question = meta && typeof meta.question === 'string' ? meta.question : ''
      return {
        id: m.id,
        question,
        conversationId: m.conversationId,
        createdAt: m.createdAt,
      }
    })
    .filter((m) => m.question.length > 0)

  return NextResponse.json({ items })
}

const dismissSchema = z.object({ messageId: z.string().min(1) })

/** Dismiss an unanswered question without learning from it. */
export async function DELETE(req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!(await ownAgent(user.workspaceId, params.agentId)))
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const json = await req.json().catch(() => null)
  const parsed = dismissSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  await prisma.message.updateMany({
    where: {
      id: parsed.data.messageId,
      unanswered: true,
      conversation: { agentId: params.agentId, workspaceId: user.workspaceId },
    },
    data: { unanswered: false },
  })

  return NextResponse.json({ ok: true })
}
