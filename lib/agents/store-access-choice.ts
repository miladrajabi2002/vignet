import { prisma } from '@/lib/prisma'
import { findCheckoutIntegration } from '@/lib/commerce/checkout-service'
import { getDashboardModules } from '@/lib/verticals/registry'
import { workspaceCapabilities } from '@/lib/verticals/profile'

export interface StoreAccessValues {
  productAccessEnabled: boolean
  orderTrackingEnabled: boolean
  orderCaptureEnabled: boolean
  payLinkEnabled: boolean
}

export interface StoreAccessChoice {
  /** A store is connected and at least one agent's owner has not chosen yet. */
  pending: boolean
  /** The connected store's plugin can take payments (payment links). */
  checkoutReady: boolean
  storeHost: string | null
  /** Agents the answer applies to. */
  agentCount: number
  /** What the switches start on: the agent's own values, else the store defaults. */
  values: StoreAccessValues
}

const NOT_PENDING: StoreAccessChoice = {
  pending: false,
  checkoutReady: false,
  storeHost: null,
  agentCount: 0,
  values: { productAccessEnabled: true, orderTrackingEnabled: true, orderCaptureEnabled: false, payLinkEnabled: false },
}

/** Agents whose owner has not answered every store-access question yet. */
function undecided(workspaceId: string, checkoutReady: boolean) {
  return {
    workspaceId,
    OR: [
      { productAccessConfigured: false },
      { orderTrackingConfigured: false },
      { orderCaptureConfigured: false },
      ...(checkoutReady ? [{ payLinkConfigured: false }] : []),
    ],
  }
}

/**
 * Once a store is connected, the owner is asked what the agent may do with it
 * instead of the connection deciding silently. Asked wherever the store got
 * connected (setup or the integrations page) until every agent has an answer.
 */
export async function loadStoreAccessChoice(workspaceId: string): Promise<StoreAccessChoice> {
  const [workspace, store, checkout] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { businessType: true, businessProfile: true },
    }),
    prisma.storeIntegration.findFirst({
      where: {
        workspaceId,
        active: true,
        OR: [{ connectedAt: { not: null } }, { lastWebhookAt: { not: null } }, { lastSyncAt: { not: null } }],
      },
      orderBy: { createdAt: 'desc' },
      select: { storeUrl: true },
    }),
    findCheckoutIntegration(workspaceId),
  ])
  if (!store) return NOT_PENDING
  if (!getDashboardModules(workspaceCapabilities(workspace)).includes('products')) return NOT_PENDING

  const checkoutReady = Boolean(checkout.integration)
  const agents = await prisma.agent.findMany({
    where: undecided(workspaceId, checkoutReady),
    orderBy: { createdAt: 'asc' },
    select: {
      productAccessEnabled: true,
      orderTrackingEnabled: true,
      orderCaptureEnabled: true,
      payLinkEnabled: true,
      productAccessConfigured: true,
      orderTrackingConfigured: true,
      orderCaptureConfigured: true,
      payLinkConfigured: true,
    },
  })
  const first = agents[0]
  if (!first) return NOT_PENDING

  const storeHost = (checkout.fallback?.storeUrl ?? store.storeUrl).replace(/^https?:\/\//, '').replace(/\/$/, '')
  return {
    pending: true,
    checkoutReady,
    storeHost,
    agentCount: agents.length,
    values: {
      // The catalog and orders may still be syncing; the answer is about intent.
      productAccessEnabled: first.productAccessConfigured ? first.productAccessEnabled : true,
      orderTrackingEnabled: first.orderTrackingConfigured ? first.orderTrackingEnabled : true,
      orderCaptureEnabled: first.orderCaptureConfigured ? first.orderCaptureEnabled : first.orderCaptureEnabled || checkoutReady,
      payLinkEnabled: first.payLinkConfigured ? first.payLinkEnabled : first.payLinkEnabled || checkoutReady,
    },
  }
}

/**
 * Records the owner's answer on every agent still waiting for one. The
 * payment-link answer is kept only when the store can take payments, so a
 * later plugin upgrade asks about it then.
 */
export async function saveStoreAccessChoice(workspaceId: string, values: StoreAccessValues): Promise<string[]> {
  const { integration } = await findCheckoutIntegration(workspaceId)
  const checkoutReady = Boolean(integration)
  const agents = await prisma.agent.findMany({
    where: undecided(workspaceId, checkoutReady),
    select: { id: true },
  })
  const ids = agents.map((agent) => agent.id)
  if (ids.length === 0) return ids

  const orderCaptureEnabled = values.productAccessEnabled && values.orderCaptureEnabled
  await prisma.agent.updateMany({
    where: { id: { in: ids }, workspaceId },
    data: {
      productAccessEnabled: values.productAccessEnabled,
      productAccessConfigured: true,
      orderTrackingEnabled: values.orderTrackingEnabled,
      orderTrackingConfigured: true,
      orderCaptureEnabled,
      orderCaptureConfigured: true,
      ...(checkoutReady
        ? { payLinkEnabled: orderCaptureEnabled && values.payLinkEnabled, payLinkConfigured: true }
        : {}),
    },
  })
  return ids
}
