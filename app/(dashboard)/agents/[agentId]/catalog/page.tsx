import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { StoreAccessSettings } from '@/components/agents/store-access-settings'

export default async function AgentCatalogPage(
  props: {
    params: Promise<{ agentId: string }>
  }
) {
  const params = await props.params;
  const user = await requireUser()

  const [agent, productCount, orderCount] = await Promise.all([
    prisma.agent.findFirst({
      where: { id: params.agentId, workspaceId: user.workspaceId },
      select: {
        id: true,
        productAccessEnabled: true,
        orderTrackingEnabled: true,
      },
    }),
    prisma.product.count({
      where: { workspaceId: user.workspaceId, active: true },
    }),
    prisma.storeOrder.count({
      where: { workspaceId: user.workspaceId },
    }),
  ])
  if (!agent) notFound()

  return (
    <StoreAccessSettings
      agentId={agent.id}
      initialProductAccessEnabled={agent.productAccessEnabled}
      initialOrderTrackingEnabled={agent.orderTrackingEnabled}
      productCount={productCount}
      orderCount={orderCount}
    />
  )
}
