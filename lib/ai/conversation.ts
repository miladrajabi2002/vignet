import { prisma } from '@/lib/prisma'
import type { ChannelType } from '@prisma/client'
import type { ChatMessage } from '@/lib/ai/openrouter'
import type { CatalogProduct } from '@/lib/ai/rag'
import type { StartChatParams, ExperimentConfig } from '@/lib/ai/chat-types'

/**
 * Conversation resolution + per-turn data loading, extracted from the chat
 * engine. Everything here is pure persistence logic — no LLM calls.
 */

export const HISTORY_LIMIT = 10

/** Decide which prompt variant a brand-new conversation should be served. */
function pickVariant(exp?: ExperimentConfig): string {
	if (exp?.active && exp.hasVariant && Math.random() * 100 < exp.split) return 'B'
	return 'A'
}

/**
 * Find an existing conversation (by id, or by channel + externalId) or create
 * a new one. Always scoped to the workspace + agent.
 *
 * For messenger channels the same platform thread (externalId, e.g. a Telegram
 * chat id) always maps back to a single ongoing conversation — regardless of
 * its status — so a returning user keeps their full history instead of starting
 * over. A resumed conversation that was auto-resolved is reopened.
 *
 * A unique constraint on (agentId, channel, externalId) makes creation safe
 * against the race where two webhook deliveries arrive nearly simultaneously:
 * the loser of the race catches the conflict and re-reads the winner's row.
 */
export async function resolveConversation(
	params: StartChatParams,
	exp?: ExperimentConfig,
): Promise<{ id: string; variant: string; customerInfoState: string }> {
	const { workspaceId, agent } = params

	if (params.conversationId) {
		const found = await prisma.conversation.findFirst({
			where: { id: params.conversationId, workspaceId, agentId: agent.id },
			select: { id: true, variant: true, customerInfoState: true },
		})
		if (found)
			return {
				id: found.id,
				variant: found.variant ?? 'A',
				customerInfoState: found.customerInfoState,
			}
	}

	if (params.externalId) {
		const found = await prisma.conversation.findFirst({
			where: {
				workspaceId,
				agentId: agent.id,
				channel: params.channel,
				externalId: params.externalId,
			},
			orderBy: { createdAt: 'desc' },
			select: { id: true, status: true, variant: true, customerInfoState: true },
		})
		if (found) {
			// Reopen a conversation the stale-sweep (or a handoff) had closed so the
			// thread shows as active again and continuity is preserved.
			if (found.status !== 'OPEN') {
				await prisma.conversation.update({
					where: { id: found.id },
					data: { status: 'OPEN' },
				})
			}
			return {
				id: found.id,
				variant: found.variant ?? 'A',
				customerInfoState: found.customerInfoState,
			}
		}
	}

	// Determine the initial identification state for a brand-new conversation.
	const initialState = (() => {
		const messenger: ChannelType[] = ['TELEGRAM', 'BALE', 'RUBIKA', 'WHATSAPP', 'INSTAGRAM']
		if (agent.requireCustomerInfo && !(messenger as string[]).includes(params.channel)) {
			return 'pending'
		}
		return 'skipped'
	})()

	const variant = pickVariant(exp)
	try {
		const created = await prisma.conversation.create({
			data: {
				workspaceId,
				agentId: agent.id,
				channel: params.channel,
				contactId: params.contactId,
				externalId: params.externalId,
				variant,
				customerInfoState: initialState,
			},
			select: { id: true },
		})
		return { id: created.id, variant, customerInfoState: initialState }
	} catch (e) {
		// Unique-constraint race: a concurrent delivery created the row first.
		if (
			params.externalId &&
			typeof e === 'object' &&
			e !== null &&
			'code' in e &&
			(e as { code?: string }).code === 'P2002'
		) {
			const winner = await prisma.conversation.findFirst({
				where: {
					workspaceId,
					agentId: agent.id,
					channel: params.channel,
					externalId: params.externalId,
				},
				orderBy: { createdAt: 'desc' },
				select: { id: true, variant: true, customerInfoState: true },
			})
			if (winner)
				return {
					id: winner.id,
					variant: winner.variant ?? 'A',
					customerInfoState: winner.customerInfoState,
				}
		}
		throw e
	}
}

/** Fetch model default + experiment config for an agent in one round-trip. */
export async function loadAgentRuntime(
	workspaceId: string,
	agentId: string,
): Promise<{
	defaultModel: string | null
	exp: ExperimentConfig
	variantPrompt: string | null
}> {
	const [ws, a] = await Promise.all([
		prisma.workspace.findUnique({
			where: { id: workspaceId },
			select: { defaultModel: true },
		}),
		prisma.agent.findUnique({
			where: { id: agentId },
			select: {
				experimentActive: true,
				experimentVariantPrompt: true,
				experimentSplit: true,
			},
		}),
	])
	return {
		defaultModel: ws?.defaultModel ?? null,
		variantPrompt: a?.experimentVariantPrompt ?? null,
		exp: {
			active: !!a?.experimentActive,
			hasVariant: !!a?.experimentVariantPrompt,
			split: a?.experimentSplit ?? 50,
		},
	}
}

/** Load recent conversation history as model-ready chat messages. */
export async function loadHistory(conversationId: string): Promise<ChatMessage[]> {
	const past = await prisma.message.findMany({
		where: { conversationId },
		orderBy: { createdAt: 'desc' },
		take: HISTORY_LIMIT,
		select: { role: true, content: true },
	})
	return past
		.reverse()
		.filter((m) => m.role === 'USER' || m.role === 'ASSISTANT')
		.map((m) => ({
			role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
			content: m.content,
		}))
}

/** Fetch the products assigned to this agent's catalog. */
export async function fetchCatalogProducts(agentId: string): Promise<CatalogProduct[]> {
	const rows = await prisma.agentCatalog.findMany({
		where: { agentId },
		select: {
			product: {
				select: {
					id: true,
					name: true,
					description: true,
					price: true,
					stock: true,
					active: true,
					category: { select: { name: true } },
				},
			},
		},
	})
	return rows
		.filter((r) => r.product.active)
		.map((r) => ({
			id: r.product.id,
			name: r.product.name,
			description: r.product.description,
			price: r.product.price,
			stock: r.product.stock,
			category: r.product.category?.name ?? null,
		}))
}
