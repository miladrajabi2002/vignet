/**
 * Where a payment link enters the store.
 *
 * The link used to be https://store/?vigent_checkout=<slug>. Some page caches
 * (seen live on a store behind «Rakhsh») ignore query strings they do not
 * know and answer that address with the cached homepage: the plugin never
 * runs, no order is created and the customer lands on the shop's front page.
 * Worse, when that cache is cold the plugin's answer is stored AS the
 * homepage: one click on an expired link showed «این لینک پرداخت معتبر نیست»
 * to every visitor of the shop until the cache was cleared.
 *
 *   plugin 5.1.3+  → https://store/?wc-api=vigent_checkout&vigent_checkout=<slug>
 *                    WooCommerce's own callback endpoint. Every payment
 *                    gateway returns through it, so a store whose cache
 *                    served it could not take payments at all.
 *   older plugins  → the plugin answers the link on any front-end page, so
 *                    the link goes through the store's cart page, which no
 *                    WooCommerce-aware cache stores. Its address is read
 *                    from the shop's own homepage once a day.
 *
 * The store is only ever asked for pages a visitor opens anyway (its
 * homepage, its cart). A request carrying the link parameter is never sent
 * from here: on the cache above it would be stored as the homepage.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureError } from '@/lib/errors/capture'
import { safeHttpGet } from '@/lib/security/safe-http'
import { CHECKOUT_QUERY_VAR, pluginVersionAtLeast, storeCheckoutUrl } from '@/lib/commerce/checkout-link'

/** Plugin versions that answer payment links on WooCommerce's callback endpoint. */
export const WC_API_ENTRY_PLUGIN_VERSION = '5.1.3'
const PROBE_FRESH_MS = 24 * 60 * 60 * 1000
/** An unreachable store is asked again sooner. */
const PROBE_RETRY_MS = 60 * 60 * 1000
const PROBE_TIMEOUT_MS = 5_000
const PROBE_MAX_BYTES = 3 * 1024 * 1024

export interface CheckoutEntry {
  pluginVersion?: string | null
  /** The store's cart page: the link's way in for older plugins. */
  entryUrl?: string | null
}

interface StoredEntry {
  /** The store's cart page; null = not found, the plain store address is used. */
  url: string | null
  /** The store could not be read (WAF, firewall, timeout): asked again sooner. */
  unknown?: boolean
  checkedAt: string
}

function base(storeUrl: string): string {
  return storeUrl.replace(/\/+$/, '')
}

/** The link a customer opens for this slug. */
export function checkoutEntryUrl(storeUrl: string, slug: string, entry?: CheckoutEntry | null): string {
  if (pluginVersionAtLeast(entry?.pluginVersion, WC_API_ENTRY_PLUGIN_VERSION)) {
    const url = new URL(`${base(storeUrl)}/`)
    url.searchParams.set('wc-api', CHECKOUT_QUERY_VAR)
    url.searchParams.set(CHECKOUT_QUERY_VAR, slug)
    return url.toString()
  }
  if (entry?.entryUrl && sameSite(entry.entryUrl, storeUrl)) {
    const url = new URL(entry.entryUrl)
    url.searchParams.set(CHECKOUT_QUERY_VAR, slug)
    return url.toString()
  }
  return storeCheckoutUrl(storeUrl, slug)
}

function sameSite(candidate: string, storeUrl: string): boolean {
  try {
    const host = (value: string) => new URL(value).host.replace(/^www\./, '').toLowerCase()
    return new URL(candidate).protocol === 'https:' && host(candidate) === host(storeUrl)
  } catch {
    return false
  }
}

function readStored(capabilities: Prisma.JsonValue | null | undefined): StoredEntry | null {
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) return null
  const raw = (capabilities as Record<string, unknown>).checkoutEntry
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const entry = raw as Record<string, unknown>
  if (typeof entry.checkedAt !== 'string') return null
  return {
    url: typeof entry.url === 'string' ? entry.url : null,
    unknown: entry.unknown === true,
    checkedAt: entry.checkedAt,
  }
}

/** What the connection already knows (no network). */
export function entryFromIntegration(integration: { pluginVersion?: string | null; capabilities?: Prisma.JsonValue | null }): CheckoutEntry {
  return { pluginVersion: integration.pluginVersion ?? null, entryUrl: readStored(integration.capabilities)?.url ?? null }
}

/** The cart address a WooCommerce page prints for its own scripts. */
export function cartPageIn(html: string, storeUrl: string): string | null {
  for (const match of html.matchAll(/"cart_url"\s*:\s*"([^"]{8,300})"/g)) {
    const url = match[1].replace(/\\\//g, '/')
    if (sameSite(url, storeUrl) && !new URL(url).search) return url
  }
  return null
}

async function readPage(url: string): Promise<{ status: number; html: string; finalUrl: string } | null> {
  try {
    const response = await safeHttpGet(url, { timeoutMs: PROBE_TIMEOUT_MS, maxBytes: PROBE_MAX_BYTES, maxRedirects: 2 })
    return { status: response.status, html: response.body.toString('utf8'), finalUrl: url }
  } catch {
    return null
  }
}

/** Find the store's cart page from pages any visitor opens. */
export async function findCartPage(storeUrl: string): Promise<StoredEntry> {
  const checkedAt = new Date().toISOString()
  const home = await readPage(`${base(storeUrl)}/`)
  if (!home) return { url: null, unknown: true, checkedAt }
  const printed = cartPageIn(home.html, storeUrl)
  if (printed) return { url: printed, checkedAt }
  // The default WooCommerce address, when the homepage loads no cart script.
  const fallback = `${base(storeUrl)}/cart/`
  const cart = await readPage(fallback)
  if (cart && cart.status === 200 && /woocommerce/i.test(cart.html)) return { url: fallback, checkedAt }
  return { url: null, checkedAt }
}

/**
 * The entry for this connection, reading the store's pages when nothing fresh
 * is known. Plugins with the callback endpoint need nothing. Never throws: a
 * store that cannot be read keeps the plain store link, exactly as before.
 */
export async function resolveCheckoutEntry(integrationId: string): Promise<CheckoutEntry> {
  const integration = await prisma.storeIntegration.findUnique({
    where: { id: integrationId },
    select: { storeUrl: true, pluginVersion: true, capabilities: true },
  })
  if (!integration) return {}
  if (pluginVersionAtLeast(integration.pluginVersion, WC_API_ENTRY_PLUGIN_VERSION)) return { pluginVersion: integration.pluginVersion }
  const stored = readStored(integration.capabilities)
  const age = stored ? Date.now() - new Date(stored.checkedAt).getTime() : Infinity
  if (stored && age < (stored.unknown ? PROBE_RETRY_MS : PROBE_FRESH_MS)) {
    return { pluginVersion: integration.pluginVersion, entryUrl: stored.url }
  }
  const found = await findCartPage(integration.storeUrl)
  const capabilities = integration.capabilities && typeof integration.capabilities === 'object' && !Array.isArray(integration.capabilities)
    ? integration.capabilities as Record<string, unknown>
    : {}
  await prisma.storeIntegration.update({
    where: { id: integrationId },
    data: { capabilities: { ...capabilities, checkoutEntry: { ...found } } as Prisma.InputJsonValue, capabilitiesAt: new Date() },
  }).catch((error) => captureError('checkout:entry-save', error, { metadata: { integrationId } }))
  // A store that could not be read keeps what was known before.
  return { pluginVersion: integration.pluginVersion, entryUrl: found.unknown ? stored?.url ?? null : found.url }
}
