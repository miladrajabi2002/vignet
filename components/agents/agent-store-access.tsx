import { getDashboardModules } from '@/lib/verticals/registry'
import { readBusinessProfile } from '@/lib/verticals/profile'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { StoreAccessSettings } from '@/components/agents/store-access-settings'

export async function AgentStoreAccess({ agentId }: { agentId: string }) {
  const user = await requireUser()

  const [agent, productCount, orderCount] = await Promise.all([
    prisma.agent.findFirst({
      where: { id: agentId, workspaceId: user.workspaceId },
      select: {
        id: true,
        workspace: { select: { businessType: true, businessProfile: true } },
        productAccessEnabled: true,
        orderTrackingEnabled: true,
        productAccessConfigured: true,
        orderTrackingConfigured: true,
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
  const profile = readBusinessProfile(agent.workspace.businessProfile)
  if (!getDashboardModules(agent.workspace.businessType, profile?.services).includes('products')) return null

  const productAccessEnabled = agent.productAccessConfigured
    ? agent.productAccessEnabled
    : productCount > 0
  const orderTrackingEnabled = agent.orderTrackingConfigured
    ? agent.orderTrackingEnabled
    : orderCount > 0
  if (
    productAccessEnabled !== agent.productAccessEnabled ||
    orderTrackingEnabled !== agent.orderTrackingEnabled
  ) {
    await prisma.agent.update({
      where: { id: agent.id },
      data: { productAccessEnabled, orderTrackingEnabled },
    })
  }

  return (
    <section id="store-access" className="scroll-mt-28">
    <StoreAccessSettings
      agentId={agent.id}
      initialProductAccessEnabled={productAccessEnabled}
      initialOrderTrackingEnabled={orderTrackingEnabled}
      productCount={productCount}
      orderCount={orderCount}
    />
    </section>
  )
}
