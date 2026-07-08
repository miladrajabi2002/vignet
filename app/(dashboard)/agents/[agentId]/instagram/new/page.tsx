import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { AutomationForm } from '@/components/instagram/automation-form'
import { type AutomationType } from '@/components/instagram/types'

export const dynamic = 'force-dynamic'

/**
 * Full-page create form for an Instagram automation scenario.
 *
 * Reads `searchParams.type` (DIRECT_MESSAGE | COMMENT | STORY) and renders
 * the client `<AutomationForm mode="create" />` with the matching type.
 */
export default async function NewAutomationPage(
        props: {
                params: Promise<{ agentId: string }>
                searchParams: Promise<{ type?: string }>
        },
) {
        const params = await props.params
        const searchParams = await props.searchParams
        const user = await requireUser()

        const agent = await prisma.agent.findFirst({
                where: { id: params.agentId, workspaceId: user.workspaceId },
                select: {
                        id: true,
                        name: true,
                        channels: {
                                where: { type: 'INSTAGRAM' },
                                select: { id: true, config: true },
                        },
                },
        })
        if (!agent) notFound()

        const igChannel = agent.channels[0]
        if (!igChannel) redirect(`/agents/${agent.id}/instagram`)

        const rawType = (searchParams.type ?? '').toUpperCase()
        const validTypes: AutomationType[] = ['DIRECT_MESSAGE', 'COMMENT', 'STORY']
        if (!validTypes.includes(rawType as AutomationType)) {
                // Default to DM when the type is missing/invalid.
                redirect(`/agents/${agent.id}/instagram/new?type=DIRECT_MESSAGE`)
        }
        const type = rawType as AutomationType

        const cfg = (igChannel.config ?? {}) as {
                botUsername?: string
                igProfilePictureUrl?: string
        }
        const accountUsername = cfg.botUsername ?? 'vigent.bot'
        const accountAvatarUrl = cfg.igProfilePictureUrl || undefined

        return (
                <AutomationForm
                        agentId={agent.id}
                        channelId={igChannel.id}
                        accountUsername={accountUsername}
                        accountAvatarUrl={accountAvatarUrl}
                        type={type}
                        mode="create"
                />
        )
}
