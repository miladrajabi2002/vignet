import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import { processProductEmbed } from '@/lib/products/catalog'
import { normalizePhone } from '@/lib/phone'

/**
 * WooCommerce + generic store integration logic (F2).
 *
 * Two flows feed the workspace's `Product` catalog and `StoreOrder` mirror:
 *   1. Poll — `syncWooProducts` / `syncWooOrders` walk the WC REST API and
 *      upsert rows in batches. Driven by the scheduler (`worker/scheduler.ts`)
 *      and the manual "sync now" button (`GET /api/sync/woocommerce`).
 *   2. Push — the WP plugin signs each product/order change with HMAC-SHA256
 *      and POSTs to `/api/sync/woocommerce?token=<webhookSecret>`. We verify
 *      the signature against the raw body, then route by the
 *      `X-WC-Webhook-Topic` header.
 *
 * Credentials live encrypted inside `StoreIntegration.credentials` (AES-256-GCM
 * via `lib/crypto`). This module never sees the ciphertext — callers hand it
 * the decrypted `WooCredentials` (see `resolveWooCredentials`).
 */

export const WOOCOMMERCE_REST_PER_PAGE = 100

export interface WooCredentials {
        consumerKey: string
        consumerSecret: string
}

/** Minimal slice of a StoreIntegration row the sync functions need. */
export interface StoreIntegrationInput {
        id: string
        workspaceId: string
        storeUrl: string
        credentials: WooCredentials
}

/** Per-item shape returned by the WC /products endpoint (subset we use). */
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
        images?: { src?: string }[]
        tags?: { name?: string }[]
        attributes?: {
                name?: string
                options?: string[]
        }[]
}

/** Per-item shape returned by the WC /orders endpoint (subset we use). */
interface WooOrder {
        id: number
        number?: string
        status?: string
        currency?: string
        total?: string
        payment_method?: string
        payment_method_title?: string
        date_created?: string
        date_created_gmt?: string
        customer_id?: number
        billing?: {
                first_name?: string
                last_name?: string
                phone?: string
                email?: string
        }
        shipping?: {
                method_title?: string
        }
        line_items?: {
                name?: string
                quantity?: number
                total?: string
                sku?: string
        }[]
}

// ─── credentials ────────────────────────────────────────────────────────────

/**
 * Resolve decrypted WooCommerce credentials from a raw JSON value pulled off
 * the StoreIntegration row. Accepts either a plaintext `consumerSecret` (dev)
 * or an encrypted `consumerSecretEnc` payload (production). Throws on missing
 * fields so callers fail loudly instead of silently 401'ing against the WC API.
 */
export function resolveWooCredentials(raw: unknown): WooCredentials {
        if (!raw || typeof raw !== 'object') {
                throw new Error('Invalid WooCommerce credentials payload')
        }
        const obj = raw as Record<string, unknown>
        const consumerKey = typeof obj.consumerKey === 'string' ? obj.consumerKey : ''
        let consumerSecret = ''
        if (typeof obj.consumerSecret === 'string') {
                consumerSecret = obj.consumerSecret
        } else if (typeof obj.consumerSecretEnc === 'string') {
                consumerSecret = decrypt(obj.consumerSecretEnc)
        }
        if (!consumerKey || !consumerSecret) {
                throw new Error('Missing WooCommerce consumerKey/consumerSecret')
        }
        return { consumerKey, consumerSecret }
}

// ─── HMAC webhook signature verification ────────────────────────────────────

/**
 * Verify a WooCommerce webhook signature. WooCommerce signs the raw request
 * body with HMAC-SHA256 using the webhook secret, and sends the hex digest in
 * the `X-WC-Webhook-Signature` header. We compare in constant time to avoid
 * timing-oracle attacks on the secret.
 */
export function verifyWooWebhookSignature(
        rawBody: string,
        signature: string,
        secret: string,
): boolean {
        if (!rawBody || !signature || !secret) return false
        const expected = crypto
                .createHmac('sha256', secret)
                .update(rawBody, 'utf8')
                .digest('hex')
        const a = Buffer.from(expected, 'utf8')
        const b = Buffer.from(signature, 'utf8')
        if (a.length !== b.length) return false
        return crypto.timingSafeEqual(a, b)
}

// ─── contact match helpers ──────────────────────────────────────────────────

/** Find a workspace contact by normalized phone (E.164). Returns null if no match. */
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

/** Find a workspace contact by email (case-insensitive). Returns null if no match. */
export async function findContactByEmail(
        workspaceId: string,
        email: string | null | undefined,
) {
        if (!email) return null
        const trimmed = email.trim().toLowerCase()
        if (!trimmed) return null
        return prisma.contact.findFirst({
                where: { workspaceId, metadata: { path: ['email'], equals: trimmed } },
                select: { id: true },
        })
}

// ─── internal HTTP helpers ──────────────────────────────────────────────────

function authHeader(creds: WooCredentials): string {
        const token = Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString(
                'base64',
        )
        return `Basic ${token}`
}

/** Strip trailing slash from a store URL so endpoint joining is predictable. */
function normalizeStoreUrl(storeUrl: string): string {
        return storeUrl.replace(/\/+$/, '')
}

const FETCH_TIMEOUT_MS = 30_000

/** Fetch one JSON page from the WC REST API. Throws on non-2xx. */
async function fetchWooJson<T>(
        storeUrl: string,
        creds: WooCredentials,
        path: string,
        params: Record<string, string | number>,
): Promise<T[]> {
        const url = new URL(
                `${normalizeStoreUrl(storeUrl)}/wp-json/wc/v3/${path}`,
        )
        for (const [k, v] of Object.entries(params)) {
                url.searchParams.set(k, String(v))
        }
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
        try {
                const res = await fetch(url.toString(), {
                        headers: {
                                Authorization: authHeader(creds),
                                Accept: 'application/json',
                                'User-Agent': 'VigentSync/1.0',
                        },
                        signal: controller.signal,
                        cache: 'no-store',
                })
                if (!res.ok) {
                        const body = await res.text().catch(() => '')
                        throw new Error(`WC ${path} HTTP ${res.status}: ${body.slice(0, 200)}`)
                }
                const json = (await res.json()) as unknown
                return Array.isArray(json) ? (json as T[]) : []
        } finally {
                clearTimeout(timer)
        }
}

/** Iterate every page of a WC collection until a page returns fewer than PER_PAGE. */
async function fetchAllWoo<T>(
        storeUrl: string,
        creds: WooCredentials,
        path: string,
        extra: Record<string, string | number> = {},
): Promise<T[]> {
        const out: T[] = []
        let page = 1
        // Safety cap: 50 pages × 100 = 5 000 items. Stores bigger than that should
        // rely on webhooks rather than the polling fallback.
        for (let i = 0; i < 50; i++) {
                const batch = await fetchWooJson<T>(storeUrl, creds, path, {
                        ...extra,
                        per_page: WOOCOMMERCE_REST_PER_PAGE,
                        page,
                })
                out.push(...batch)
                if (batch.length < WOOCOMMERCE_REST_PER_PAGE) break
                page++
        }
        return out
}

// ─── product sync ───────────────────────────────────────────────────────────

/** Convert a WC product payload to our Product field shape. */
function mapWooProduct(p: WooProduct) {
        const price = parseFloat(p.price ?? '')
        const regularPrice = parseFloat(p.regular_price ?? '')
        const comparePrice = !isNaN(regularPrice) && regularPrice > 0 ? regularPrice : null
        const effectivePrice = !isNaN(price) && price > 0 ? price : comparePrice
        const stock =
                p.manage_stock === true && p.stock_quantity != null ? p.stock_quantity : null
        const images = (p.images ?? [])
                .map((i) => i.src)
                .filter((s): s is string => typeof s === 'string' && s.length > 0)
        const tags = (p.tags ?? [])
                .map((t) => t.name)
                .filter((n): n is string => typeof n === 'string' && n.length > 0)
        const attrs: Record<string, string> = {}
        for (const a of p.attributes ?? []) {
                if (!a.name) continue
                attrs[a.name] = (a.options ?? []).join(', ')
        }
        return {
                name: p.name,
                description: (p.short_description || p.description || '').slice(0, 4000) || null,
                price: effectivePrice,
                comparePrice,
                sku: p.sku || null,
                stock,
                images,
                tags,
                attributes: attrs,
                status: p.status,
        }
}

/**
 * Pull every product from the WC REST API and upsert it into the workspace's
 * `Product` table. Each product is re-embedded inline (the embed function is
 * idempotent — it deletes old chunks before inserting new ones). Per-item
 * failures are collected into `errors` so a single bad row doesn't abort the
 * batch. A `StoreSyncLog` row is written with the outcome.
 */
export async function syncWooProducts(
        integration: StoreIntegrationInput,
): Promise<{ count: number; errors: string[] }> {
        const { id: integrationId, workspaceId, storeUrl, credentials } = integration
        const errors: string[] = []
        let count = 0

        let products: WooProduct[]
        try {
                products = await fetchAllWoo<WooProduct>(storeUrl, credentials, 'products')
        } catch (e) {
                const msg = e instanceof Error ? e.message : String(e)
                await writeSyncLog({
                        integrationId,
                        workspaceId,
                        direction: 'poll',
                        entity: 'products',
                        outcome: 'error',
                        count: 0,
                        message: msg,
                })
                await markSync(integrationId, 'error', msg)
                return { count: 0, errors: [msg] }
        }

        for (const wp of products) {
                try {
                        const data = mapWooProduct(wp)
                        // Match by SKU first (the stable business key); fall back to name when
                        // the store doesn't use SKUs.
                        const existing = await prisma.product.findFirst({
                                where: {
                                        workspaceId,
                                        OR: [
                                                ...(data.sku ? [{ sku: data.sku }] : []),
                                                { name: data.name },
                                        ],
                                },
                                select: { id: true },
                        })

                        const product = existing
                                ? await prisma.product.update({
                                                where: { id: existing.id },
                                                data: {
                                                        ...data,
                                                        active: data.status !== 'draft',
                                                        attributes: data.attributes,
                                                },
                                        })
                                : await prisma.product.create({
                                                data: {
                                                        workspaceId,
                                                        ...data,
                                                        active: data.status !== 'draft',
                                                        attributes: data.attributes,
                                                },
                                        })

                        // Auto-assign to every agent in the workspace so the catalog stays in
                        // sync without a manual visit to each agent's catalog page.
                        const agents = await prisma.agent.findMany({
                                where: { workspaceId },
                                select: { id: true },
                        })
                        if (agents.length > 0) {
                                await prisma.agentCatalog.createMany({
                                        data: agents.map((a) => ({ agentId: a.id, productId: product.id })),
                                        skipDuplicates: true,
                                })
                        }

                        // Re-embed inline (the task calls for this — runs in the API route
                        // or worker, not via the queue). Failure here is non-fatal.
                        try {
                                await processProductEmbed({
                                        productId: product.id,
                                        workspaceId,
                                })
                        } catch (embedErr) {
                                errors.push(
                                        `embed failed for product ${wp.id}: ${embedErr instanceof Error ? embedErr.message : String(embedErr)}`,
                                )
                        }
                        count++
                } catch (e) {
                        errors.push(
                                `product ${wp.id}: ${e instanceof Error ? e.message : String(e)}`,
                        )
                }
        }

        await writeSyncLog({
                integrationId,
                workspaceId,
                direction: 'poll',
                entity: 'products',
                outcome: errors.length === 0 ? 'ok' : 'error',
                count,
                message: errors.length ? errors.join('\n').slice(0, 1000) : null,
        })
        await markSync(integrationId, errors.length === 0 ? 'ok' : 'error', errors[0] ?? null)
        return { count, errors }
}

// ─── order sync ─────────────────────────────────────────────────────────────

/** Build a short human-readable line-item summary (Persian). */
function summarizeItems(
        items: { name?: string; quantity?: number; total?: string; sku?: string }[],
): { summary: string; count: number } {
        if (!items || items.length === 0) return { summary: '', count: 0 }
        const parts = items
                .filter((i) => i.name)
                .slice(0, 10)
                .map((i) => `${i.quantity ?? 1}× ${i.name}`)
        const total = items.reduce((acc, i) => acc + (i.quantity ?? 0), 0)
        return { summary: parts.join('، '), count: total }
}

/**
 * Pull orders from the WC REST API and upsert them into `StoreOrder`. Tries to
 * match each order's customer phone/email to a `Contact` and link via
 * `contactId` so the agent can answer "where is my order?" against the right
 * customer record. A `StoreSyncLog` row is written with the outcome.
 */
export async function syncWooOrders(
        integration: StoreIntegrationInput,
        opts: { sinceDays?: number } = {},
): Promise<{ count: number }> {
        const { id: integrationId, workspaceId, storeUrl, credentials } = integration
        const errors: string[] = []
        let count = 0

        const params: Record<string, string | number> = {}
        if (opts.sinceDays && opts.sinceDays > 0) {
                const after = new Date(Date.now() - opts.sinceDays * 24 * 60 * 60 * 1000)
                params.after = after.toISOString()
        }

        let orders: WooOrder[]
        try {
                orders = await fetchAllWoo<WooOrder>(storeUrl, credentials, 'orders', params)
        } catch (e) {
                const msg = e instanceof Error ? e.message : String(e)
                await writeSyncLog({
                        integrationId,
                        workspaceId,
                        direction: 'poll',
                        entity: 'orders',
                        outcome: 'error',
                        count: 0,
                        message: msg,
                })
                await markSync(integrationId, 'error', msg)
                return { count: 0 }
        }

        for (const wo of orders) {
                try {
                        const externalOrderId = String(wo.id)
                        const customerName = [wo.billing?.first_name, wo.billing?.last_name]
                                .filter(Boolean)
                                .join(' ')
                                .trim()
                        const customerPhone = wo.billing?.phone?.trim() || null
                        const customerEmail = wo.billing?.email?.trim().toLowerCase() || null
                        const total = parseFloat(wo.total ?? '0') || 0
                        const { summary, count: itemCount } = summarizeItems(wo.line_items ?? [])

                        // Try to link the order to an existing Contact (by phone, then email).
                        let contactId: string | null = null
                        const byPhone = await findContactByPhone(workspaceId, customerPhone)
                        if (byPhone) {
                                contactId = byPhone.id
                        } else if (customerEmail) {
                                const byEmail = await findContactByEmail(workspaceId, customerEmail)
                                if (byEmail) contactId = byEmail.id
                        }

                        const orderDate = wo.date_created_gmt
                                ? new Date(wo.date_created_gmt + 'Z')
                                : wo.date_created
                                        ? new Date(wo.date_created)
                                        : null

                        await prisma.storeOrder.upsert({
                                where: {
                                        integrationId_externalOrderId: { integrationId, externalOrderId },
                                },
                                update: {
                                        contactId,
                                        customerName: customerName || null,
                                        customerPhone,
                                        customerEmail,
                                        status: wo.status ?? 'pending',
                                        total,
                                        currency: wo.currency ?? 'IRR',
                                        itemCount: itemCount,
                                        itemsSummary: summary || null,
                                        paymentMethod: wo.payment_method_title || wo.payment_method || null,
                                        shippingMethod: wo.shipping?.method_title || null,
                                        orderDate,
                                        updatedAt: new Date(),
                                },
                                create: {
                                        integrationId,
                                        workspaceId,
                                        externalOrderId,
                                        contactId,
                                        customerName: customerName || null,
                                        customerPhone,
                                        customerEmail,
                                        status: wo.status ?? 'pending',
                                        total,
                                        currency: wo.currency ?? 'IRR',
                                        itemCount: itemCount,
                                        itemsSummary: summary || null,
                                        paymentMethod: wo.payment_method_title || wo.payment_method || null,
                                        shippingMethod: wo.shipping?.method_title || null,
                                        orderDate,
                                },
                        })
                        count++
                } catch (e) {
                        errors.push(`order ${wo.id}: ${e instanceof Error ? e.message : String(e)}`)
                }
        }

        await writeSyncLog({
                integrationId,
                workspaceId,
                direction: 'poll',
                entity: 'orders',
                outcome: errors.length === 0 ? 'ok' : 'error',
                count,
                message: errors.length ? errors.join('\n').slice(0, 1000) : null,
        })
        await markSync(integrationId, errors.length === 0 ? 'ok' : 'error', errors[0] ?? null)
        return { count }
}

// ─── webhook handler ────────────────────────────────────────────────────────

/**
 * Handle a single inbound webhook event from the WP plugin. Routes by the
 * `X-WC-Webhook-Topic` header (passed in as `topic`):
 *
 *   product.created  → upsert Product + re-embed
 *   product.updated  → upsert Product + re-embed
 *   product.deleted  → soft-delete Product (active=false) + remove chunks
 *   order.created    → upsert StoreOrder
 *   order.updated    → upsert StoreOrder
 *
 * The signature has already been verified by the route handler before this is
 * called. A `StoreSyncLog` row is written per event.
 */
export async function handleWooWebhook(
        integration: StoreIntegrationInput,
        payload: { topic: string; data: unknown },
): Promise<void> {
        const { id: integrationId, workspaceId } = integration
        const topic = payload.topic
        const data = payload.data

        const entity =
                topic.startsWith('product.') ? 'product_update' : 'order_update'

        try {
                if (topic === 'product.created' || topic === 'product.updated') {
                        const wp = data as WooProduct
                        if (wp && wp.id) {
                                await upsertProductFromWoo(integration, wp)
                        }
                } else if (topic === 'product.deleted') {
                        const wp = data as { id?: number; sku?: string; name?: string }
                        if (wp && wp.id) {
                                await deleteProductFromWoo(integration, wp)
                        }
                } else if (topic === 'order.created' || topic === 'order.updated') {
                        const wo = data as WooOrder
                        if (wo && wo.id) {
                                await upsertOrderFromWoo(integration, wo)
                        }
                } else {
                        // Unknown topic — log and bail. Don't fail the webhook (we still 200
                        // so the plugin doesn't retry-storm).
                        await writeSyncLog({
                                integrationId,
                                workspaceId,
                                direction: 'push',
                                entity,
                                outcome: 'error',
                                count: 0,
                                message: `Unknown webhook topic: ${topic}`,
                        })
                        return
                }

                await writeSyncLog({
                        integrationId,
                        workspaceId,
                        direction: 'push',
                        entity,
                        outcome: 'ok',
                        count: 1,
                        message: topic,
                })
        } catch (e) {
                const msg = e instanceof Error ? e.message : String(e)
                await writeSyncLog({
                        integrationId,
                        workspaceId,
                        direction: 'push',
                        entity,
                        outcome: 'error',
                        count: 0,
                        message: `${topic}: ${msg}`.slice(0, 1000),
                })
                throw e
        }
}

/** Upsert a single product (webhook path) and re-embed inline. */
async function upsertProductFromWoo(
        integration: StoreIntegrationInput,
        wp: WooProduct,
): Promise<void> {
        const { workspaceId } = integration
        const data = mapWooProduct(wp)

        const existing = await prisma.product.findFirst({
                where: {
                        workspaceId,
                        OR: [
                                ...(data.sku ? [{ sku: data.sku }] : []),
                                { name: data.name },
                        ],
                },
                select: { id: true },
        })

        const product = existing
                ? await prisma.product.update({
                                where: { id: existing.id },
                                data: {
                                        ...data,
                                        active: data.status !== 'draft',
                                        attributes: data.attributes,
                                },
                        })
                : await prisma.product.create({
                                data: {
                                        workspaceId,
                                        ...data,
                                        active: data.status !== 'draft',
                                        attributes: data.attributes,
                                },
                        })

        // Auto-assign to every workspace agent (same as the poll path).
        const agents = await prisma.agent.findMany({
                where: { workspaceId },
                select: { id: true },
        })
        if (agents.length > 0) {
                await prisma.agentCatalog.createMany({
                        data: agents.map((a) => ({ agentId: a.id, productId: product.id })),
                        skipDuplicates: true,
                })
        }

        await processProductEmbed({ productId: product.id, workspaceId })
}

/**
 * Soft-delete a product (webhook path) and remove its embedded chunks. The WP
 * plugin sends `{ id, sku?, name? }` on the product.deleted topic — we match by
 * SKU first (the stable business key), then by name, and finally by the WC id
 * as a string. If no match is found we no-op (the product may never have been
 * imported, e.g. it was created before the integration was connected).
 */
async function deleteProductFromWoo(
        integration: StoreIntegrationInput,
        payload: { id?: number; sku?: string; name?: string },
): Promise<void> {
        const { workspaceId } = integration
        const externalId = payload.id != null ? String(payload.id) : ''
        const or: { sku?: string; name?: string }[] = []
        if (payload.sku) or.push({ sku: payload.sku })
        if (payload.name) or.push({ name: payload.name })
        if (externalId) {
                or.push({ sku: externalId })
                or.push({ name: externalId })
        }
        if (or.length === 0) return

        const candidate = await prisma.product.findFirst({
                where: { workspaceId, OR: or },
                select: { id: true },
        })
        if (!candidate) return

        const links = await prisma.agentCatalog.findMany({
                where: { productId: candidate.id },
                select: { agentId: true },
        })
        const agentIds = links.map((l) => l.agentId)

        await prisma.product.delete({ where: { id: candidate.id } })

        await processProductEmbed({
                productId: candidate.id,
                workspaceId,
                agentIds,
                deleted: true,
        }).catch(() => {
                // Best-effort chunk cleanup; the catalog rows already cascaded.
        })
}

/** Upsert a single order (webhook path) and try to link it to a Contact. */
async function upsertOrderFromWoo(
        integration: StoreIntegrationInput,
        wo: WooOrder,
): Promise<void> {
        const { id: integrationId, workspaceId } = integration
        const externalOrderId = String(wo.id)
        const customerName = [wo.billing?.first_name, wo.billing?.last_name]
                .filter(Boolean)
                .join(' ')
                .trim()
        const customerPhone = wo.billing?.phone?.trim() || null
        const customerEmail = wo.billing?.email?.trim().toLowerCase() || null
        const total = parseFloat(wo.total ?? '0') || 0
        const { summary, count: itemCount } = summarizeItems(wo.line_items ?? [])

        let contactId: string | null = null
        const byPhone = await findContactByPhone(workspaceId, customerPhone)
        if (byPhone) {
                contactId = byPhone.id
        } else if (customerEmail) {
                const byEmail = await findContactByEmail(workspaceId, customerEmail)
                if (byEmail) contactId = byEmail.id
        }

        const orderDate = wo.date_created_gmt
                ? new Date(wo.date_created_gmt + 'Z')
                : wo.date_created
                        ? new Date(wo.date_created)
                        : null

        await prisma.storeOrder.upsert({
                where: {
                        integrationId_externalOrderId: { integrationId, externalOrderId },
                },
                update: {
                        contactId,
                        customerName: customerName || null,
                        customerPhone,
                        customerEmail,
                        status: wo.status ?? 'pending',
                        total,
                        currency: wo.currency ?? 'IRR',
                        itemCount: itemCount,
                        itemsSummary: summary || null,
                        paymentMethod: wo.payment_method_title || wo.payment_method || null,
                        shippingMethod: wo.shipping?.method_title || null,
                        orderDate,
                        updatedAt: new Date(),
                },
                create: {
                        integrationId,
                        workspaceId,
                        externalOrderId,
                        contactId,
                        customerName: customerName || null,
                        customerPhone,
                        customerEmail,
                        status: wo.status ?? 'pending',
                        total,
                        currency: wo.currency ?? 'IRR',
                        itemCount: itemCount,
                        itemsSummary: summary || null,
                        paymentMethod: wo.payment_method_title || wo.payment_method || null,
                        shippingMethod: wo.shipping?.method_title || null,
                        orderDate,
                },
        })
}

// ─── sync-log + status helpers ──────────────────────────────────────────────

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
                await prisma.storeSyncLog.create({
                        data: {
                                integrationId: input.integrationId,
                                workspaceId: input.workspaceId,
                                direction: input.direction,
                                entity: input.entity,
                                outcome: input.outcome,
                                count: input.count,
                                message: input.message,
                        },
                })
        } catch (e) {
                // Logging should never crash a sync — best-effort.
                console.error('[woocommerce] failed to write sync log:', e)
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
        } catch (e) {
                console.error('[woocommerce] failed to mark sync status:', e)
        }
}
