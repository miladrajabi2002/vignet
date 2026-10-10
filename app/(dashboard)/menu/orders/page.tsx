import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { workspaceCapabilities } from '@/lib/verticals/profile'
import { menuOwnsCatalog } from '@/lib/verticals/registry'
import { OrdersView, type OrdersSearchParams } from '@/components/products/orders-view'

export default async function MenuOrdersPage({
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
  // With a «محصولات» section in the menu, orders live there.
  if (!menuOwnsCatalog(workspaceCapabilities(workspace))) {
    const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === 'string')).toString()
    redirect(query ? `/products/orders?${query}` : '/products/orders')
  }

  return <OrdersView scope="menu" workspaceId={user.workspaceId} searchParams={params} />
}
