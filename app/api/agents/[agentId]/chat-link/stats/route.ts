import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { normalizeChatLinkSettings } from '@/lib/chat-link/config'
import { loadChatLinkStats } from '@/lib/chat-link/stats'

type Params = { params: Promise<{ agentId: string }> }

/** Funnel + per-source numbers for the chat link editor's «آمار» tab. */
export async function GET(_req: Request, props: Params) {
	const params = await props.params
	const user = await getCurrentUser()
	if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

	const link = await prisma.chatLink.findFirst({
		where: { agentId: params.agentId, workspaceId: user.workspaceId },
		select: { id: true, agentId: true, views: true, settings: true },
	})
	if (!link) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

	const stats = await loadChatLinkStats({
		id: link.id,
		agentId: link.agentId,
		views: link.views,
		sources: normalizeChatLinkSettings(link.settings).sources,
	})
	return NextResponse.json({ stats })
}
