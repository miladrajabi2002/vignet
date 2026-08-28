/* === Issue #1: source tag for WooCommerce-synced customers === */
export const WOO_SOURCE_TAG = 'افزونه ووکامرس'

import crypto from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import { normalizePhone } from '@/lib/phone'
import { dispatchProductEmbed } from '@/lib/queue/jobs'
import type { WooWebhookBatchJobData, WooWebhookEvent } from '@/lib/queue/jobs'
import { safeHttpGet } from '@/lib/security/safe-http'
import { productEmbeddingSourceHash } from '@/lib/products/embedding-source'
import { checkWorkspaceResourceCreateAllowed } from '@/lib/billing/entitlements'

export const WOOCOMMERCE_REST_PER_PAGE = 100

export interface WooCredentials {
  consumerKey: string
  consumerSecret: string
}

export interface StoreIntegrationInput {
  id: string
  workspaceId: string
  storeUrl: string
  credentials: WooCredentials
}

interface WooCategory {
  id?: number | string
  name?: string
  slug?: string
  parent?: number | string
  parent_id?: number | string
  primary?: boolean
}

interface WooProduct {
  id: number
  name: string
  sku?: string
  type?: string // WooCommerce product type: 'simple', 'variable', 'grouped', 'external'
  description?: string
  short_description?: string
  price?: string
  regular_price?: string
  sale_price?: string
  stock_quantity?: number | null
  in_stock?: boolean
  manage_stock?: boolean
  status?: string
  permalink?: string
  date_modified?: string
  date_modified_gmt?: string
  images?: { src?: string }[]
  tags?: { name?: string }[]
  categories?: WooCategory[]
  attributes?: {
    name?: string
    options?: string[] | string
  }[]
  /**
   * Variation list for variable products. Populated by
   * Vigent_Woo_Core::product_to_payload() when the WC product type is
   * 'variable'. Each entry carries its own sku/price/stock/attributes so
   * the agent can answer "do you have طرح 02 in red?" with real per-variant
   * stock numbers instead of the parent's empty/null stock.
   */
  variations?: WooVariation[]
}

/**
 * Single variation of a WooCommerce variable product.
 *
 * Mirrors the per-variation payload built in
 * `Vigent_Woo_Core::product_to_payload()`. `attributes` is a flat
 * `{label: value}` map (already resolved from slugs to term names on the
 * PHP side) — e.g. `{ "رنگ": "آبی", "سایز": "XL" }`.
 */
interface WooVariation {
  id: number
  sku?: string
  price?: string
  regular_price?: string
  sale_price?: string
  manage_stock?: boolean
  stock_quantity?: number | null
  in_stock?: boolean
  attributes?: Record<string, string>
  image?: string
}

interface WooOrder {
  id: number
  number?: string
  status?: string
  currency?: string
  total?: string
  payment_method?: string
  payment_method_title?: string
  tracking_code?: string | number
  date_created?: string
  date_created_gmt?: string
  date_modified?: string
  date_modified_gmt?: string
  billing?: {
    first_name?: string
    last_name?: string
    phone?: string
    email?: string
  }
  shipping?: { method_title?: string }
  // v4.2.4+ — the plugin sends a richer shipping_info object aggregating
  // meta keys from Iranian shipment plugins (PWS, Postex, WC Shipment
  // Tracking, custom theme fields). Older plugins only send tracking_code.
  shipping_info?: {
    tracking_code?: string
    courier_name?: string
    shipping_date?: string
    tracking_link?: string
    shipping_note?: string
  }
  line_items?: {
    name?: string
    quantity?: number
    total?: string
    sku?: string
  }[]
}

/**
 * WooCommerce customer payload sent by the v4.2.9+ plugin.
 *
 * Mirrors Vigent_Woo_Core::customer_to_payload() in the WordPress plugin.
 * Every field is optional except `id` and at least one of `email`/`phone`
 * (the plugin drops customers with neither before sending).
 */
interface WooCustomer {
  id: number
  email?: string
  first_name?: string
  last_name?: string
  display_name?: string
  phone?: string
  billing_city?: string
  billing_state?: string
  billing_address_1?: string
  billing_postcode?: string
  date_created?: string
  date_created_gmt?: string
  date_modified?: string
  date_modified_gmt?: string
  is_paying?: boolean
  orders_count?: number
  total_spent?: number
}

export function resolveWooCredentials(raw: unknown): WooCredentials {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid WooCommerce credentials payload')
  const value = raw as Record<string, unknown>
  const consumerKey = typeof value.consumerKey === 'string' ? value.consumerKey : ''
  const consumerSecret =
    typeof value.consumerSecret === 'string'
      ? value.consumerSecret
      : typeof value.consumerSecretEnc === 'string'
        ? decrypt(value.consumerSecretEnc)
        : ''
  if (!consumerKey || !consumerSecret) {
    throw new Error('Missing WooCommerce consumerKey/consumerSecret')
  }
  return { consumerKey, consumerSecret }
}

export function hasWooCredentials(raw: unknown): boolean {
  try {
    resolveWooCredentials(raw)
    return true
  } catch {
    return false
  }
}

export function verifyWooWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!rawBody || !signature || !secret) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const expectedBytes = Buffer.from(expected, 'utf8')
  const actualBytes = Buffer.from(signature.trim(), 'utf8')
  return expectedBytes.length === actualBytes.length && crypto.timingSafeEqual(expectedBytes, actualBytes)
}

export async function findContactByPhone(
  workspaceId: string,
  phone: string | null | undefined,
) {
  if (!phone) return null
  const normalized = normalizePhone(phone)
  if (!normalized) return null
  return prisma.contact.findFirst({
    where: { workspaceId, phone: normalized },
    select: { id: true },
  })
}

export async function findContactByEmail(
  workspaceId: string,
  email: string | null | undefined,
) {
  const normalized = email?.trim().toLowerCase()
  if (!normalized) return null
  return prisma.contact.findFirst({
    where: { workspaceId, metadata: { path: ['email'], equals: normalized } },
    select: { id: true },
  })
}

function authHeader(credentials: WooCredentials): string {
  return `Basic ${Buffer.from(`${credentials.consumerKey}:${credentials.consumerSecret}`).toString('base64')}`
}

function normalizeStoreUrl(storeUrl: string): string {
  return storeUrl.replace(/\/+$/, '')
}

async function fetchWooJson<T>(
  storeUrl: string,
  credentials: WooCredentials,
  path: string,
  params: Record<string, string | number>,
): Promise<T[]> {
  const url = new URL(`${normalizeStoreUrl(storeUrl)}/wp-json/wc/v3/${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))
  const response = await safeHttpGet(url.toString(), {
    headers: {
      Authorization: authHeader(credentials),
      Accept: 'application/json',
      'User-Agent': 'VigentSync/2.0',
    },
    timeoutMs: 30_000,
    maxBytes: 10 * 1024 * 1024,
    allowedContentTypes: ['application/json'],
  })
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`WC ${path} HTTP ${response.status}: ${response.body.toString('utf8').slice(0, 200)}`)
  }
  const json = JSON.parse(response.body.toString('utf8')) as unknown
  return Array.isArray(json) ? (json as T[]) : []
}

async function fetchAllWoo<T>(
  storeUrl: string,
  credentials: WooCredentials,
  path: string,
  extra: Record<string, string | number> = {},
): Promise<T[]> {
  const result: T[] = []
  for (let page = 1; page <= 50; page++) {
    const items = await fetchWooJson<T>(storeUrl, credentials, path, {
      ...extra,
      per_page: WOOCOMMERCE_REST_PER_PAGE,
      page,
    })
    result.push(...items)
    if (items.length < WOOCOMMERCE_REST_PER_PAGE) break
  }
  return result
}

function parseDate(raw: string | null | undefined, assumeUtc = false): Date | null {
  if (!raw) return null
  const value = assumeUtc && !/[zZ]|[+-]\d\d:\d\d$/.test(raw) ? `${raw}Z` : raw
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function productUpdatedAt(product: WooProduct, fallback?: string): Date | null {
  return (
    parseDate(product.date_modified_gmt, true) ??
    parseDate(product.date_modified) ??
    parseDate(fallback)
  )
}

function orderUpdatedAt(order: WooOrder): Date | null {
  return parseDate(order.date_modified_gmt, true) ?? parseDate(order.date_modified)
}

function mapWooProduct(product: WooProduct) {
  const price = Number.parseFloat(product.price ?? '')
  const regularPrice = Number.parseFloat(product.regular_price ?? '')
  const effectivePrice = Number.isFinite(price) && price >= 0
    ? price
    : Number.isFinite(regularPrice) && regularPrice >= 0
      ? regularPrice
      : null
  const comparePrice =
    Number.isFinite(regularPrice) && effectivePrice != null && regularPrice > effectivePrice
      ? regularPrice
      : null
  // Human-readable attribute map (e.g. { "رنگ": "آبی, قرمز", "سایز": "XL" }).
  // This stays a flat Record<string, string> for backward compatibility with
  // any code that reads Product.attributes expecting only string values.
  const attributes: Record<string, string> = {}
  for (const attribute of product.attributes ?? []) {
    if (!attribute.name) continue
    attributes[attribute.name] = Array.isArray(attribute.options)
      ? attribute.options.map(String).join(', ')
      : attribute.options == null
        ? ''
        : String(attribute.options)
  }

  // Variable products: normalize per-variation sku/price/stock/attributes
  // once here so the RAG formatter and any future UI logic don't have to
  // re-parse strings. We cap the list at 200 entries to stay within
  // Product.attributes JSON budget for stores with extreme variation counts
  // (e.g. fabric swatches with thousands of SKUs).
  const variations = (product.variations ?? [])
    .map((v) => {
      const varPrice = Number.parseFloat(v.price ?? '')
      const varRegular = Number.parseFloat(v.regular_price ?? '')
      const varSale = Number.parseFloat(v.sale_price ?? '')
      const effectiveVarPrice = Number.isFinite(varPrice) && varPrice >= 0
        ? varPrice
        : Number.isFinite(varRegular) && varRegular >= 0
          ? varRegular
          : null
      return {
        id: v.id,
        sku: v.sku?.trim() || null,
        price: effectiveVarPrice,
        regularPrice: Number.isFinite(varRegular) && varRegular >= 0 ? varRegular : null,
        salePrice: Number.isFinite(varSale) && varSale >= 0 ? varSale : null,
        manageStock: v.manage_stock === true,
        stockQuantity: v.stock_quantity ?? null,
        inStock: v.in_stock !== false,
        attributes: v.attributes ?? {},
        image: v.image?.trim() || null,
      }
    })
    .filter((v) => v.id > 0)
    .slice(0, 200)

  // For variable products with no parent price, derive a display price from
  // the variations so the catalog row isn't shown as "قیمت: خالی" in chat.
  // We pick the min positive price as the "from" price. If the parent
  // already has a price (some stores set the parent price as the min), we
  // keep it as-is.
  let displayPrice = effectivePrice
  if (displayPrice == null && variations.length > 0) {
    const positivePrices = variations
      .map((v) => v.price)
      .filter((p): p is number => p != null && p > 0)
    if (positivePrices.length > 0) {
      displayPrice = Math.min(...positivePrices)
    }
  }

  return {
    name: product.name,
    description: (product.short_description || product.description || '').slice(0, 4000) || null,
    price: displayPrice,
    comparePrice,
    sku: product.sku?.trim() || null,
    stock: product.manage_stock === true && product.stock_quantity != null
      ? product.stock_quantity
      : product.in_stock === false
        ? 0
        : null,
    images: (product.images ?? [])
      .map((image) => image.src?.trim())
      .filter((src): src is string => Boolean(src)),
    tags: (product.tags ?? [])
      .map((tag) => tag.name?.trim())
      .filter((name): name is string => Boolean(name))
      .sort((a, b) => a.localeCompare(b)),
    attributes,
    externalUrl: product.permalink?.trim() || null,
    active: product.status ? product.status === 'publish' : true,
    // `variations` is NOT a Prisma field — it's folded into `attributes` by
    // the caller (upsertProductFromWoo) before persistence. We expose it on
    // the mapped result purely so the caller can compute the persisted JSON
    // and the source hash without re-walking the raw WooProduct.
    variations,
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)]),
    )
  }
  return value
}

function sourceHash(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

function categoryExternalId(category: WooCategory): string | null {
  if (category.id == null) return null
  const value = String(category.id).trim()
  return value || null
}

function categorySlug(category: WooCategory, externalId: string): string {
  const input = (category.slug || category.name || `woo-${externalId}`)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0600-\u06ff_-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return (input || `woo-${externalId}`).slice(0, 150)
}

async function availableCategorySlug(
  integrationId: string,
  workspaceId: string,
  category: WooCategory,
  externalId: string,
): Promise<string> {
  const base = categorySlug(category, externalId)
  const collision = await prisma.productCategory.findUnique({
    where: { workspaceId_slug: { workspaceId, slug: base } },
    select: { sourceIntegrationId: true, externalId: true },
  })
  if (
    !collision ||
    collision.sourceIntegrationId === null ||
    (collision.sourceIntegrationId === integrationId && collision.externalId === externalId)
  ) {
    return base
  }
  const suffix = crypto.createHash('sha1').update(`${integrationId}:${externalId}`).digest('hex').slice(0, 8)
  return `${base.slice(0, 140)}-${suffix}`
}

async function upsertWooCategory(
  integration: StoreIntegrationInput,
  category: WooCategory,
): Promise<{ id: string; externalId: string } | null> {
  const externalId = categoryExternalId(category)
  if (!externalId) return null
  const { id: integrationId, workspaceId } = integration
  const key = { sourceIntegrationId_externalId: { sourceIntegrationId: integrationId, externalId } }
  const existing = await prisma.productCategory.findUnique({ where: key, select: { id: true } })
  if (existing) {
    const updated = await prisma.productCategory.update({
      where: { id: existing.id },
      data: { name: category.name?.trim() || `WooCommerce ${externalId}` },
      select: { id: true },
    })
    return { ...updated, externalId }
  }

  const slug = await availableCategorySlug(integrationId, workspaceId, category, externalId)
  const legacy = await prisma.productCategory.findFirst({
    where: { workspaceId, slug, sourceIntegrationId: null },
    select: { id: true },
  })
  try {
    const row = legacy
      ? await prisma.productCategory.update({
          where: { id: legacy.id },
          data: {
            sourceIntegrationId: integrationId,
            externalId,
            name: category.name?.trim() || `WooCommerce ${externalId}`,
          },
          select: { id: true },
        })
      : await prisma.productCategory.create({
          data: {
            workspaceId,
            sourceIntegrationId: integrationId,
            externalId,
            name: category.name?.trim() || `WooCommerce ${externalId}`,
            slug,
          },
          select: { id: true },
        })
    return { ...row, externalId }
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error
    const raced = await prisma.productCategory.findUnique({ where: key, select: { id: true } })
    if (!raced) throw error
    return { ...raced, externalId }
  }
}

async function upsertWooCategories(
  integration: StoreIntegrationInput,
  categories: WooCategory[],
): Promise<string | null> {
  const normalized = categories
    .filter((category) => categoryExternalId(category) !== null)
    .sort((a, b) => (categoryExternalId(a) ?? '').localeCompare(categoryExternalId(b) ?? '', undefined, { numeric: true }))
  if (normalized.length === 0) return null

  const rows = new Map<string, string>()
  for (const category of normalized) {
    const row = await upsertWooCategory(integration, category)
    if (row) rows.set(row.externalId, row.id)
  }

  for (const category of normalized) {
    const externalId = categoryExternalId(category)
    const categoryId = externalId ? rows.get(externalId) : null
    const rawParent = category.parent_id ?? category.parent
    const parentExternalId = rawParent == null || String(rawParent) === '0' ? null : String(rawParent)
    if (!categoryId || !parentExternalId) continue
    const parentId = rows.get(parentExternalId) ?? (
      await prisma.productCategory.findUnique({
        where: {
          sourceIntegrationId_externalId: {
            sourceIntegrationId: integration.id,
            externalId: parentExternalId,
          },
        },
        select: { id: true },
      })
    )?.id
    if (parentId && parentId !== categoryId) {
      await prisma.productCategory.update({ where: { id: categoryId }, data: { parentId } })
    }
  }

  const parentIds = new Set(
    normalized
      .map((category) => category.parent_id ?? category.parent)
      .filter((value) => value != null && String(value) !== '0')
      .map(String),
  )
  const primary =
    normalized.find((category) => category.primary === true) ??
    normalized.find((category) => !parentIds.has(categoryExternalId(category) ?? '')) ??
    normalized[0]
  return rows.get(categoryExternalId(primary) ?? '') ?? null
}

async function findLegacyProduct(
  workspaceId: string,
  sku: string | null,
  name: string,
): Promise<{
  id: string
  sourceHash: string | null
  sourceUpdatedAt: Date | null
  embeddingUpdatedAt: Date | null
  active: boolean
  name: string
  description: string | null
  sku: string | null
  tags: string[]
  attributes: Prisma.JsonValue
  categoryId: string | null
} | null> {
  const select = {
    id: true,
    sourceHash: true,
    sourceUpdatedAt: true,
    embeddingUpdatedAt: true,
    active: true,
    name: true,
    description: true,
    sku: true,
    tags: true,
    attributes: true,
    categoryId: true,
  } as const
  if (sku) {
    const bySku = await prisma.product.findMany({
      where: { workspaceId, sourceIntegrationId: null, sku },
      select,
      take: 2,
    })
    if (bySku.length === 1) return bySku[0]
  }
  if (name) {
    const byName = await prisma.product.findMany({
      where: {
        workspaceId,
        sourceIntegrationId: null,
        name: { equals: name, mode: 'insensitive' },
      },
      select,
      take: 2,
    })
    if (byName.length === 1) return byName[0]
  }
  return null
}

async function allAgentIds(workspaceId: string): Promise<string[]> {
  const agents = await prisma.agent.findMany({
    where: { workspaceId },
    select: { id: true },
  })
  return agents.map((agent) => agent.id)
}

async function assignProduct(productId: string, agentIds: string[]): Promise<void> {
  if (agentIds.length === 0) return
  await prisma.agentCatalog.createMany({
    data: agentIds.map((agentId) => ({ agentId, productId })),
    skipDuplicates: true,
  })
}

async function upsertProductFromWoo(
  integration: StoreIntegrationInput,
  product: WooProduct,
  options: { agentIds?: string[]; changedAt?: string } = {},
): Promise<{ productId: string; changed: boolean }> {
  if (!product?.id || !product.name?.trim()) throw new Error('INVALID_PRODUCT_PAYLOAD')
  const externalId = String(product.id)
  const mapped = mapWooProduct(product)
  const { variations, ...mappedFields } = mapped
  const categoryId = await upsertWooCategories(integration, product.categories ?? [])
  const updatedAt = productUpdatedAt(product, options.changedAt)
  // Fold per-variation data into the persisted JSON column so we don't need
  // a Prisma migration. The shape is:
  //   { "رنگ": "آبی, قرمز", "سایز": "XL", "_variations": [...] }
  // Legacy code that iterates attribute keys still works — it just sees an
  // extra `_variations` key (underscore-prefixed to mark it as internal).
  const persistedAttributes: Record<string, unknown> = { ...mappedFields.attributes }
  if (variations.length > 0) {
    persistedAttributes._variations = variations
  }
  const hash = sourceHash({
    ...mappedFields,
    variations,
    attributes: persistedAttributes,
    categories: (product.categories ?? [])
      .map((category) => ({
        id: categoryExternalId(category),
        name: category.name ?? null,
        parent: category.parent_id ?? category.parent ?? null,
        primary: category.primary === true,
      }))
      .sort((a, b) => (a.id ?? '').localeCompare(b.id ?? '', undefined, { numeric: true })),
  })
  const key = {
    sourceIntegrationId_externalId: {
      sourceIntegrationId: integration.id,
      externalId,
    },
  }
  let existing = await prisma.product.findUnique({
    where: key,
    select: {
      id: true,
      sourceHash: true,
      sourceUpdatedAt: true,
      embeddingUpdatedAt: true,
      active: true,
      name: true,
      description: true,
      sku: true,
      tags: true,
      attributes: true,
      categoryId: true,
    },
  })
  if (!existing) existing = await findLegacyProduct(integration.workspaceId, mapped.sku, mapped.name)

  if (existing?.sourceUpdatedAt && updatedAt && updatedAt < existing.sourceUpdatedAt) {
    await assignProduct(existing.id, options.agentIds ?? await allAgentIds(integration.workspaceId))
    if (!existing.embeddingUpdatedAt) {
      await dispatchProductEmbed({ productId: existing.id, workspaceId: integration.workspaceId })
    }
    return { productId: existing.id, changed: false }
  }
  if (existing?.sourceHash === hash) {
    if (updatedAt && (!existing.sourceUpdatedAt || updatedAt > existing.sourceUpdatedAt)) {
      await prisma.product.update({ where: { id: existing.id }, data: { sourceUpdatedAt: updatedAt } })
    }
    await assignProduct(existing.id, options.agentIds ?? await allAgentIds(integration.workspaceId))
    if (!existing.embeddingUpdatedAt) {
      await dispatchProductEmbed({ productId: existing.id, workspaceId: integration.workspaceId })
    }
    return { productId: existing.id, changed: false }
  }

  // `variations` is NOT a Prisma column on Product — it was separated from
  // the mapped fields above and folded into `persistedAttributes` instead.
  // Prisma's JSON column type is `InputJsonValue`, which is structurally
  // stricter than `Record<string, unknown>`. We cast through InputJsonValue
  // because `persistedAttributes` legitimately only contains JSON-safe
  // values (strings + the `_variations` array of plain objects) but
  // TypeScript can't prove that the `unknown`-typed `_variations` entries
  // are JSON-serializable.
  const embeddingSource = {
    active: mappedFields.active,
    name: mappedFields.name,
    description: mappedFields.description,
    sku: mappedFields.sku,
    tags: mappedFields.tags,
    attributes: persistedAttributes,
    categoryId,
  }
  const embeddingChanged = !existing ||
    productEmbeddingSourceHash(existing) !== productEmbeddingSourceHash(embeddingSource)

  const updateData = {
    ...mappedFields,
    categoryId,
    sourceIntegrationId: integration.id,
    externalId,
    sourceUpdatedAt: updatedAt,
    sourceHash: hash,
    // Keep a valid vector when only price, stock, image or URL changed. Those
    // live values are loaded from Product after retrieval and never need to be
    // encoded into the semantic vector.
    embeddingUpdatedAt: embeddingChanged ? null : existing?.embeddingUpdatedAt ?? null,
    attributes: persistedAttributes as unknown as Prisma.InputJsonValue,
  }
  let saved: { id: string }
  try {
    if (!existing) {
      const capacity = await checkWorkspaceResourceCreateAllowed(integration.workspaceId, 'products')
      if (!capacity.allowed) throw new Error(`${capacity.reason}:${capacity.limit}`)
    }
    saved = existing
      ? await prisma.product.update({ where: { id: existing.id }, data: updateData, select: { id: true } })
      : await prisma.product.create({
          data: { workspaceId: integration.workspaceId, ...updateData },
          select: { id: true },
        })
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error
    saved = await prisma.product.update({ where: key, data: updateData, select: { id: true } })
  }

  const agentIds = options.agentIds ?? await allAgentIds(integration.workspaceId)
  await Promise.all([
    assignProduct(saved.id, agentIds),
    prisma.agent.updateMany({
      where: { workspaceId: integration.workspaceId, productAccessConfigured: false },
      data: { productAccessEnabled: true },
    }),
  ])
  if (embeddingChanged || !existing?.embeddingUpdatedAt) {
    await dispatchProductEmbed({ productId: saved.id, workspaceId: integration.workspaceId })
  }
  return { productId: saved.id, changed: true }
}

export async function syncWooProducts(
  integration: StoreIntegrationInput,
): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = []
  let products: WooProduct[]
  try {
    products = await fetchAllWoo<WooProduct>(integration.storeUrl, integration.credentials, 'products')
  } catch (error) {
    const message = errorMessage(error)
    await writeSyncLog({
      integrationId: integration.id,
      workspaceId: integration.workspaceId,
      direction: 'poll',
      entity: 'products',
      outcome: 'error',
      count: 0,
      message,
    })
    await markSync(integration.id, 'error', message)
    return { count: 0, errors: [message] }
  }

  const agentIds = await allAgentIds(integration.workspaceId)
  let count = 0
  for (const product of products) {
    try {
      await upsertProductFromWoo(integration, product, { agentIds })
      count++
    } catch (error) {
      errors.push(`product ${product.id}: ${errorMessage(error)}`)
    }
  }
  const outcome = errors.length === 0 ? 'ok' : 'error'
  await writeSyncLog({
    integrationId: integration.id,
    workspaceId: integration.workspaceId,
    direction: 'poll',
    entity: 'products',
    outcome,
    count,
    message: errors.length ? errors.join('\n').slice(0, 1000) : null,
  })
  await markSync(integration.id, outcome, errors[0] ?? null)
  return { count, errors }
}

function summarizeItems(items: NonNullable<WooOrder['line_items']>) {
  const summary = items
    .filter((item) => item.name)
    .slice(0, 10)
    .map((item) => `${item.quantity ?? 1}× ${item.name}`)
    .join('، ')
  return {
    summary,
    count: items.reduce((total, item) => total + (item.quantity ?? 0), 0),
  }
}

async function upsertOrderFromWoo(
  integration: StoreIntegrationInput,
  order: WooOrder,
): Promise<void> {
  if (!order?.id) throw new Error('INVALID_ORDER_PAYLOAD')
  const externalOrderId = String(order.id)
  const incomingUpdatedAt = orderUpdatedAt(order)
  const existing = await prisma.storeOrder.findUnique({
    where: { integrationId_externalOrderId: { integrationId: integration.id, externalOrderId } },
    select: { updatedAt: true },
  })
  if (incomingUpdatedAt && existing?.updatedAt && incomingUpdatedAt < existing.updatedAt) return
  if (!existing) {
    const capacity = await checkWorkspaceResourceCreateAllowed(integration.workspaceId, 'orders')
    if (!capacity.allowed) throw new Error(`${capacity.reason}:${capacity.limit}`)
  }
  const customerName = [order.billing?.first_name, order.billing?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
  const rawCustomerPhone = order.billing?.phone?.trim() || null
  const customerPhone = rawCustomerPhone
    ? normalizePhone(rawCustomerPhone) ?? rawCustomerPhone
    : null
  const customerEmail = order.billing?.email?.trim().toLowerCase() || null
  const byPhone = await findContactByPhone(integration.workspaceId, customerPhone)
  const byEmail = byPhone ? null : await findContactByEmail(integration.workspaceId, customerEmail)
  const { summary, count: itemCount } = summarizeItems(order.line_items ?? [])
  const orderDate = parseDate(order.date_created_gmt, true) ?? parseDate(order.date_created)

  // Extract shipping info. Prefer the v4.2.4+ shipping_info object; fall
  // back to the legacy top-level tracking_code for older plugins.
  const si = order.shipping_info ?? {}
  const trackingCode = (si.tracking_code ?? (order.tracking_code == null ? '' : String(order.tracking_code))).trim() || null
  const courierName = (si.courier_name ?? '').trim() || order.shipping?.method_title?.trim() || null
  const shippingDate = (si.shipping_date ?? '').trim() || null
  const trackingLink = (si.tracking_link ?? '').trim() || null
  const shippingNote = (si.shipping_note ?? '').trim() || null

  const data = {
    contactId: byPhone?.id ?? byEmail?.id ?? null,
    customerName: customerName || null,
    customerPhone,
    customerEmail,
    status: order.status ?? 'pending',
    total: Number.parseFloat(order.total ?? '0') || 0,
    currency: order.currency ?? 'IRR',
    itemCount,
    itemsSummary: summary || null,
    paymentMethod: order.payment_method_title || order.payment_method || null,
    shippingMethod: order.shipping?.method_title || null,
    trackingCode,
    courierName,
    shippingDate,
    trackingLink,
    shippingNote,
    orderDate,
    updatedAt: incomingUpdatedAt ?? new Date(),
  }
  await prisma.storeOrder.upsert({
    where: { integrationId_externalOrderId: { integrationId: integration.id, externalOrderId } },
    update: data,
    create: {
      integrationId: integration.id,
      workspaceId: integration.workspaceId,
      externalOrderId,
      ...data,
    },
  })
  if (!existing) {
    await prisma.agent.updateMany({
      where: { workspaceId: integration.workspaceId, orderTrackingConfigured: false },
      data: { orderTrackingEnabled: true },
    })
  }
}

/**
 * Delete a WooCommerce order from the Vigent panel DB.
 *
 * Called when the WP plugin sends an `order.deleted` webhook event.
 * This happens in two cases:
 *
 *   1. The shop owner trashes an order in the WP admin (WooCommerce fires
 *      wp_trash_post → on_order_delete → order.deleted).
 *
 *   2. (Most common) The order was cancelled — the v4.3.3+ plugin sends
 *      an `order.deleted` event whenever an order transitions to a status
 *      in EXCLUDED_ORDER_STATUSES (currently = cancelled). This way the
 *      cancelled order is removed from the Vigent agent's order list
 *      within ~5 minutes (the delta flush interval) instead of lingering
 *      forever with its last-known (non-cancelled) status.
 *
 * The lookup is by (integrationId, externalOrderId) — the same unique key
 * used by upsertOrderFromWoo. If the order doesn't exist in Vigent (e.g.
 * it was never synced, or was already deleted by the bulk-delete-cancelled
 * button), this is a no-op.
 *
 * @returns true if a row was deleted, false otherwise.
 */
async function deleteOrderFromWoo(
  integration: StoreIntegrationInput,
  payload: { id?: number | string; number?: string | number },
): Promise<boolean> {
  if (payload.id == null) return false
  const externalOrderId = String(payload.id)
  const existing = await prisma.storeOrder.findUnique({
    where: {
      integrationId_externalOrderId: {
        integrationId: integration.id,
        externalOrderId,
      },
    },
    select: { id: true },
  })
  if (!existing) return false
  await prisma.storeOrder.delete({ where: { id: existing.id } })
  return true
}

/**
 * Upsert a WooCommerce customer into the Vigent Contact table.
 *
 * Customers don't have their own table on the Vigent side — they map directly
 * onto the existing Contact model. This keeps the agent's view unified: a
 * customer who placed an order via WooCommerce and later messaged the agent
 * on WhatsApp shows up as ONE contact, with all conversations linked.
 *
 * Matching strategy (in priority order):
 *   1. By phone (normalized E.164). The most reliable identifier — phone
 *      numbers are unique per customer and rarely change.
 *   2. By email (lowercased). Stored as metadata.email — see findContactByEmail.
 *   3. By external WooCommerce user ID. We store this in metadata.wooCustomerId
 *      so subsequent syncs find the same contact even if the customer's phone
 *      or email changed on the store side.
 *
 * If no existing contact matches, we create a new one. The contact's `stage`
 * is set to 'customer' (not 'lead'), because the WordPress plugin only sends
 * users who already have at least one paid order — so they are real customers,
 * not prospects. The agent / operator can still move it to 'qualified' /
 * 'lost' / etc. later via the panel UI.
 *
 * @param integration The store integration (workspace + credentials).
 * @param customer The WooCommerce customer payload from the plugin.
 * @returns {Promise<{ contactId: string; created: boolean }>}
 */
async function upsertContactFromWoo(
  integration: StoreIntegrationInput,
  customer: WooCustomer,
): Promise<{ contactId: string; created: boolean }> {
  if (!customer?.id) throw new Error('INVALID_CUSTOMER_PAYLOAD')

  // Normalize phone + email once. Both are used for matching AND for write.
  const rawPhone = customer.phone?.trim() || null
  const phone = rawPhone ? normalizePhone(rawPhone) ?? rawPhone : null
  const email = customer.email?.trim().toLowerCase() || null
  const externalUserId = String(customer.id)

  // Build the display name: prefer first+last, fall back to display_name,
  // then email username, then phone. We never want a contact with no name
  // at all — the agent UI looks broken when a contact row has no name.
  const firstLast = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim()
  const name =
    firstLast ||
    customer.display_name?.trim() ||
    (email ? email.split('@')[0] : '') ||
    phone ||
    `مشتری #${externalUserId}`

  // Try to match an existing contact by phone, email, or externalId.
  // We look up all three in parallel to minimize latency.
  const byPhone = await findContactByPhone(integration.workspaceId, phone)
  const byEmail = byPhone ? null : await findContactByEmail(integration.workspaceId, email)
  let byExternalId: { id: string } | null = null
  if (!byPhone && !byEmail && externalUserId) {
    byExternalId = await prisma.contact.findFirst({
      where: {
        workspaceId: integration.workspaceId,
        metadata: { path: ['wooCustomerId'], equals: externalUserId },
      },
      select: { id: true },
    })
  }
  const existing = byPhone ?? byEmail ?? byExternalId

  // Build the metadata payload. We store the WooCommerce-specific fields
  // (external user ID, billing city, state, address, postcode, is_paying,
  // orders_count, total_spent) in metadata so they don't pollute the core
  // Contact columns. The core `phone` column is also updated so phone-based
  // matching works on subsequent syncs.
  const metadata: Record<string, unknown> = {
    wooCustomerId: externalUserId,
    wooStoreUrl: integration.storeUrl,
    source: 'woocommerce',
  }
  if (email) metadata.email = email
  if (customer.billing_city) metadata.billingCity = customer.billing_city
  if (customer.billing_state) metadata.billingState = customer.billing_state
  if (customer.billing_address_1) metadata.billingAddress = customer.billing_address_1
  if (customer.billing_postcode) metadata.billingPostcode = customer.billing_postcode
  if (typeof customer.is_paying === 'boolean') metadata.isPaying = customer.is_paying
  if (typeof customer.orders_count === 'number') metadata.ordersCount = customer.orders_count
  if (typeof customer.total_spent === 'number' && !Number.isNaN(customer.total_spent)) {
    metadata.totalSpent = customer.total_spent
  }

  if (existing) {
    // Update the existing contact. We merge metadata rather than replacing it,
    // so we don't blow away fields set by the agent UI or by other channels
    // (e.g. WhatsApp username, marketing opt-in).
    const current = await prisma.contact.findUnique({
      where: { id: existing.id },
      select: { metadata: true, name: true, phone: true, lastActivityAt: true, tags: true },
    })
    const mergedMetadata = {
      ...(current?.metadata && typeof current.metadata === 'object'
        ? (current.metadata as Record<string, unknown>)
        : {}),
      ...metadata,
    } as Prisma.InputJsonValue
    // Ensure the WooCommerce source tag is present. We only add it when
    // missing — never remove tags the operator may have set manually.
    const existingTags = current?.tags ?? []
    const mergedTags = existingTags.includes(WOO_SOURCE_TAG)
      ? undefined
      : [...existingTags, WOO_SOURCE_TAG]
    await prisma.contact.update({
      where: { id: existing.id },
      data: {
        // Only update the name if we have a non-empty one. We don't want
        // to overwrite a name the customer set via chat with a stale one
        // from WooCommerce.
        ...(name ? { name } : {}),
        // Only update phone if we have a new one AND the existing one is
        // empty. We never overwrite a phone that was set by the customer
        // via the chat UI.
        ...(phone && !current?.phone ? { phone } : {}),
        ...(mergedTags ? { tags: mergedTags } : {}),
        metadata: mergedMetadata,
        // Bump lastActivityAt so this contact surfaces in the "recently
        // active" list — but only if it was null before. We don't want
        // a customer sync to override a real chat lastActivityAt.
        ...(current && !current.lastActivityAt ? { lastActivityAt: new Date() } : {}),
      },
    })
    return { contactId: existing.id, created: false }
  }

  const capacity = await checkWorkspaceResourceCreateAllowed(integration.workspaceId, 'customers')
  if (!capacity.allowed) throw new Error(`${capacity.reason}:${capacity.limit}`)

  // Create a new contact. We pass `phone` if we have one — this is the
  // primary key for matching future messages from the same customer.
  const created = await prisma.contact.create({
    data: {
      workspaceId: integration.workspaceId,
      name: name || null,
      phone: phone || null,
      // Tag the contact with its source so the CRM UI can show a Woo badge
      // alongside the channel badges (Telegram, Bale, etc.).
      tags: [WOO_SOURCE_TAG],
      metadata: metadata as Prisma.InputJsonValue,
      // New customers from WooCommerce already have a successful order
      // (the WordPress plugin filters to customers with ≥1 paid order),
      // so they enter the pipeline directly at the 'customer' stage
      // rather than starting as a 'lead' that the operator must promote.
      stage: 'customer',
      // Set lastActivityAt to now so the contact shows up in the "recently
      // active" list immediately after sync.
      lastActivityAt: new Date(),
    },
    select: { id: true },
  })
  return { contactId: created.id, created: true }
}

export async function syncWooOrders(
  integration: StoreIntegrationInput,
  options: { sinceDays?: number } = {},
): Promise<{ count: number }> {
  const params: Record<string, string | number> = {}
  if (options.sinceDays && options.sinceDays > 0) {
    params.after = new Date(Date.now() - options.sinceDays * 86_400_000).toISOString()
  }
  let orders: WooOrder[]
  try {
    orders = await fetchAllWoo<WooOrder>(integration.storeUrl, integration.credentials, 'orders', params)
  } catch (error) {
    const message = errorMessage(error)
    await writeSyncLog({
      integrationId: integration.id,
      workspaceId: integration.workspaceId,
      direction: 'poll',
      entity: 'orders',
      outcome: 'error',
      count: 0,
      message,
    })
    await markSync(integration.id, 'error', message)
    return { count: 0 }
  }

  const errors: string[] = []
  let count = 0
  for (const order of orders) {
    try {
      await upsertOrderFromWoo(integration, order)
      count++
    } catch (error) {
      errors.push(`order ${order.id}: ${errorMessage(error)}`)
    }
  }
  const outcome = errors.length === 0 ? 'ok' : 'error'
  await writeSyncLog({
    integrationId: integration.id,
    workspaceId: integration.workspaceId,
    direction: 'poll',
    entity: 'orders',
    outcome,
    count,
    message: errors.length ? errors.join('\n').slice(0, 1000) : null,
  })
  await markSync(integration.id, outcome, errors[0] ?? null)
  return { count }
}

async function deleteProductFromWoo(
  integration: StoreIntegrationInput,
  payload: { id?: number | string; sku?: string; name?: string },
  changedAt?: string,
): Promise<boolean> {
  if (payload.id == null) return false
  const externalId = String(payload.id)
  let product = await prisma.product.findUnique({
    where: {
      sourceIntegrationId_externalId: {
        sourceIntegrationId: integration.id,
        externalId,
      },
    },
    select: { id: true, sourceUpdatedAt: true, embeddingUpdatedAt: true, active: true },
  })
  if (!product) {
    const legacy = await findLegacyProduct(
      integration.workspaceId,
      payload.sku?.trim() || null,
      payload.name?.trim() || '',
    )
    if (legacy) product = { ...legacy, active: true }
  }
  if (!product) return false
  const deletedAt = parseDate(changedAt)
  if (deletedAt && product.sourceUpdatedAt && deletedAt < product.sourceUpdatedAt) return false
  const links = await prisma.agentCatalog.findMany({
    where: { productId: product.id },
    select: { agentId: true },
  })
  if (product.active) {
    await prisma.product.update({
      where: { id: product.id },
      data: {
        sourceIntegrationId: integration.id,
        externalId,
        sourceUpdatedAt: deletedAt ?? new Date(),
        sourceHash: sourceHash({ deleted: true, externalId }),
        embeddingUpdatedAt: null,
        active: false,
      },
    })
  } else if (product.embeddingUpdatedAt) {
    return false
  }
  await dispatchProductEmbed({
    productId: product.id,
    workspaceId: integration.workspaceId,
    agentIds: links.map((link) => link.agentId),
    deleted: true,
  })
  return true
}

export async function processWebhookEvent(
  integration: StoreIntegrationInput,
  event: WooWebhookEvent,
  agentIds: string[],
): Promise<number> {
  if (event.topic === 'product.created' || event.topic === 'product.updated') {
    await upsertProductFromWoo(integration, event.data as WooProduct, {
      agentIds,
      changedAt: event.changedAt,
    })
    return 1
  }
  if (event.topic === 'product.deleted') {
    return await deleteProductFromWoo(
      integration,
      event.data as { id?: number | string; sku?: string; name?: string },
      event.changedAt,
    ) ? 1 : 0
  }
  if (event.topic === 'order.created' || event.topic === 'order.updated') {
    await upsertOrderFromWoo(integration, event.data as WooOrder)
    return 1
  }
  if (event.topic === 'order.deleted') {
    // Sent by the v4.3.3+ WP plugin when an order is trashed OR when an
    // order transitions to a status in EXCLUDED_ORDER_STATUSES (currently
    // = cancelled). We physically delete the row from the panel DB so the
    // agent's order list doesn't get polluted with dead rows. See
    // deleteOrderFromWoo() above for the full rationale.
    return await deleteOrderFromWoo(
      integration,
      event.data as { id?: number | string; number?: string | number },
    ) ? 1 : 0
  }
  // v4.2.9+ — customer sync. The plugin sends customer.updated whenever a
  // WP user with the 'customer' role is created or modified. We map it onto
  // the existing Contact model (see upsertContactFromWoo for the matching
  // strategy). Customer deletes are NOT sent — WordPress doesn't fire a
  // clean hook for them, and the plugin deliberately skips delete events.
  if (event.topic === 'customer.updated' || event.topic === 'customer.created') {
    await upsertContactFromWoo(integration, event.data as WooCustomer)
    return 1
  }
  if (event.topic === 'test.connection' || event.topic === 'connection.test') {
    const details = event.data && typeof event.data === 'object'
      ? event.data as Record<string, unknown>
      : {}
    const pluginVersion = typeof details.plugin_version === 'string'
      ? details.plugin_version
      : typeof details.version === 'string'
        ? details.version
        : undefined
    await prisma.storeIntegration.update({
      where: { id: integration.id },
      data: {
        active: true,
        connectedAt: new Date(),
        lastWebhookAt: new Date(),
        lastSyncAt: new Date(),
        lastSyncStatus: 'ok',
        lastSyncError: null,
        ...(pluginVersion ? { pluginVersion } : {}),
      },
    })
    return 1
  }
  if (event.topic === 'connection.disconnected') {
    await prisma.storeIntegration.update({
      where: { id: integration.id },
      data: {
        active: false,
        lastWebhookAt: new Date(),
        lastSyncAt: new Date(),
        lastSyncStatus: 'disconnected',
        lastSyncError: null,
      },
    })
    return 1
  }
  console.warn(`[woocommerce] ignored unsupported webhook topic: ${event.topic}`)
  return 0
}

/** Process an already-authenticated durable delivery. Retrying is safe. */
export async function processWooWebhookBatch(job: WooWebhookBatchJobData): Promise<void> {
  const delivery = await prisma.storeWebhookDelivery.findUnique({
    where: {
      integrationId_deliveryId: {
        integrationId: job.integrationId,
        deliveryId: job.deliveryId,
      },
    },
    select: { id: true, status: true },
  })
  if (!delivery) throw new Error('WEBHOOK_DELIVERY_NOT_FOUND')
  if (delivery.status === 'processed') return

  const row = await prisma.storeIntegration.findUnique({
    where: { id: job.integrationId },
    select: { id: true, workspaceId: true, storeUrl: true },
  })
  if (!row || row.workspaceId !== job.workspaceId) throw new Error('INTEGRATION_NOT_FOUND')
  const integration: StoreIntegrationInput = {
    ...row,
    credentials: { consumerKey: '', consumerSecret: '' },
  }
  await prisma.storeWebhookDelivery.update({
    where: { id: delivery.id },
    data: { status: 'processing', error: null },
  })

  try {
    const agentIds = await allAgentIds(integration.workspaceId)
    let count = 0
    for (const event of job.events) count += await processWebhookEvent(integration, event, agentIds)
    const now = new Date()
    const disconnected = job.events.some((event) => event.topic === 'connection.disconnected')
    await prisma.$transaction([
      prisma.storeWebhookDelivery.update({
        where: { id: delivery.id },
        data: { status: 'processed', processedAt: now, error: null },
      }),
      prisma.storeIntegration.update({
        where: { id: integration.id },
        data: {
          lastWebhookAt: now,
          lastSyncAt: now,
          lastSyncStatus: disconnected ? 'disconnected' : 'ok',
          lastSyncError: null,
          ...(job.pluginVersion ? { pluginVersion: job.pluginVersion } : {}),
        },
      }),
    ])
    await writeSyncLog({
      integrationId: integration.id,
      workspaceId: integration.workspaceId,
      direction: 'push',
      entity: 'batch',
      outcome: 'ok',
      count,
      message: `${job.events.length} event(s)`,
    })
  } catch (error) {
    const message = errorMessage(error).slice(0, 1000)
    await Promise.all([
      prisma.storeWebhookDelivery.update({
        where: { id: delivery.id },
        data: { status: 'error', error: message },
      }).catch(() => undefined),
      prisma.storeIntegration.update({
        where: { id: integration.id },
        data: { lastWebhookAt: new Date(), lastSyncStatus: 'error', lastSyncError: message },
      }).catch(() => undefined),
      writeSyncLog({
        integrationId: integration.id,
        workspaceId: integration.workspaceId,
        direction: 'push',
        entity: 'batch',
        outcome: 'error',
        count: 0,
        message,
      }),
    ])
    throw error
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function writeSyncLog(input: {
  integrationId: string
  workspaceId: string
  direction: string
  entity: string
  outcome: string
  count: number
  message: string | null
}): Promise<void> {
  try {
    await prisma.storeSyncLog.create({ data: input })
  } catch (error) {
    console.error('[woocommerce] failed to write sync log:', error)
  }
}

async function markSync(
  integrationId: string,
  status: 'ok' | 'error',
  error: string | null,
): Promise<void> {
  try {
    await prisma.storeIntegration.update({
      where: { id: integrationId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: status,
        lastSyncError: error,
      },
    })
  } catch (updateError) {
    console.error('[woocommerce] failed to mark sync status:', updateError)
  }
}
