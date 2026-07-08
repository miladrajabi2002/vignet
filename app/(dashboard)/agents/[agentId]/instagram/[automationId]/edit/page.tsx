import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { AutomationForm } from '@/components/instagram/automation-form'
import {
	type Automation,
	type AutomationTrigger,
	type AutomationAction,
} from '@/components/instagram/types'

export const dynamic = 'force-dynamic'

/**
 * Full-page edit form for a single Instagram automation scenario.
 *
 * Loads the automation row by id (verifying workspace ownership via the
 * agent relation), then renders `<AutomationForm mode="edit" />` with the
 * row prefilled.
 */
export default async function EditAutomationPage(
	props: {
		params: Promise<{ agentId: string; automationId: string }>
	},
) {
	const params = await props.params
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

	// Load the automation row — must belong to this agent's IG channel.
	const row = await prisma.instagramAutomation.findFirst({
		where: {
			id: params.automationId,
			agentId: agent.id,
			channelId: igChannel.id,
		},
	})
	if (!row) notFound()

	const cfg = (igChannel.config ?? {}) as {
		botUsername?: string
		igProfilePictureUrl?: string
	}
	const accountUsername = cfg.botUsername ?? 'vigent.bot'
	const accountAvatarUrl = cfg.igProfilePictureUrl || undefined

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
			accountUsername={accountUsername}
			accountAvatarUrl={accountAvatarUrl}
			type={automation.type}
			mode="edit"
			initial={automation}
		/>
	)
}
