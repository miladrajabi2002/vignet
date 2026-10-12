/**
 * Catalog catch-up for plugin-connected (push-only) WooCommerce stores.
 *
 * The plugin pushes its catalog once. Products refused by the plan limit are
 * never sent again on their own, so a workspace that upgraded kept its trial
 * catalog until the owner reconnected the plugin. The refusal is remembered on
 * the integration and, once there is room, the plugin is asked to push again:
 * directly through its signed REST route, or — many hosts block inbound calls
 * to wp-json — as a `resync` hint in the answer to its next webhook.
 */
import { checkWorkspaceResourceCreateAllowed } from '@/lib/billing/entitlements'
import { pluginVersionAtLeast } from '@/lib/commerce/checkout-link'
import { requestStoreResync } from '@/lib/commerce/store-api'
import { prisma } from '@/lib/prisma'

export const MIN_RESYNC_PLUGIN_VERSION = '5.1.0'

export type WooResyncKind = 'products'

export function pluginSupportsResync(version: string | null | undefined): boolean {
  return pluginVersionAtLeast(version, MIN_RESYNC_PLUGIN_VERSION)
}

/** What the plugin should push again, for the answer to one of its webhooks. */
export async function wooResyncHint(
  integration: { workspaceId: string; productResyncNeededAt: Date | null },
  pluginVersion: string | null | undefined,
): Promise<WooResyncKind[] | null> {
  if (!integration.productResyncNeededAt || !pluginSupportsResync(pluginVersion)) return null
  const capacity = await checkWorkspaceResourceCreateAllowed(integration.workspaceId, 'products')
  return capacity.allowed ? ['products'] : null
}

/**
 * Ask the workspace's stores to push their catalog again. Without `force` only
 * stores that lost products to the plan limit are asked, and only when the plan
 * now has room. Returns how many stores accepted the request; the rest are
 * reached by the webhook hint.
 */
export async function requestWooProductResync(
  workspaceId: string,
  options: { integrationId?: string; force?: boolean } = {},
): Promise<number> {
  const integrations = await prisma.storeIntegration.findMany({
    where: {
      workspaceId,
      type: 'WOOCOMMERCE',
      active: true,
      webhookSecret: { not: null },
      ...(options.integrationId ? { id: options.integrationId } : {}),
      ...(options.force ? {} : { productResyncNeededAt: { not: null } }),
    },
    select: { storeUrl: true, webhookSecret: true, pluginVersion: true },
  })
  const stores = integrations.filter((row) => pluginSupportsResync(row.pluginVersion))
  if (stores.length === 0) return 0
  if (!options.force && !(await checkWorkspaceResourceCreateAllowed(workspaceId, 'products')).allowed) return 0

  const answers = await Promise.allSettled(
    stores.map((row) => requestStoreResync({ storeUrl: row.storeUrl, webhookSecret: row.webhookSecret! }, ['products'])),
  )
  return answers.filter((answer) => answer.status === 'fulfilled' && answer.value.scheduled).length
}

/** The plugin announces a resend before its first page; stop asking for one. */
export async function markWooProductResyncStarted(integration: { id: string; workspaceId: string }): Promise<void> {
  await prisma.storeIntegration.update({
    where: { id: integration.id },
    data: { productResyncNeededAt: null },
  })
  await prisma.storeSyncLog.create({
    data: {
      integrationId: integration.id,
      workspaceId: integration.workspaceId,
      direction: 'push',
      entity: 'products',
      outcome: 'ok',
      count: 0,
      message: 'catalog resync started',
    },
  }).catch(() => undefined)
}
