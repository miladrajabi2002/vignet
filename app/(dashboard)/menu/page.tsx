import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { MenuShareCard } from '@/components/menu/menu-share-card'

export default async function DigitalMenuDashboardPage() {
  const user = await requireUser()
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: user.workspaceId }, select: { name: true, slug: true, _count: { select: { products: true } } } })
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://vigent.ir').replace(/\/$/, '')
  return <MenuShareCard businessName={workspace.name} productCount={workspace._count.products} publicUrl={`${baseUrl}/menu/${workspace.slug}`} />
}
