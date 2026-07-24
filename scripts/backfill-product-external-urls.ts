/**
 * Backfill `Product.externalUrl` for products synced from a WooCommerce store
 * before the permalink was captured by the sync pipeline.
 *
 * Run with:
 *   npx tsx scripts/backfill-product-external-urls.ts
 *
 * Strategy:
 *   For each `StoreIntegration` of type WOOCOMMERCE with REST credentials,
 *   pull one page of products from `/wp-json/wc/v3/products` and match each
 *   to a `Product` row by SKU (preferred) or name. When a match is found and
 *   the row's `externalUrl` is empty, set it to the WC `permalink`.
 *
 * The script is idempotent: running it again only fills rows that are still
 * empty, so it's safe to run after deploying the schema migration and again
 * later when the WP plugin starts sending `permalink` in its webhook payload.
 *
 * Exit codes:
 *   0 — all rows updated (or none needed updating)
 *   1 — fatal error (DB unreachable, etc.)
 */
import { prisma } from '../lib/prisma'
import { resolveWooCredentials, hasWooCredentials } from '../lib/integrations/woocommerce'
import { safeHttpGet } from '../lib/security/safe-http'

const FETCH_TIMEOUT_MS = 30_000

function authHeader(creds: { consumerKey: string; consumerSecret: string }): string {
  const token = Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString('base64')
  return `Basic ${token}`
}

function normalizeStoreUrl(storeUrl: string): string {
  return storeUrl.replace(/\/+$/, '')
}

async function fetchWooProducts(
  storeUrl: string,
  creds: { consumerKey: string; consumerSecret: string },
  page = 1,
  perPage = 100,
): Promise<Array<{ id: number; name: string; sku?: string; permalink?: string }>> {
  const url = new URL(`${normalizeStoreUrl(storeUrl)}/wp-json/wc/v3/products`)
  url.searchParams.set('per_page', String(perPage))
  url.searchParams.set('page', String(page))
  const res = await safeHttpGet(url.toString(), {
    headers: {
      Authorization: authHeader(creds),
      Accept: 'application/json',
      'User-Agent': 'VigentBackfill/1.0',
    },
    timeoutMs: FETCH_TIMEOUT_MS,
    maxBytes: 10 * 1024 * 1024,
    allowedContentTypes: ['application/json'],
  })
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`WC products HTTP ${res.status}: ${res.body.toString('utf8').slice(0, 200)}`)
  }
  const json = JSON.parse(res.body.toString('utf8')) as unknown
  return Array.isArray(json) ? (json as Array<{ id: number; name: string; sku?: string; permalink?: string }>) : []
}

async function backfillIntegration(integration: {
  id: string
  workspaceId: string
  storeUrl: string
  credentials: unknown
}): Promise<{ scanned: number; updated: number; pages: number }> {
  const creds = resolveWooCredentials(integration.credentials)
  let scanned = 0
  let updated = 0
  let pages = 0

  // Walk pages until one returns < perPage items (i.e. last page).
  for (let page = 1; page <= 50; page++) {
    let wcProducts: Array<{ id: number; name: string; sku?: string; permalink?: string }>
    try {
      wcProducts = await fetchWooProducts(integration.storeUrl, creds, page, 100)
    } catch (e) {
      console.error(`[backfill] integration ${integration.id} page ${page}:`, e instanceof Error ? e.message : e)
      break
    }
    if (wcProducts.length === 0) break
    pages++

    for (const wp of wcProducts) {
      scanned++
      if (!wp.permalink) continue

      // Match by SKU first (most reliable); fall back to name.
      const where = wp.sku
        ? { workspaceId: integration.workspaceId, sku: wp.sku }
        : { workspaceId: integration.workspaceId, name: wp.name }

      const result = await prisma.product.updateMany({
        where: { ...where, externalUrl: null },
        data: { externalUrl: wp.permalink },
      })
      if (result.count > 0) {
        updated += result.count
        console.log(`[backfill] integration ${integration.id} product "${wp.name}" → ${wp.permalink} (${result.count} row${result.count > 1 ? 's' : ''})`)
      }
    }

    if (wcProducts.length < 100) break
  }

  return { scanned, updated, pages }
}

async function main() {
  console.log('[backfill] starting Product.externalUrl backfill…')

  const integrations = await prisma.storeIntegration.findMany({
    where: { type: 'WOOCOMMERCE' },
    select: { id: true, workspaceId: true, storeUrl: true, credentials: true },
  })

  if (integrations.length === 0) {
    console.log('[backfill] no WooCommerce integrations found — nothing to do.')
    return
  }

  let totalScanned = 0
  let totalUpdated = 0
  let totalIntegrations = 0

  for (const integration of integrations) {
    if (!hasWooCredentials(integration.credentials)) {
      console.log(`[backfill] integration ${integration.id} (${integration.storeUrl}): no REST credentials — skipping (webhook-only).`)
      continue
    }
    console.log(`[backfill] integration ${integration.id} (${integration.storeUrl})`)
    try {
      const result = await backfillIntegration(integration)
      totalScanned += result.scanned
      totalUpdated += result.updated
      totalIntegrations++
      console.log(`[backfill]   scanned=${result.scanned} updated=${result.updated} pages=${result.pages}`)
    } catch (e) {
      console.error(`[backfill] integration ${integration.id} failed:`, e instanceof Error ? e.message : e)
    }
  }

  console.log('─'.repeat(60))
  console.log(`[backfill] done. integrations=${totalIntegrations} scanned=${totalScanned} updated=${totalUpdated}`)

  // Count rows still missing externalUrl, for visibility.
  const stillMissing = await prisma.product.count({
    where: { externalUrl: null },
  })
  if (stillMissing > 0) {
    console.log(`[backfill] ${stillMissing} product row(s) still have no externalUrl (manual products, other store types, or products the WC API didn't return).`)
  }
}

main()
  .catch((e) => {
    console.error('[backfill] fatal:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
