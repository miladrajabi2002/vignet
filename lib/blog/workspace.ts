import { prisma } from '@/lib/prisma'

/**
 * وبلاگ یک کانال SEO اول‌شخص برای خود vigent.ir است، نه قابلیت per-tenant.
 * همیشه در اولین (قدیمی‌ترین) workspace منتشر می‌شود.
 */
export async function getMainWorkspaceId(): Promise<string | null> {
	const ws = await prisma.workspace.findFirst({
		orderBy: { createdAt: 'asc' },
		select: { id: true },
	})
	return ws?.id ?? null
}
