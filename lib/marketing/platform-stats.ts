import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'

export type PublicPlatformStats = {
	conversations: number
	businesses: number
	agents: number
}

const EMPTY_STATS: PublicPlatformStats = {
	conversations: 0,
	businesses: 0,
	agents: 0,
}

const loadPublicPlatformStats = unstable_cache(
	async (): Promise<PublicPlatformStats> => {
		const [conversations, businesses, agents] = await Promise.all([
			prisma.conversation.count({ where: { messageCount: { gt: 0 } } }),
			prisma.workspace.count({ where: { onboardingCompleted: true } }),
			prisma.agent.count({ where: { active: true } }),
		])

		return { conversations, businesses, agents }
	},
	['public-platform-stats-v1'],
	{ revalidate: 3600, tags: ['public-platform-stats'] },
)

/** Privacy-safe aggregate totals for the public homepage. */
export async function getPublicPlatformStats(): Promise<PublicPlatformStats> {
	try {
		return await loadPublicPlatformStats()
	} catch (error) {
		console.error('[marketing-stats] failed to load public aggregates:', error)
		return EMPTY_STATS
	}
}
