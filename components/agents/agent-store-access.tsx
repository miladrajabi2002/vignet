import { getDashboardModules } from '@/lib/verticals/registry'
import { workspaceCapabilities } from '@/lib/verticals/profile'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { StoreAccessSettings } from '@/components/agents/store-access-settings'
import { pluginSupportsCheckout } from '@/lib/commerce/checkout-link'
import { findCheckoutIntegration } from '@/lib/commerce/checkout-service'

export async function AgentStoreAccess({ agentId }: { agentId: string }) {
  const user = await requireUser()

  const [agent, productCount, orderCount, checkoutIntegration] = await Promise.all([
    prisma.agent.findFirst({
      where: { id: agentId, workspaceId: user.workspaceId },
      select: {
        id: true,
        workspace: { select: { businessType: true, businessProfile: true } },
        productAccessEnabled: true,
        orderTrackingEnabled: true,
        orderCaptureEnabled: true,
        restockAlertsEnabled: true,
        payLinkEnabled: true,
        orderUpdatesEnabled: true,
        cartHoldEnabled: true,
        productAccessConfigured: true,
        orderTrackingConfigured: true,
        orderCaptureConfigured: true,
        payLinkConfigured: true,
      },
    }),
    prisma.product.count({
      where: { workspaceId: user.workspaceId, active: true },
    }),
    prisma.storeOrder.count({
      where: { workspaceId: user.workspaceId },
    }),
    findCheckoutIntegration(user.workspaceId),
  ])
  if (!agent) notFound()
  const checkoutStore = checkoutIntegration.fallback
  // A store whose plugin takes payments sells in chat until the owner chooses.
  const sellingReady = Boolean(checkoutIntegration.integration)
  if (!getDashboardModules(workspaceCapabilities(agent.workspace)).includes('products')) return null

  const productAccessEnabled = agent.productAccessConfigured
    ? agent.productAccessEnabled
    : productCount > 0
  const orderTrackingEnabled = agent.orderTrackingConfigured
    ? agent.orderTrackingEnabled
    : orderCount > 0
  const orderCaptureEnabled = agent.orderCaptureConfigured || !sellingReady
    ? agent.orderCaptureEnabled
    : true
  const payLinkEnabled = agent.payLinkConfigured || !sellingReady
    ? agent.payLinkEnabled
    : true
  if (
    productAccessEnabled !== agent.productAccessEnabled ||
    orderTrackingEnabled !== agent.orderTrackingEnabled ||
    orderCaptureEnabled !== agent.orderCaptureEnabled ||
    payLinkEnabled !== agent.payLinkEnabled
  ) {
    await prisma.agent.update({
      where: { id: agent.id },
      data: { productAccessEnabled, orderTrackingEnabled, orderCaptureEnabled, payLinkEnabled },
    })
  }

  return (
    <section id="store-access" className="scroll-mt-28">
    <StoreAccessSettings
      agentId={agent.id}
      initialProductAccessEnabled={productAccessEnabled}
      initialOrderTrackingEnabled={orderTrackingEnabled}
      initialOrderCaptureEnabled={orderCaptureEnabled}
      initialRestockAlertsEnabled={agent.restockAlertsEnabled}
      initialPayLinkEnabled={payLinkEnabled}
      initialOrderUpdatesEnabled={agent.orderUpdatesEnabled}
      initialCartHoldEnabled={agent.cartHoldEnabled}
      checkoutStore={checkoutStore ? { host: checkoutStore.storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''), ready: pluginSupportsCheckout(checkoutStore.pluginVersion) } : null}
      productCount={productCount}
      orderCount={orderCount}
    />
    </section>
  )
}
