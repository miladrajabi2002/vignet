/** The connected WooCommerce store, as the payment-method choice needs it. */
import { pluginSupportsCheckout } from '@/lib/commerce/checkout-link'
import { findCheckoutIntegration } from '@/lib/commerce/checkout-service'

export interface CheckoutStoreInfo {
  host: string
  /** The store's plugin can take a payment link. */
  ready: boolean
}

export async function loadCheckoutStore(workspaceId: string): Promise<CheckoutStoreInfo | null> {
  const found = await findCheckoutIntegration(workspaceId)
  const store = found.fallback
  if (!store) return null
  return { host: store.storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''), ready: pluginSupportsCheckout(store.pluginVersion) }
}
