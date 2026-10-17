import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'

/**
 * Compatibility destination for notifications created before channel alerts
 * started linking to a specific agent. Keeping this route prevents old alerts
 * and saved links from landing on the global 404 page.
 */
export default async function LegacyChannelsPage() {
  const user = await requireUser()
  const [unhealthyAgent, firstAgent] = await Promise.all([
    prisma.agent.findFirst({
      where: {
        workspaceId: user.workspaceId,
        channels: { some: { type: { in: ['TELEGRAM', 'BALE', 'RUBIKA', 'INSTAGRAM'] }, healthStatus: 'down' } },
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    }),
    prisma.agent.findFirst({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }),
  ])
  const agent = unhealthyAgent ?? firstAgent

  redirect(agent ? `/agents/${agent.id}/channels` : '/agents')
}
