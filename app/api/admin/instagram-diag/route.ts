import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { readBotToken } from '@/lib/channels/config'
import { resolveInstagramHost } from '@/lib/channels/instagram'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/instagram-diag
 *
 * Admin-only diagnostic for the Instagram channel. Reports, for every
 * INSTAGRAM channel in the system:
 *   - which Meta Graph host the stored token works against
 *   - the linked account username
 *   - whether DM replies are possible (only Page tokens can send DMs)
 *   - the last send attempt's outcome (captured live by sending a typing_on
 *     indicator, which is the cheapest possible authenticated call against
 *     /me/messages and does NOT post any visible message to the user)
 *
 * Query params:
 *   - channelId=<id>  → limit to one channel
 *   - probeSend=1     → actually attempt a /me/messages call (typing_on) to
 *                       confirm DM capability empirically. Without it we only
 *                       do the static host probe (no /me/messages call).
 */
export async function GET(req: Request) {
        if (!isAdminAuthed()) {
                return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
        }

        const url = new URL(req.url)
        const channelId = url.searchParams.get('channelId')
        const probeSend = url.searchParams.get('probeSend') === '1'

        const channels = await prisma.agentChannel.findMany({
                where: {
                        type: 'INSTAGRAM',
                        ...(channelId ? { id: channelId } : {}),
                },
                select: { id: true, agentId: true, config: true, lastInboundAt: true },
        })

        const results = []
        for (const ch of channels) {
                const token = readBotToken(ch.config)
                if (!token) {
                        results.push({
                                channelId: ch.id,
                                agentId: ch.agentId,
                                error: 'NO_TOKEN_STORED',
                                lastInboundAt: ch.lastInboundAt,
                        })
                        continue
                }

                // Static probe: which host accepts the token, and what's the username?
                const resolved = await resolveInstagramHost(token)
                if (!resolved) {
                        results.push({
                                channelId: ch.id,
                                agentId: ch.agentId,
                                error: 'TOKEN_REJECTED_BY_BOTH_HOSTS',
                                hint: 'توکن نه روی graph.facebook.com کار می‌کند نه روی graph.instagram.com. ' +
                                        'احتمالاً منقضی شده یا از اکانت اشتباه صادر شده.',
                                lastInboundAt: ch.lastInboundAt,
                        })
                        continue
                }

                // Empirical DM-send probe: send typing_on (no visible message posted) to
                // a fake recipient id; if the host/token accepts the CALL shape, we learn
                // DM capability without ever messaging a real user. We use a clearly-
                // invalid recipient id (0) so even if the call shape is accepted, Meta
                // refuses the recipient — but the error code tells us capability.
                let dmCapability: 'yes' | 'no_token_type' | 'refused' | 'unknown' = 'unknown'
                let dmProbeDetail = ''
                if (probeSend) {
                        if (resolved.host === 'instagram') {
                                dmCapability = 'no_token_type'
                                dmProbeDetail =
                                        'توکن از نوع Instagram User (graph.instagram.com) است. ' +
                                        'این توکن به‌طور ذاتی نمی‌تواند DM بفرستد — endpoint /me/messages روی این هاست وجود ندارد. ' +
                                        'برای DM: یک Page Access Token از graph.facebook.com بسازید.'
                        } else {
                                try {
                                        const res = await fetch(`${resolved.base}/me/messages`, {
                                                method: 'POST',
                                                headers: {
                                                        'Content-Type': 'application/json',
                                                        Authorization: `Bearer ${token}`,
                                                },
                                                body: JSON.stringify({
                                                        recipient: { id: '0' },
                                                        sender_action: 'typing_on',
                                                }),
                                        })
                                        const body = await res.text().catch(() => '')
                                        if (res.ok) {
                                                // Extremely unlikely with id=0, but if accepted → full capability.
                                                dmCapability = 'yes'
                                                dmProbeDetail = `unexpected 200 (recipient 0 accepted). body=${body}`
                                        } else {
                                                // We expect an error. The error SUBCODE/CODE tells us whether
                                                // the problem is "bad recipient" (capability OK) vs "no permission"
                                                // (capability missing). Common cases:
                                                //   - 100 subcode 2018xxx → recipient invalid → CAPABILITY OK
                                                //   - 200 / 10 → permission missing → NO
                                                const looksLikeRecipientError =
                                                        /recipient|invalid.*id|2018/i.test(body)
                                                const looksLikePermissionError =
                                                        /permission|access|instagram_manage_messages|subcode 10\b/i.test(body)
                                                if (looksLikeRecipientError && !looksLikePermissionError) {
                                                        dmCapability = 'yes'
                                                        dmProbeDetail = `recipient refused but call shape accepted → DMs work. status=${res.status} body=${body.slice(0, 300)}`
                                                } else {
                                                        dmCapability = 'refused'
                                                        dmProbeDetail = `permission/capability refused. status=${res.status} body=${body.slice(0, 400)}`
                                                }
                                        }
                                } catch (e) {
                                        dmCapability = 'unknown'
                                        dmProbeDetail = `network error: ${e instanceof Error ? e.message : String(e)}`
                                }
                        }
                }

                results.push({
                        channelId: ch.id,
                        agentId: ch.agentId,
                        host: resolved.host,
                        hostUrl: resolved.base,
                        username: resolved.username,
                        canSendDms: resolved.host === 'facebook' && (probeSend ? dmCapability === 'yes' : true),
                        ...(probeSend ? { dmProbe: dmCapability, dmProbeDetail } : {}),
                        lastInboundAt: ch.lastInboundAt,
                        note:
                                resolved.host === 'instagram'
                                        ? 'این توکن فقط می‌تواند به کامنت‌ها پاسخ بدهد. DM نمی‌فرستد. برای DM از Page Access Token استفاده کنید.'
                                        : 'توکن Page است — هم DM و هم کامنت پشتیبانی می‌شود (اگر دسترسی instagram_manage_messages داشته باشد).',
                })
        }

        return NextResponse.json({ count: results.length, channels: results })
}
