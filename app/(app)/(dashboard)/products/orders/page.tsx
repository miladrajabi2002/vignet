import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { workspaceCapabilities } from '@/lib/verticals/profile'
import { menuOwnsCatalog } from '@/lib/verticals/registry'
import { OrdersView, type OrdersSearchParams } from '@/components/products/orders-view'

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<OrdersSearchParams>
}) {
  const params = await searchParams
  const user = await requireUser()
  const workspace = await prisma.workspace.findUnique({
    where: { id: user.workspaceId },
    select: { businessType: true, businessProfile: true },
  })
  // A menu-only business reads its orders inside the menu.
  if (menuOwnsCatalog(workspaceCapabilities(workspace))) {
    const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === 'string')).toString()
    redirect(query ? `/menu/orders?${query}` : '/menu/orders')
  }

  return <OrdersView scope="products" workspaceId={user.workspaceId} searchParams={params} />
}
