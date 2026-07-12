import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'

/**
 * Workspace-level Instagram entry point. Instagram remains agent-backed, but
 * owners no longer need to hunt through agent settings to reach it.
 */
export default async function InstagramWorkspacePage() {
  const user = await requireUser()
  const agent = await prisma.agent.findFirst({
    where: { workspaceId: user.workspaceId },
    orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  })

  if (!agent) redirect('/agents/new?business=instagram')
  redirect(`/agents/${agent.id}/instagram`)
}
