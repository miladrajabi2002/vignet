import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
	handleWooWebhook,
	resolveWooCredentials,
	syncWooOrders,
	syncWooProducts,
	verifyWooWebhookSignature,
	type StoreIntegrationInput,
} from '@/lib/integrations/woocommerce'

export const dynamic = 'force-dynamic'

/**
 * WooCommerce sync endpoint (F2).
 *
 * Two modes:
 *   • POST  — inbound webhook push from the WP plugin. Authenticated by the
 *             `?token=` query param matching the integration's `webhookSecret`
 *             + an HMAC-SHA256 signature of the raw body. The handler always
 *             returns 200 so the plugin doesn't retry-storm; failures are
 *             logged as `StoreSyncLog` rows.
 *   • GET   — manual "sync now" trigger for an admin. Requires workspace auth
 *             and an `?integrationId=` param. Calls `syncWooProducts` then
 *             `syncWooOrders` and returns the counts.
 */

async function loadIntegration(
	integrationId: string,
	workspaceId: string,
): Promise<StoreIntegrationInput | null> {
	const row = await prisma.storeIntegration.findFirst({
		where: { id: integrationId, workspaceId, active: true },
		select: { id: true, workspaceId: true, storeUrl: true, credentials: true, type: true },
	})
	if (!row || row.type !== 'WOOCOMMERCE') return null
	let credentials
	try {
		credentials = resolveWooCredentials(row.credentials)
	} catch {
		return null
	}
	return {
		id: row.id,
		workspaceId: row.workspaceId,
		storeUrl: row.storeUrl,
		credentials,
	}
}

// ─── POST: webhook push from the WP plugin ──────────────────────────────────

export async function POST(req: Request) {
	const { searchParams } = new URL(req.url)
	const token = searchParams.get('token')
	if (!token) {
		return NextResponse.json({ error: 'MISSING_TOKEN' }, { status: 400 })
	}

	// Look up the integration by webhook secret + active. Index by secret so
	// a missing/unknown token resolves fast without leaking existence.
	const integration = await prisma.storeIntegration.findFirst({
		where: { webhookSecret: token, type: 'WOOCOMMERCE', active: true },
		select: {
			id: true,
			workspaceId: true,
			storeUrl: true,
			credentials: true,
			webhookSecret: true,
		},
	})
	if (!integration) {
		return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
	}

	// Read the raw body for HMAC verification. We clone the request so we can
	// also parse it as JSON afterwards.
	const rawBody = await req.text()
	const signature = req.headers.get('x-wc-webhook-signature') ?? ''
	const topic = req.headers.get('x-wc-webhook-topic') ?? ''

	// Verify HMAC signature in constant time. If verification fails, we still
	// return 200 so the plugin doesn't retry — but log the failure.
	if (!verifyWooWebhookSignature(rawBody, signature, integration.webhookSecret ?? '')) {
		console.warn(
			`[woo-webhook] signature verification failed for integration ${integration.id}`,
		)
		await prisma.storeSyncLog.create({
			data: {
				integrationId: integration.id,
				workspaceId: integration.workspaceId,
				direction: 'push',
				entity: topic.startsWith('order.') ? 'order_update' : 'product_update',
				outcome: 'error',
				count: 0,
				message: 'Signature verification failed',
			},
		})
		return NextResponse.json({ ok: true })
	}

	let data: unknown
	try {
		data = JSON.parse(rawBody)
	} catch {
		return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
	}

	let credentials
	try {
		credentials = resolveWooCredentials(integration.credentials)
	} catch (e) {
		console.error('[woo-webhook] credential resolution failed:', e)
		return NextResponse.json({ ok: true })
	}

	const input: StoreIntegrationInput = {
		id: integration.id,
		workspaceId: integration.workspaceId,
		storeUrl: integration.storeUrl,
		credentials,
	}

	// Process after responding — the plugin doesn't need to wait for our DB
	// work. Failures are logged inside handleWooWebhook.
	void handleWooWebhook(input, { topic, data }).catch((e) =>
		console.error('[woo-webhook] handler error:', e),
	)

	return NextResponse.json({ ok: true })
}

// ─── GET: manual "sync now" trigger ─────────────────────────────────────────

export async function GET(req: Request) {
	const user = await getCurrentUser()
	if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

	const { searchParams } = new URL(req.url)
	const integrationId = searchParams.get('integrationId')
	if (!integrationId) {
		return NextResponse.json({ error: 'MISSING_INTEGRATION_ID' }, { status: 400 })
	}

	const integration = await loadIntegration(integrationId, user.workspaceId)
	if (!integration) {
		return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
	}

	const [products, orders] = await Promise.all([
		syncWooProducts(integration),
		syncWooOrders(integration, { sinceDays: 30 }),
	])

	return NextResponse.json({
		ok: true,
		products: { count: products.count, errors: products.errors },
		orders: { count: orders.count },
	})
}
