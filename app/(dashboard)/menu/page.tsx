import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { MENU_ITEM_LIMIT, menuChatSlug, publicSiteUrl } from '@/lib/menu/public-menu'
import { MenuWorkspace, type MenuCategory, type MenuItem } from '@/components/menu/menu-workspace'
import { readMenuSettings } from '@/lib/menu/settings'

export const dynamic = 'force-dynamic'

export default async function DigitalMenuDashboardPage() {
  const user = await requireUser()
  const [workspace, categories, products, total, chatSlug] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({ where: { id: user.workspaceId }, select: { name: true, slug: true, menuSettings: true } }),
    prisma.productCategory.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, sortOrder: true },
    }),
    prisma.product.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: [{ createdAt: 'desc' }],
      take: MENU_ITEM_LIMIT,
      select: {
        id: true, name: true, description: true, price: true, comparePrice: true, stock: true,
        images: true, categoryId: true, active: true, sourceIntegrationId: true, tags: true,
      },
    }),
    prisma.product.count({ where: { workspaceId: user.workspaceId } }),
    menuChatSlug(user.workspaceId),
  ])
  const base = publicSiteUrl()

  const items: MenuItem[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    comparePrice: product.comparePrice,
    stock: product.stock,
    image: product.images[0] ?? null,
    categoryId: product.categoryId,
    active: product.active,
    synced: Boolean(product.sourceIntegrationId),
    tags: product.tags,
  }))
  const menuCategories: MenuCategory[] = categories.map((category) => ({ id: category.id, name: category.name, sortOrder: category.sortOrder }))

  return (
    <MenuWorkspace
      businessName={workspace.name}
      slug={workspace.slug}
      settings={readMenuSettings(workspace.menuSettings)}
      publicUrl={`${base}/menu/${workspace.slug}`}
      chatUrl={chatSlug ? `${base}/c/${chatSlug}` : null}
      categories={menuCategories}
      initialItems={items}
      truncated={total > items.length}
    />
  )
}
