import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { ChatLinkSource } from '@/lib/chat-link/config'

/**
 * Chat link funnel: page opens → conversations → contacts with a phone →
 * orders, plus the same split per tracking source (`?src=`).
 *
 * Opens per source live in ChatLinkDailyStat; a conversation remembers the
 * source it started from in `metadata.src`. Both are read with raw SQL: the
 * counter is one atomic upsert and the split is a GROUP BY on a JSON key.
 */

export interface ChatLinkSourceStat {
	key: string
	label: string
	views: number
	conversations: number
	leads: number
}

export interface ChatLinkStats {
	views: number
	conversations: number
	leads: number
	orders: number
	/** '' (the plain link) first, then the owner's tracking links. */
	sources: ChatLinkSourceStat[]
}

/** Count one page open. Never blocks or fails the page. */
export function recordChatLinkView(chatLinkId: string, source: string | null): void {
	const key = source ?? ''
	Promise.all([
		prisma.chatLink.update({ where: { id: chatLinkId }, data: { views: { increment: 1 } } }),
		prisma.$executeRaw`
			INSERT INTO "ChatLinkDailyStat" ("chatLinkId", "day", "source", "views")
			VALUES (${chatLinkId}, (now() AT TIME ZONE 'Asia/Tehran')::date, ${key}, 1)
			ON CONFLICT ("chatLinkId", "day", "source")
			DO UPDATE SET "views" = "ChatLinkDailyStat"."views" + 1`,
	]).catch(() => {})
}

/** Remember which tracking link a new conversation came from. */
export function tagConversationSource(conversationId: string, source: string): void {
	prisma.$executeRaw`
		UPDATE "Conversation"
		SET "metadata" = COALESCE("metadata", '{}'::jsonb) || jsonb_build_object('src', ${source}::text)
		WHERE "id" = ${conversationId}`.catch(() => {})
}

export async function loadChatLinkStats(link: {
	id: string
	agentId: string
	views: number
	sources: ChatLinkSource[]
}): Promise<ChatLinkStats> {
	const chat = { agentId: link.agentId, channel: 'CHAT_LINK' as const }
	const [conversations, leads, orders, viewRows, conversationRows] = await Promise.all([
		prisma.conversation.count({ where: chat }),
		prisma.conversation.count({ where: { ...chat, contact: { phone: { not: null } } } }),
		prisma.orderDraft.count({ where: { ...chat, submittedAt: { not: null } } }),
		prisma.$queryRaw<{ source: string; views: number }[]>(Prisma.sql`
			SELECT "source", SUM("views")::int AS "views"
			FROM "ChatLinkDailyStat"
			WHERE "chatLinkId" = ${link.id}
			GROUP BY "source"`).catch(() => []),
		prisma.$queryRaw<{ source: string; conversations: number; leads: number }[]>(Prisma.sql`
			SELECT c."metadata"->>'src' AS "source",
				COUNT(*)::int AS "conversations",
				COUNT(*) FILTER (WHERE k."phone" IS NOT NULL)::int AS "leads"
			FROM "Conversation" c
			LEFT JOIN "Contact" k ON k."id" = c."contactId"
			WHERE c."agentId" = ${link.agentId}
				AND c."channel" = 'CHAT_LINK'::"ChannelType"
				AND c."deletedAt" IS NULL
				AND c."metadata"->>'src' IS NOT NULL
			GROUP BY 1`).catch(() => []),
	])

	const viewsBy = new Map(viewRows.map((row) => [row.source, row.views]))
	const chatsBy = new Map(conversationRows.map((row) => [row.source, row]))
	const tracked = link.sources.map((source) => ({
		...source,
		views: viewsBy.get(source.key) ?? 0,
		conversations: chatsBy.get(source.key)?.conversations ?? 0,
		leads: chatsBy.get(source.key)?.leads ?? 0,
	}))
	// Whatever did not come through a tracking link is the plain link.
	const sum = (field: 'views' | 'conversations' | 'leads') => tracked.reduce((total, row) => total + row[field], 0)
	const direct: ChatLinkSourceStat = {
		key: '',
		label: '',
		views: Math.max(0, link.views - sum('views')),
		conversations: Math.max(0, conversations - sum('conversations')),
		leads: Math.max(0, leads - sum('leads')),
	}

	return { views: link.views, conversations, leads, orders, sources: [direct, ...tracked] }
}
