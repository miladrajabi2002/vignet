import { NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { assertSafeHttpUrl, UnsafeHttpTargetError } from '@/lib/security/safe-http'
import { checkWorkspaceActive } from '@/lib/billing/entitlements'

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
        // credentials are now optional — webhook-only mode is supported.
        // The plugin pushes data via signed webhook; consumerKey/Secret are only
        // needed when the user wants Vigent to also POLL the WC REST API.
        credentials: z.record(z.string(), z.unknown()).default({}),
        webhookSecret: z.string().min(32).max(128).optional(),
        pollIntervalMinutes: z.number().int().min(0).max(1440).optional(),
        // Optional human-friendly label for the integration (e.g. "فروشگاه اصلی").
        label: z.string().max(120).optional(),
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
        if (!(await checkWorkspaceActive(user.workspaceId)).allowed) {
                return NextResponse.json({ error: 'PLAN_BLOCKED' }, { status: 402 })
        }

        const json = await req.json().catch(() => null)
        const parsed = createSchema.safeParse(json)
        if (!parsed.success) {
                return NextResponse.json(
                        { error: 'INVALID', issues: parsed.error.flatten() },
                        { status: 400 },
                )
        }

        const { type, storeUrl, credentials, pollIntervalMinutes } = parsed.data
        try {
                await assertSafeHttpUrl(storeUrl)
        } catch (error) {
                if (!(error instanceof UnsafeHttpTargetError)) console.error('[integrations] URL validation failed:', error)
                return NextResponse.json({ error: 'UNSAFE_STORE_URL' }, { status: 400 })
        }

        // ── Idempotent create ───────────────────────────────────────────
        // If an ACTIVE integration already exists for the same type + storeUrl
        // in this workspace, return it instead of creating a duplicate. This
        // is critical because the WordPress plugin's auto-discovery endpoint
        // (/api/integrations/lookup) finds an integration by storeUrl — if
        // multiple exist for the same URL, the lookup picks one arbitrarily
        // (typically the oldest) and the WP plugin ends up holding a different
        // webhookSecret than the one the onboarding wizard is polling for.
        // Returning the same integration from POST on every call keeps both
        // sides in sync.
        //
        // We also opportunistically clean up INACTIVE integrations for the
        // same URL+type so the workspace doesn't accumulate stale rows from
        // old disconnect/reconnect cycles. Active integrations are NEVER
        // touched here — only the caller can disconnect/delete them.
        const existing = await prisma.storeIntegration.findFirst({
                where: { workspaceId: user.workspaceId, type, storeUrl, active: true },
                orderBy: { createdAt: 'desc' },
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
        if (existing) {
                // Cleanup any INACTIVE duplicates for the same URL+type.
                // (Active ones are left alone — the caller owns them.)
                await prisma.storeIntegration.deleteMany({
                        where: {
                                workspaceId: user.workspaceId,
                                type,
                                storeUrl,
                                active: false,
                                id: { not: existing.id },
                        },
                }).catch(() => { /* best-effort cleanup — ignore errors */ })

                const webhookUrl =
                        type === 'WOOCOMMERCE'
                                ? `${appBaseUrl()}/api/sync/woocommerce?token=${existing.webhookSecret}`
                                : null
                return NextResponse.json({
                        integration: existing,
                        webhookUrl,
                        webhookSecret: existing.webhookSecret,
                        mode: 'webhook-only',
                }, { status: 200 })
        }

        const webhookSecret = parsed.data.webhookSecret ?? crypto.randomBytes(32).toString('base64url')

        // Encrypt sensitive credential fields before persisting.
        // credentials may be {} in webhook-only mode — that's fine, the plugin
        // pushes via signed webhook without needing REST API keys.
        const safeCredentials = encryptSensitiveFields(type, credentials) as Prisma.InputJsonValue

        // In webhook-only mode (no credentials), disable polling by setting interval to 0.
        const hasCredentials = credentials && Object.keys(credentials).length > 0
        const effectivePollInterval = pollIntervalMinutes ?? (hasCredentials ? 30 : 0)

        const integration = await prisma.storeIntegration.create({
                data: {
                        workspaceId: user.workspaceId,
                        type,
                        storeUrl,
                        credentials: safeCredentials,
                        webhookSecret,
                        pollIntervalMinutes: effectivePollInterval,
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

        return NextResponse.json({
                integration,
                webhookUrl,
                webhookSecret,
                mode: hasCredentials ? 'full' : 'webhook-only',
        }, { status: 201 })
}
