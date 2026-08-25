import crypto from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import { normalizePhone } from '@/lib/phone'
import { dispatchProductEmbed } from '@/lib/queue/jobs'
import type { WooWebhookBatchJobData, WooWebhookEvent } from '@/lib/queue/jobs'
import { safeHttpGet } from '@/lib/security/safe-http'

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
  const attributes: Record<string, string> = {}
  for (const attribute of product.attributes ?? []) {
    if (!attribute.name) continue
    attributes[attribute.name] = Array.isArray(attribute.options)
      ? attribute.options.map(String).join(', ')
      : attribute.options == null
        ? ''
        : String(attribute.options)
  }
  return {
    name: product.name,
    description: (product.short_description || product.description || '').slice(0, 4000) || null,
    price: effectivePrice,
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
} | null> {
  if (sku) {
    const bySku = await prisma.product.findMany({
      where: { workspaceId, sourceIntegrationId: null, sku },
      select: { id: true, sourceHash: true, sourceUpdatedAt: true, embeddingUpdatedAt: true },
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
      select: { id: true, sourceHash: true, sourceUpdatedAt: true, embeddingUpdatedAt: true },
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
  const categoryId = await upsertWooCategories(integration, product.categories ?? [])
  const updatedAt = productUpdatedAt(product, options.changedAt)
  const hash = sourceHash({
    ...mapped,
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
    select: { id: true, sourceHash: true, sourceUpdatedAt: true, embeddingUpdatedAt: true },
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

  const updateData = {
    ...mapped,
    categoryId,
    sourceIntegrationId: integration.id,
    externalId,
    sourceUpdatedAt: updatedAt,
    sourceHash: hash,
    embeddingUpdatedAt: null,
    attributes: mapped.attributes,
  }
  let saved: { id: string }
  try {
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
  await assignProduct(saved.id, agentIds)
  await dispatchProductEmbed({ productId: saved.id, workspaceId: integration.workspaceId })
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
  if (incomingUpdatedAt) {
    const existing = await prisma.storeOrder.findUnique({
      where: { integrationId_externalOrderId: { integrationId: integration.id, externalOrderId } },
      select: { updatedAt: true },
    })
    if (existing?.updatedAt && incomingUpdatedAt < existing.updatedAt) return
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

  // Enforce per-integration order retention. Stores with thousands of
  // historical orders would otherwise bloat the panel's DB forever. We keep
  // at most MAX_ORDERS_PER_INTEGRATION orders per integration, deleting the
  // oldest (by orderDate, then createdAt as tiebreaker) when the cap is
  // exceeded. New orders always survive because they have the newest dates.
  // Run after every upsert so the cap is enforced incrementally — no need
  // for a separate cron job.
  await enforceOrderRetention(integration.id)
}

/**
 * Maximum number of orders to retain per integration in the panel DB.
 *
 * The plugin syncs at most 1000 orders (MAX_ORDERS_TO_SYNC) during a full
 * push, but a busy store can receive many more orders over time via the
 * delta queue. To keep the panel responsive and the DB bounded, we cap the
 * stored orders per integration at MAX_ORDERS_PER_INTEGRATION. When the cap
 * is exceeded, the oldest orders (by orderDate) are deleted.
 *
 * Set to 2000 as requested by the product owner — enough history for the
 * agent to answer "where is my order?" questions, while keeping the orders
 * page fast and the DB small.
 */
const MAX_ORDERS_PER_INTEGRATION = 2000

/**
 * Delete the oldest orders for an integration when the count exceeds the cap.
 *
 * Uses a single DELETE ... WHERE id IN (SELECT id FROM ... ORDER BY orderDate
 * ASC LIMIT N) query — efficient even on large tables because the
 * integrationId index keeps the count + sort fast.
 *
 * Runs inside upsertOrderFromWoo after each upsert, so retention is enforced
 * incrementally. On a sync of 1000 orders, this runs 1000 times — but each
 * call only does work when the cap is exceeded, which is at most once per
 * batch (after that the count stays at or below the cap).
 */
async function enforceOrderRetention(integrationId: string): Promise<void> {
  const count = await prisma.storeOrder.count({ where: { integrationId } })
  if (count <= MAX_ORDERS_PER_INTEGRATION) return

  const excess = count - MAX_ORDERS_PER_INTEGRATION
  // Delete the oldest `excess` orders. We order by orderDate ASC (oldest
  // first), then createdAt ASC as a tiebreaker for orders with null orderDate.
  // Using a subquery to fetch IDs first is safer than DELETE ... ORDER BY ...
  // LIMIT (which MySQL supports but Postgres doesn't).
  const oldOrderIds = await prisma.storeOrder.findMany({
    where: { integrationId },
    orderBy: [{ orderDate: 'asc' }, { createdAt: 'asc' }],
    take: excess,
    select: { id: true },
  })
  if (oldOrderIds.length === 0) return

  await prisma.storeOrder.deleteMany({
    where: { id: { in: oldOrderIds.map((o) => o.id) } },
  })
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

async function processWebhookEvent(
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
