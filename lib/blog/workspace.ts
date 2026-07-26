import { prisma } from '@/lib/prisma'

/**
 * وبلاگ یک کانال SEO اول‌شخص برای خود vigent.ir است، نه قابلیت per-tenant.
 *
 * This is the SINGLE resolver for the blog workspace: `PLATFORM_WORKSPACE_ID`
 * when set, otherwise the oldest workspace. app/sitemap.ts used to honour that
 * env var while the public blog pages and the admin API that creates posts
 * silently used the oldest workspace — so setting it made the sitemap
 * advertise URLs that 404. Every blog surface must call this one function.
 */
export async function getMainWorkspaceId(): Promise<string | null> {
	const explicit = process.env.PLATFORM_WORKSPACE_ID?.trim()
	if (explicit) return explicit
	const ws = await prisma.workspace.findFirst({
		orderBy: { createdAt: 'asc' },
		select: { id: true },
	})
	return ws?.id ?? null
}
