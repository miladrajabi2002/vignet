import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { syncOnboarding } from '@/lib/onboarding'

type Params = { params: { agentId: string; kbId: string } }

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const kb = await prisma.knowledgeBase.findFirst({
    where: {
      id: params.kbId,
      agentId: params.agentId,
      workspaceId: user.workspaceId,
    },
    select: { id: true },
  })
  if (!kb) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  // chunks cascade on KB delete (onDelete: Cascade in schema).
  await prisma.knowledgeBase.delete({ where: { id: kb.id } })
  await syncOnboarding(user.workspaceId)

  return NextResponse.json({ ok: true })
}
