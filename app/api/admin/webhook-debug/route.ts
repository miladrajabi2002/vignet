import { NextResponse } from 'next/server'
import { isAdminAuthedRequest } from '@/lib/admin/auth'
import {
        getWebhookPayloads,
        clearWebhookPayloads,
} from '@/lib/channels/webhook-debug'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/webhook-debug
 *
 * Admin-only viewer for the in-memory raw-webhook-payload ring buffer.
 * Use this to answer "is the platform actually delivering the message?" when
 * an inbound "isn't being read".
 *
 * Query params:
 *   - type=INSTAGRAM|WHATSAPP|TELEGRAM|…  → filter by channel (default: all)
 *   - limit=N                              → cap returned payloads (default 20, max 50)
 *
 * Each payload entry includes:
 *   - ts: epoch ms when it arrived
 *   - type: channel type
 *   - tokenHint: first 8 chars of the webhook path token (correlate with the
 *     channel card's verify token)
 *   - size: body byte length
 *   - parsedCount: how many InboundMessages the adapter extracted from this body
 *       >0  → adapter found N messages; they should appear in conversations
 *       0   → body was valid but no reply-able message (e.g. a delivery/read
 *             receipt, or a message with no text)
 *       -1  → adapter could not be built (channel/token lookup failed)
 *       -2  → no channel in the DB matches this webhook token (stale URL)
 *   - body: the raw parsed JSON the platform POSTed
 *
 * DELETE (same URL) clears the buffer.
 */
export async function GET(req: Request) {
        if (!isAdminAuthedRequest(req)) {
                return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
        }
        const url = new URL(req.url)
        const type = url.searchParams.get('type') ?? undefined
        const limit = Math.min(
                Number(url.searchParams.get('limit') ?? 20),
                50,
        )
        const payloads = getWebhookPayloads(type, limit)
        return NextResponse.json({
                count: payloads.length,
                note:
                        'این یک بافر حافظه‌ی درون‌پردازشی است — با ری‌استارت برنامه پاک می‌شود. ' +
                        'برای دیباگ: یک پیام از اینستاگرام بفرستید، سپس این URL را refresh کنید ' +
                        'تا ببینید payload واقعاً رسیده یا نه، و آیا adapter آن را parse کرده.',
                payloads: payloads.map((p) => ({
                        id: p.id,
                        ts: p.ts,
                        tsReadable: new Date(p.ts).toISOString(),
                        type: p.type,
                        tokenHint: p.tokenHint,
                        size: p.size,
                        parsedCount: p.parsedCount,
                        parsedCountMeaning:
                                p.parsedCount > 0
                                        ? `${p.parsedCount} پیام از این payload استخراج شد — باید در گفتگوها دیده شود`
                                        : p.parsedCount === 0
                                                ? 'payload معتبر بود ولی پیام قابل‌پاسخی نداشت (delivery/read receipt یا پیام بدون متن)'
                                                : p.parsedCount === -2
                                                        ? 'هیچ کانالی در دیتابیس با این webhook token مطابقت ندارد (URL قدیمی/اشتباه)'
                                                        : 'adapter نتوانست build شود (channel/token lookup ناموفق)',
                        body: p.body,
                })),
        })
}

export async function DELETE(req: Request) {
        if (!isAdminAuthedRequest(req)) {
                return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
        }
        const url = new URL(req.url)
        const type = url.searchParams.get('type') ?? undefined
        const cleared = clearWebhookPayloads(type)
        return NextResponse.json({ ok: true, cleared })
}
