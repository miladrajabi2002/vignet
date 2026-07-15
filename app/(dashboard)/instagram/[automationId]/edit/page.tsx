import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { AutomationForm } from '@/components/instagram/automation-form'
import {
  type Automation,
  type AutomationAction,
  type AutomationTrigger,
} from '@/components/instagram/types'

export const dynamic = 'force-dynamic'

export default async function EditInstagramAutomationPage({
  params,
  searchParams,
}: {
  params: Promise<{ automationId: string }>
  searchParams: Promise<{ agentId?: string }>
}) {
  const [{ automationId }, query] = await Promise.all([params, searchParams])
  const user = await requireUser()
  const row = await prisma.instagramAutomation.findFirst({
    where: {
      id: automationId,
      ...(query.agentId ? { agentId: query.agentId } : {}),
      agent: { workspaceId: user.workspaceId },
    },
  })
  if (!row) notFound()

  const agent = await prisma.agent.findFirst({
    where: { id: row.agentId, workspaceId: user.workspaceId },
    select: {
      id: true,
      channels: {
        where: { type: 'INSTAGRAM', id: row.channelId },
        select: { id: true, config: true },
      },
    },
  })
  if (!agent) notFound()

  const igChannel = agent.channels[0]
  if (!igChannel) redirect('/instagram')

  const config = (igChannel.config ?? {}) as {
    botUsername?: string
    igProfilePictureUrl?: string
  }
  const automation: Automation = {
    id: row.id,
    agentId: row.agentId,
    channelId: row.channelId,
    type: row.type,
    name: row.name,
    active: row.active,
    priority: row.priority,
    trigger: row.trigger as unknown as AutomationTrigger,
    action: row.action as unknown as AutomationAction,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }

  return (
    <AutomationForm
      agentId={agent.id}
      channelId={igChannel.id}
      accountUsername={config.botUsername ?? 'vigent.bot'}
      accountAvatarUrl={config.igProfilePictureUrl || undefined}
      type={automation.type}
      mode="edit"
      initial={automation}
    />
  )
}
