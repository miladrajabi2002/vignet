import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'

/**
 * Single store integration CRUD (F2).
 *
 *   GET    /api/integrations/:id   — single integration + recent sync logs + order count.
 *   PATCH  /api/integrations/:id   — update active / pollIntervalMinutes / credentials.
 *   DELETE /api/integrations/:id   — remove the integration (cascades to orders + sync logs).
 */

type Params = { params: { integrationId: string } }

const SENSITIVE_FIELDS: Record<string, string[]> = {
	WOOCOMMERCE: ['consumerSecret'],
	SHOPIFY: ['accessToken', 'apiSecret'],
	CUSTOM_URL: [],
}

function encryptSensitiveFields(
	type: string,
	credentials: Record<string, unknown>,
): Record<string, unknown> {
	const sensitive = SENSITIVE_FIELDS[type] ?? []
	const out: Record<string, unknown> = {}
	for (const [k, v] of Object.entries(credentials)) {
		if (sensitive.includes(k) && typeof v === 'string' && v.length > 0) {
			out[`${k}Enc`] = encrypt(v)
		} else {
			out[k] = v
		}
	}
	return out
}

async function ownIntegration(workspaceId: string, integrationId: string) {
	return prisma.storeIntegration.findFirst({
		where: { id: integrationId, workspaceId },
		select: { id: true, type: true },
	})
}

export async function GET(_req: Request, { params }: Params) {
	const user = await getCurrentUser()
	if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

	const integration = await prisma.storeIntegration.findFirst({
		where: { id: params.integrationId, workspaceId: user.workspaceId },
		include: {
			syncLogs: {
				orderBy: { createdAt: 'desc' },
				take: 20,
				select: {
					id: true,
					direction: true,
					entity: true,
					outcome: true,
					count: true,
					message: true,
					createdAt: true,
				},
			},
			_count: { select: { orders: true, syncLogs: true } },
		},
	})
	if (!integration) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

	// Strip encrypted credential ciphertext from the response.
	const { credentials, ...rest } = integration
	const visible: Record<string, unknown> = {}
	if (credentials && typeof credentials === 'object') {
		for (const [k, v] of Object.entries(credentials as Record<string, unknown>)) {
			if (k.endsWith('Enc')) continue
			visible[k] = v
		}
	}
	return NextResponse.json({ integration: { ...rest, credentials: visible } })
}

const patchSchema = z.object({
	active: z.boolean().optional(),
	pollIntervalMinutes: z.number().int().min(0).max(1440).optional(),
	credentials: z.record(z.string(), z.unknown()).optional(),
})

export async function PATCH(req: Request, { params }: Params) {
	const user = await getCurrentUser()
	if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

	const owned = await ownIntegration(user.workspaceId, params.integrationId)
	if (!owned) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

	const json = await req.json().catch(() => null)
	const parsed = patchSchema.safeParse(json)
	if (!parsed.success) {
		return NextResponse.json(
			{ error: 'INVALID', issues: parsed.error.flatten() },
			{ status: 400 },
		)
	}

	const data: Prisma.StoreIntegrationUpdateInput = {}
	if (typeof parsed.data.active === 'boolean') data.active = parsed.data.active
	if (typeof parsed.data.pollIntervalMinutes === 'number') {
		data.pollIntervalMinutes = parsed.data.pollIntervalMinutes
	}
	if (parsed.data.credentials) {
		const encrypted = encryptSensitiveFields(owned.type, parsed.data.credentials)
		data.credentials = encrypted as Prisma.InputJsonValue
	}

	const integration = await prisma.storeIntegration.update({
		where: { id: params.integrationId },
		data,
		select: {
			id: true,
			type: true,
			storeUrl: true,
			webhookSecret: true,
			pollIntervalMinutes: true,
			active: true,
			lastSyncAt: true,
			lastSyncStatus: true,
			updatedAt: true,
		},
	})
	return NextResponse.json({ integration })
}

export async function DELETE(_req: Request, { params }: Params) {
	const user = await getCurrentUser()
	if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

	const owned = await ownIntegration(user.workspaceId, params.integrationId)
	if (!owned) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

	// Cascades to StoreOrder and StoreSyncLog per the schema's onDelete: Cascade.
	await prisma.storeIntegration.delete({ where: { id: params.integrationId } })
	return NextResponse.json({ ok: true })
}
