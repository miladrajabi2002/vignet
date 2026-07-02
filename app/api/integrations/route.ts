import { NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'

/**
 * Store integration list + create (F2).
 *
 *   GET  /api/integrations                         — list the workspace's
 *                                                    integrations with their
 *                                                    last 5 sync-log entries.
 *   POST /api/integrations                         — connect a new store. Sensitive
 *                                                    credential fields are
 *                                                    encrypted at rest with AES-256-GCM
 *                                                    (see lib/crypto.ts). A random
 *                                                    `webhookSecret` is generated when
 *                                                    the caller doesn't provide one.
 */

const createSchema = z.object({
        type: z.enum(['WOOCOMMERCE', 'CUSTOM_URL', 'SHOPIFY']),
        storeUrl: z.string().url().max(500),
        credentials: z.record(z.string(), z.unknown()).default({}),
        webhookSecret: z.string().min(8).max(128).optional(),
        pollIntervalMinutes: z.number().int().min(0).max(1440).optional(),
})

/** Per-type list of credential field names that must be encrypted at rest. */
const SENSITIVE_FIELDS: Record<string, string[]> = {
        WOOCOMMERCE: ['consumerSecret'],
        SHOPIFY: ['accessToken', 'apiSecret'],
        CUSTOM_URL: [],
}

/**
 * Encrypt the sensitive fields of a credentials JSON payload in place. Other
 * fields (e.g. `consumerKey`, `shopDomain`) are left plaintext so they can be
 * displayed back to the user as a hint. Returns the safe-to-store JSON.
 */
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

function appBaseUrl(): string {
        return process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir'
}

export async function GET() {
        const user = await getCurrentUser()
        if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

        const integrations = await prisma.storeIntegration.findMany({
                where: { workspaceId: user.workspaceId },
                orderBy: { createdAt: 'desc' },
                include: {
                        syncLogs: {
                                orderBy: { createdAt: 'desc' },
                                take: 5,
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

        // Strip encrypted credential ciphertext from the response — only return
        // non-sensitive fields (consumerKey, shopDomain, etc.).
        const safe = integrations.map(({ credentials, ...rest }) => {
                const visible: Record<string, unknown> = {}
                if (credentials && typeof credentials === 'object') {
                        for (const [k, v] of Object.entries(credentials as Record<string, unknown>)) {
                                if (k.endsWith('Enc')) continue
                                visible[k] = v
                        }
                }
                return { ...rest, credentials: visible }
        })

        return NextResponse.json({ integrations: safe })
}

export async function POST(req: Request) {
        const user = await getCurrentUser()
        if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

        const json = await req.json().catch(() => null)
        const parsed = createSchema.safeParse(json)
        if (!parsed.success) {
                return NextResponse.json(
                        { error: 'INVALID', issues: parsed.error.flatten() },
                        { status: 400 },
                )
        }

        const { type, storeUrl, credentials, pollIntervalMinutes } = parsed.data
        const webhookSecret = parsed.data.webhookSecret ?? crypto.randomUUID()

        // Encrypt sensitive credential fields before persisting.
        const safeCredentials = encryptSensitiveFields(type, credentials) as Prisma.InputJsonValue

        const integration = await prisma.storeIntegration.create({
                data: {
                        workspaceId: user.workspaceId,
                        type,
                        storeUrl,
                        credentials: safeCredentials,
                        webhookSecret,
                        pollIntervalMinutes: pollIntervalMinutes ?? 30,
                },
                select: {
                        id: true,
                        type: true,
                        storeUrl: true,
                        webhookSecret: true,
                        pollIntervalMinutes: true,
                        active: true,
                        createdAt: true,
                },
        })

        // Webhook URL the user copies into the WP plugin settings.
        const webhookUrl =
                type === 'WOOCOMMERCE'
                        ? `${appBaseUrl()}/api/sync/woocommerce?token=${webhookSecret}`
                        : null

        return NextResponse.json({ integration, webhookUrl }, { status: 201 })
}
