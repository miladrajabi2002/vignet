import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeChatLinkSettings } from '@/lib/chat-link/config'

type Params = { params: Promise<{ slug: string }> }

// Public Chat Link config — only safe, non-sensitive fields + appearance.
// Consumed by the /c/[slug] client to hydrate after the server render.
export async function GET(_req: Request, props: Params) {
	const params = await props.params
	const link = await prisma.chatLink.findUnique({
		where: { slug: params.slug },
		select: {
			enabled: true,
			settings: true,
			agent: {
				select: {
					id: true,
					name: true,
					avatar: true,
					welcomeMessage: true,
					active: true,
				},
			},
		},
	})
	if (!link || !link.enabled || !link.agent.active) {
		return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
	}

	const settings = normalizeChatLinkSettings(link.settings)
	return NextResponse.json({
		name: settings.displayName ?? link.agent.name,
		avatar: link.agent.avatar,
		welcomeMessage: link.agent.welcomeMessage,
		...settings,
	})
}
