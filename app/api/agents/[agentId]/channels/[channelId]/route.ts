import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { syncOnboarding } from '@/lib/onboarding'

type Params = { params: { agentId: string; channelId: string } }

export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const channel = await prisma.agentChannel.findFirst({
    where: {
      id: params.channelId,
      agentId: params.agentId,
      agent: { workspaceId: user.workspaceId },
    },
    select: { id: true },
  })
  if (!channel) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  await prisma.agentChannel.delete({ where: { id: channel.id } })
  await syncOnboarding(user.workspaceId)
  return NextResponse.json({ ok: true })
}
