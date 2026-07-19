import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { syncOnboarding } from '@/lib/onboarding'
import { BUCKETS, deleteFile } from '@/lib/storage'
import { hasWorkspacePermission } from '@/lib/workspace-permissions'

type Params = { params: Promise<{ agentId: string; kbId: string }> }

export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!hasWorkspacePermission(user.role, 'agents:manage')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const kb = await prisma.knowledgeBase.findFirst({
    where: {
      id: params.kbId,
      agentId: params.agentId,
      workspaceId: user.workspaceId,
    },
    select: { id: true, fileKey: true },
  })
  if (!kb) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  // chunks cascade on KB delete (onDelete: Cascade in schema).
  await prisma.knowledgeBase.delete({ where: { id: kb.id } })
  if (kb.fileKey) {
    await deleteFile(BUCKETS.knowledge, kb.fileKey).catch((error) => {
      console.error('[knowledge] failed to delete storage object:', error)
    })
  }
  await syncOnboarding(user.workspaceId)

  return NextResponse.json({ ok: true })
}
