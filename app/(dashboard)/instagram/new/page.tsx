import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { AutomationForm } from '@/components/instagram/automation-form'
import { type AutomationType } from '@/components/instagram/types'

export const dynamic = 'force-dynamic'

export default async function NewInstagramAutomationPage({
  searchParams,
}: {
  searchParams: Promise<{ agentId?: string; type?: string }>
}) {
  const query = await searchParams
  const user = await requireUser()
  const agent = await prisma.agent.findFirst({
    where: {
      workspaceId: user.workspaceId,
      ...(query.agentId ? { id: query.agentId } : {}),
      channels: { some: { type: 'INSTAGRAM' } },
    },
    orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      channels: {
        where: { type: 'INSTAGRAM' },
        select: { id: true, config: true },
      },
    },
  })
  if (!agent) notFound()

  const igChannel = agent.channels[0]
  if (!igChannel) redirect('/instagram')

  const rawType = (query.type ?? '').toUpperCase()
  const validTypes: AutomationType[] = ['DIRECT_MESSAGE', 'COMMENT', 'STORY']
  if (!validTypes.includes(rawType as AutomationType)) {
    redirect(`/instagram/new?agentId=${agent.id}&type=DIRECT_MESSAGE`)
  }

  const config = (igChannel.config ?? {}) as {
    botUsername?: string
    igProfilePictureUrl?: string
  }

  return (
    <AutomationForm
      agentId={agent.id}
      channelId={igChannel.id}
      accountUsername={config.botUsername ?? 'vigent.bot'}
      accountAvatarUrl={config.igProfilePictureUrl || undefined}
      type={rawType as AutomationType}
      mode="create"
    />
  )
}
