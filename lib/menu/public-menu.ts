import { prisma } from '@/lib/prisma'

/** Upper bound for one menu page; a restaurant menu is far smaller. */
export const MENU_ITEM_LIMIT = 500

/** The customer chat link for this workspace, when one is live. */
export async function menuChatSlug(workspaceId: string): Promise<string | null> {
  const link = await prisma.chatLink.findFirst({
    where: { workspaceId, enabled: true, agent: { active: true } },
    orderBy: { createdAt: 'asc' },
    select: { slug: true },
  })
  return link?.slug ?? null
}

export function publicSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://vigent.ir').replace(/\/$/, '')
}
