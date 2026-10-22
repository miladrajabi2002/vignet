import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { workspaceCapabilities } from '@/lib/verticals/profile'
import { jsonLdScript } from '@/lib/seo/json-ld'
import { MENU_ITEM_LIMIT, menuChatSlug, publicSiteUrl } from '@/lib/menu/public-menu'
import { menuPalette, readMenuSettings, readTable } from '@/lib/menu/settings'
import { buildMenuSections, menuJsonLd, type PublicMenuData } from '@/lib/menu/public-data'
import { PublicMenu } from '@/components/menu/public-menu'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// Prices, stock and «تمام شد» change during service: always render fresh.
export const dynamic = 'force-dynamic'

async function loadWorkspace(slug: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true, name: true, menuSettings: true, businessType: true, businessProfile: true },
  })
  if (!workspace) return null
  // The public menu exists only while «digital menu» is on; with it off the
  // catalog stays private. The owner can still preview it from the dashboard.
  const enabled = workspaceCapabilities(workspace).includes('digital-menu')
  const viewer = enabled ? null : await getCurrentUser().catch(() => null)
  if (!enabled && viewer?.workspaceId !== workspace.id) return null
  const profile = (workspace.businessProfile ?? {}) as { businessName?: unknown }
  const name = typeof profile.businessName === 'string' && profile.businessName.trim() ? profile.businessName.trim() : workspace.name
  return { id: workspace.id, name, menuSettings: workspace.menuSettings, enabled }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const workspace = await loadWorkspace(slug)
  if (!workspace) return {}
  const settings = readMenuSettings(workspace.menuSettings)
  const description = settings.tagline || `منوی دیجیتال ${workspace.name}؛ قیمت‌ها و آیتم‌های همیشه به‌روز.`
  return {
    title: `منوی ${workspace.name}`,
    description,
    alternates: { canonical: `/menu/${slug}` },
    ...(workspace.enabled ? {} : { robots: { index: false, follow: false } }),
    openGraph: {
      title: `منوی ${workspace.name}`,
      description,
      ...(settings.coverImage ? { images: [{ url: settings.coverImage }] } : {}),
    },
    other: { 'theme-color': menuPalette(settings).bg },
  }
}

export default async function PublicMenuPage({ params, searchParams }: Props) {
  const { slug } = await params
  const query = await searchParams
  const workspace = await loadWorkspace(slug)
  if (!workspace) notFound()

  const [categories, products, chatSlug] = await Promise.all([
    prisma.productCategory.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { workspaceId: workspace.id, active: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: MENU_ITEM_LIMIT,
      select: { id: true, name: true, description: true, price: true, comparePrice: true, stock: true, images: true, categoryId: true, tags: true, attributes: true },
    }),
    menuChatSlug(workspace.id),
  ])

  const base = publicSiteUrl()
  const data: PublicMenuData = {
    name: workspace.name,
    slug,
    settings: readMenuSettings(workspace.menuSettings),
    sections: buildMenuSections(categories, products),
    chatUrl: chatSlug ? `${base}/c/${chatSlug}` : null,
    table: readTable(query.t ?? query.table),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(menuJsonLd(data, `${base}/menu/${slug}`)) }} />
      <PublicMenu data={data} />
    </>
  )
}
