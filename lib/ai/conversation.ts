import { prisma } from '@/lib/prisma'
import type { ChannelType } from '@prisma/client'
import type { ChatMessage } from '@/lib/ai/openrouter'
import type { CatalogProduct } from '@/lib/ai/rag'
import type { CatalogService } from '@/lib/ai/rag'
import type { StartChatParams } from '@/lib/ai/chat-types'

/**
 * Conversation resolution + per-turn data loading, extracted from the chat
 * engine. Everything here is pure persistence logic — no LLM calls.
 */

export const HISTORY_LIMIT = 12

export function isHumanOwnedConversation(conversation: {
        status: 'OPEN' | 'RESOLVED' | 'HANDED_OFF'
        handedOff: boolean
}): boolean {
        return conversation.handedOff || conversation.status === 'HANDED_OFF'
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
): Promise<{
        id: string
        customerInfoState: string
        status: 'OPEN' | 'RESOLVED' | 'HANDED_OFF'
        handedOff: boolean
}> {
        const { workspaceId, agent } = params

        if (params.conversationId) {
                const found = await prisma.conversation.findFirst({
                        where: { id: params.conversationId, workspaceId, agentId: agent.id },
                        select: { id: true, customerInfoState: true, status: true, handedOff: true },
                })
                if (found)
                        return {
                                id: found.id,
                                customerInfoState: found.customerInfoState,
                                status: found.status,
                                handedOff: found.handedOff,
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
                        select: { id: true, status: true, handedOff: true, customerInfoState: true },
                })
                if (found) {
                        // A resolved thread may resume when the customer returns. A human
                        // handoff is intentionally sticky: only the operator-facing reset
                        // action is allowed to give control back to the AI.
                        if (found.status === 'RESOLVED' && !found.handedOff) {
                                await prisma.conversation.update({
                                        where: { id: found.id },
                                        data: { status: 'OPEN' },
                                })
                        }
                        return {
                                id: found.id,
                                customerInfoState: found.customerInfoState,
                                status: found.status === 'RESOLVED' && !found.handedOff ? 'OPEN' : found.status,
                                handedOff: found.handedOff,
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

        try {
                const created = await prisma.conversation.create({
                        data: {
                                workspaceId,
                                agentId: agent.id,
                                channel: params.channel,
                                contactId: params.contactId,
                                externalId: params.externalId,
                                customerInfoState: initialState,
                        },
                        select: { id: true },
                })
                return {
                        id: created.id,
                        customerInfoState: initialState,
                        status: 'OPEN',
                        handedOff: false,
                }
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
                                select: { id: true, customerInfoState: true, status: true, handedOff: true },
                        })
                        if (winner)
                                return {
                                        id: winner.id,
                                        customerInfoState: winner.customerInfoState,
                                        status: winner.status,
                                        handedOff: winner.handedOff,
                                }
                }
                throw e
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
                        // Product markers are presentation metadata, not useful
                        // conversational context; excluding them saves tokens and
                        // prevents the model from copying stale cards forward.
                        content: m.content
                                .replace(/\[\[product:\{[\s\S]*?\}\]\]/g, '')
                                .replace(/\n{3,}/g, '\n\n')
                                .trim(),
                }))
}

/** Fetch only the relevant products identified by RAG, preserving its ranking. */
export async function fetchCatalogProducts(
        agentId: string,
        productIds: string[],
        query = '',
): Promise<CatalogProduct[]> {
        const rankedIds = [...new Set(productIds)].slice(0, 5)
        const productIntent = /(?:محصول|کالا|قیمت|موجود|خرید|پیشنهاد|فروشگاه|چی\s*دارید|product|catalog|price|buy|recommend|shop)/i.test(query)
        if (!rankedIds.length && !productIntent) return []

        const ignoredTerms = new Set([
                'محصول', 'کالا', 'قیمت', 'موجود', 'خرید', 'پیشنهاد', 'دارید', 'میخوام',
                'می‌خوام', 'لطفا', 'لطفاً', 'معرفی', 'کن', 'چه', 'برای', 'product', 'catalog',
                'فروشگاه', 'چی', 'خوب', 'بهترین', 'پرفروش', 'جدید', 'price', 'buy', 'recommend',
                'show', 'have', 'best', 'popular', 'new', 'shop', 'the', 'and',
        ])
        const terms = query
                .normalize('NFKC')
                .split(/[^\p{L}\p{N}_-]+/u)
                .map((term) => term.trim())
                .filter((term) => term.length >= 2 && !ignoredTerms.has(term.toLocaleLowerCase()))
                .slice(0, 5)

        const rows = await prisma.agentCatalog.findMany({
                where: {
                        agentId,
                        ...(rankedIds.length
                                ? { productId: { in: rankedIds } }
                                : terms.length
                                        ? {
                                                product: {
                                                        active: true,
                                                        OR: terms.flatMap((term) => [
                                                                { name: { contains: term, mode: 'insensitive' as const } },
                                                                { description: { contains: term, mode: 'insensitive' as const } },
                                                        ]),
                                                },
                                        }
                                        : { product: { active: true } }),
                },
                take: rankedIds.length ? undefined : 5,
                select: {
                        product: {
                                select: {
                                        id: true,
                                        name: true,
                                        description: true,
                                        price: true,
                                        stock: true,
                                        images: true,
                                        externalUrl: true,
                                        active: true,
                                        category: { select: { name: true } },
                                },
                        },
                },
        })
        const products = rows
                .filter((r) => r.product.active)
                .map((r) => ({
                        id: r.product.id,
                        name: r.product.name,
                        description: r.product.description,
                        price: r.product.price,
                        stock: r.product.stock,
                        category: r.product.category?.name ?? null,
                        image: r.product.images[0] ?? null,
                        url: r.product.externalUrl,
                }))
        const byId = new Map(products.map((product) => [product.id, product]))
        if (!rankedIds.length) return products.slice(0, 5)
        return rankedIds.flatMap((id) => {
                const product = byId.get(id)
                return product ? [product] : []
        })
}

/** Active services are a shared operational catalog for chat and booking tools. */
export async function fetchCatalogServices(workspaceId: string): Promise<CatalogService[]> {
        return prisma.service.findMany({
                where: { workspaceId, active: true },
                orderBy: { createdAt: 'asc' },
                take: 30,
                select: { name: true, description: true, durationMinutes: true, location: true },
        })
}
