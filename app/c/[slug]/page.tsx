import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { normalizeChatLinkSettings } from '@/lib/chat-link/config'
import { ChatLinkClient } from './chat-client'
import { resolveCustomerIdentificationPolicy } from '@/lib/customer-identification-policy'

// Always fresh: the owner may toggle/link-edit at any moment, and we count views.
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

async function loadLink(slug: string) {
	return prisma.chatLink.findUnique({
		where: { slug },
		select: {
			id: true,
			enabled: true,
			settings: true,
			agent: {
				select: {
					name: true,
					avatar: true,
					welcomeMessage: true,
					active: true,
					requireCustomerInfo: true,
					customerInfoPrompt: true,
				},
			},
		},
	})
}

export async function generateMetadata(props: Props): Promise<Metadata> {
	const { slug } = await props.params
	const link = await loadLink(slug)
	if (!link || !link.enabled || !link.agent.active) return { title: 'گفتگو' }
	const s = normalizeChatLinkSettings(link.settings)
	const name = s.displayName ?? link.agent.name
	return {
		title: `گفتگو با ${name}`,
		description: s.tagline ?? `مشاوره آنلاین فوری — همین حالا با ${name} گفتگو کنید.`,
		openGraph: {
			title: `گفتگو با ${name}`,
			description: s.tagline ?? 'مشاوره آنلاین فوری با هوش مصنوعی',
		},
	}
}

export default async function ChatLinkPage(props: Props) {
	const { slug } = await props.params
	const link = await loadLink(slug)
	if (!link || !link.enabled || !link.agent.active) notFound()

	// Lightweight funnel signal for the dashboard; never block the page on it.
	prisma.chatLink
		.update({ where: { id: link.id }, data: { views: { increment: 1 } } })
		.catch(() => {})

	const settings = resolveCustomerIdentificationPolicy(
		normalizeChatLinkSettings(link.settings),
		link.agent,
	)

	return (
		<ChatLinkClient
			slug={slug}
			name={settings.displayName ?? link.agent.name}
			avatar={link.agent.avatar}
			welcomeMessage={link.agent.welcomeMessage}
			settings={settings}
		/>
	)
}
