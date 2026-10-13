import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
	chatLinkOpenState,
	normalizeChatLinkSettings,
	normalizeSourceKey,
} from '@/lib/chat-link/config'
import { loadChatLinkShowcase } from '@/lib/chat-link/showcase'
import { recordChatLinkView } from '@/lib/chat-link/stats'
import { ChatLinkClient } from './chat-client'
import { ChatLinkUnavailable } from './unavailable'
import { resolveCustomerIdentificationPolicy } from '@/lib/customer-identification-policy'

// Always fresh: the owner may toggle/link-edit at any moment, and we count views.
export const dynamic = 'force-dynamic'

type Props = {
	params: Promise<{ slug: string }>
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

async function loadLink(slug: string) {
	return prisma.chatLink.findUnique({
		where: { slug },
		select: {
			id: true,
			enabled: true,
			settings: true,
			agent: {
				select: {
					id: true,
					name: true,
					avatar: true,
					welcomeMessage: true,
					active: true,
					requireCustomerInfo: true,
					customerInfoPrompt: true,
					productAccessEnabled: true,
				},
			},
		},
	})
}

export async function generateMetadata(props: Props): Promise<Metadata> {
	const { slug } = await props.params
	const link = await loadLink(slug)
	if (!link) return { title: 'گفتگو', robots: { index: false } }
	const s = normalizeChatLinkSettings(link.settings)
	const name = s.displayName ?? link.agent.name
	if (!link.enabled || !link.agent.active) return { title: name, robots: { index: false } }

	// The card a messenger shows when the link is pasted into a chat.
	const title = s.shareTitle ?? `گفتگو با ${name}`
	const description = s.shareDescription ?? s.tagline ?? `مشاوره آنلاین فوری — همین حالا با ${name} گفتگو کنید.`
	const image = s.coverUrl ?? s.logoUrl
	return {
		title,
		description,
		openGraph: {
			title,
			description,
			...(image ? { images: [{ url: image }] } : {}),
		},
		twitter: { card: s.coverUrl ? 'summary_large_image' : 'summary', title, description },
	}
}

export default async function ChatLinkPage(props: Props) {
	const { slug } = await props.params
	const link = await loadLink(slug)
	if (!link) notFound()

	const base = normalizeChatLinkSettings(link.settings)
	const name = base.displayName ?? link.agent.name

	// A paused link (or a switched-off agent) still answers with the business's
	// own page, so its customers never land on a generic 404.
	if (!link.enabled || !link.agent.active) {
		return <ChatLinkUnavailable name={name} avatar={base.logoUrl ?? link.agent.avatar} settings={base} />
	}

	const searchParams = await props.searchParams
	const source = normalizeSourceKey(typeof searchParams.src === 'string' ? searchParams.src : null)
	// Lightweight funnel signal for the dashboard; never block the page on it.
	recordChatLinkView(link.id, source)

	const settings = resolveCustomerIdentificationPolicy(base, link.agent)
	const showcase = settings.showcase && link.agent.productAccessEnabled
		? await loadChatLinkShowcase(link.agent.id).catch(() => [])
		: []

	return (
		<ChatLinkClient
			slug={slug}
			name={name}
			avatar={settings.logoUrl ?? link.agent.avatar}
			welcomeMessage={settings.welcomeMessage ?? link.agent.welcomeMessage}
			settings={settings}
			showcase={showcase}
			hours={chatLinkOpenState(settings, new Date())}
			source={source}
		/>
	)
}
