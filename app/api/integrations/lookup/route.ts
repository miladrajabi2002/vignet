import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Lookup endpoint — lets the WordPress plugin auto-discover its webhook URL
 * and secret by site URL. This way the user just clicks "اتصال" in the plugin
 * and doesn't need to copy-paste anything.
 *
 * GET /api/integrations/lookup?site_url=https://shop.example.com
 *
 * Returns: { webhook_url, webhook_secret } or 404 if no integration exists.
 *
 * Security: this is a public endpoint (no auth) because:
 *   1. The webhook secret is required to actually push data, so leaking it
 *      alone doesn't compromise the integration.
 *   2. The site_url must match exactly (normalized) to an existing integration.
 *   3. This matches the user's flow: they create the integration in the panel
 *      (which requires auth), then the plugin auto-fetches credentials.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const siteUrl = searchParams.get('site_url')?.trim().replace(/\/+$/, '')

    if (!siteUrl) {
        return NextResponse.json({ error: 'MISSING_SITE_URL' }, { status: 400 })
    }

    // Look up the integration by store_url (exact match after normalization).
    const integration = await prisma.storeIntegration.findFirst({
        where: {
            type: 'WOOCOMMERCE',
            storeUrl: siteUrl,
        },
        select: {
            id: true,
            storeUrl: true,
            webhookSecret: true,
            active: true,
        },
    })

    if (!integration || !integration.webhookSecret) {
        return NextResponse.json(
            { error: 'NOT_FOUND', message: 'No integration found for this site URL. Create one in the Vigent panel first.' },
            { status: 404 },
        )
    }

    // Build the webhook URL.
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir'
    const webhookUrl = `${appBaseUrl}/api/sync/woocommerce?token=${integration.webhookSecret}`

    return NextResponse.json({
        webhook_url: webhookUrl,
        webhook_secret: integration.webhookSecret,
        active: integration.active,
    })
}
