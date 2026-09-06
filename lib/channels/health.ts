import type { Prisma, ChannelType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { captureError } from '@/lib/errors/capture'
import { readBotToken } from '@/lib/channels/config'
import { notifyWorkspace } from '@/lib/notifications/create'
import { getTelegramBotInfo } from '@/lib/channels/telegram'
import { getBaleBotInfo } from '@/lib/channels/bale'
import { getRubikaBotInfo } from '@/lib/channels/rubika'
import { getInstagramInfo } from '@/lib/channels/instagram'

/**
 * Real channel health monitoring (A20).
 *
 * A periodic worker job actively verifies every connected channel instead of
 * guessing from inbound silence:
 *   • TELEGRAM / BALE — Bot API `getMe`
 *   • RUBIKA          — bot info endpoint
 *   • INSTAGRAM       — Graph `GET /me` (token validity via the adapter's host resolver)
 *   • SMS (IPPanel)   — proxy reachability probe (the panel itself is behind the proxy)
 *
 * Results are persisted on the AgentChannel row (`healthStatus`,
 * `healthCheckedAt`, `healthError`) so the dashboard can show the TRUE state:
 * green = ok, orange = degraded/recent error, red = down, with the timestamp
 * of the last check. A transition to red notifies the workspace owner once
 * (deduplicated through the existing `healthAlertedAt` latch).
 */

export type ChannelHealthStatus = 'ok' | 'degraded' | 'down' | 'unknown'

const SMS_HEALTH_REDIS_KEY = 'sms:provider-health'

/** One active probe of a single messenger channel. Never throws. */
async function probeMessengerChannel(
        type: ChannelType,
        config: Prisma.JsonValue,
): Promise<{ status: ChannelHealthStatus; error: string | null }> {
        // Instagram OAuth channels carry `userTokenEnc` instead of `botTokenEnc`.
        let token: string | null = readBotToken(config)
        if (!token) {
                const cfg = (config as Record<string, unknown> | null) ?? {}
                if (typeof cfg.userTokenEnc === 'string') {
                        try {
                                const { decrypt } = await import('@/lib/crypto')
                                token = decrypt(cfg.userTokenEnc)
                        } catch {
                                token = null
                        }
                }
        }
        if (!token) return { status: 'down', error: 'NO_TOKEN' }

        try {
                let ok = false
                switch (type) {
                        case 'TELEGRAM':
                                ok = Boolean(await getTelegramBotInfo(token))
                                break
                        case 'BALE':
                                ok = Boolean(await getBaleBotInfo(token))
                                break
                        case 'RUBIKA':
                                ok = Boolean(await getRubikaBotInfo(token))
                                break
                        case 'INSTAGRAM':
                                ok = Boolean(await getInstagramInfo(token))
                                break
                        default:
                                return { status: 'unknown', error: null }
                }
                return ok
                        ? { status: 'ok', error: null }
                        : { status: 'down', error: 'API rejected the stored token' }
        } catch (e) {
                return {
                        status: 'down',
                        error: e instanceof Error ? e.message.slice(0, 240) : 'probe failed',
                }
        }
}

/** Probe the SMS provider proxy (best-effort HEAD request). */
export async function probeSmsProvider(): Promise<{ status: ChannelHealthStatus; error: string | null }> {
        const proxyUrl = process.env.IPPANEL_PROXY_URL?.trim()
        if (!proxyUrl) return { status: 'unknown', error: 'IPPANEL_PROXY_URL not configured' }
        try {
                const res = await fetch(proxyUrl, {
                        method: 'HEAD',
                        signal: AbortSignal.timeout(10_000),
                })
                // The proxy answers 200/400/405 for plain probes — anything but a
                // network/5xx failure means the provider path is alive.
                if (res.status < 500) return { status: 'ok', error: null }
                return { status: 'down', error: `proxy HTTP ${res.status}` }
        } catch (e) {
                return {
                        status: 'down',
                        error: e instanceof Error ? e.message.slice(0, 240) : 'probe failed',
                }
        }
}

export async function readSmsProviderHealth(): Promise<{
        status: ChannelHealthStatus
        checkedAt: string | null
        error: string | null
}> {
        try {
                const redis = getRedis()
                const raw = await redis.get(SMS_HEALTH_REDIS_KEY)
                if (!raw) return { status: 'unknown', checkedAt: null, error: null }
                return JSON.parse(raw) as {
                        status: ChannelHealthStatus
                        checkedAt: string
                        error: string | null
                }
        } catch {
                return { status: 'unknown', checkedAt: null, error: null }
        }
}

/**
 * Sweep every active messenger channel, persist results, and notify owners on
 * red transitions (once per channel per alert episode). Also probes the SMS
 * provider path and stores the result in Redis for the dashboard.
 */
export async function sweepChannelHealth(): Promise<{
        checked: number
        ok: number
        down: number
        notified: number
}> {
        const stats = { checked: 0, ok: 0, down: 0, notified: 0 }
        const channels = await prisma.agentChannel.findMany({
                where: { active: true, type: { in: ['TELEGRAM', 'BALE', 'RUBIKA', 'INSTAGRAM'] } },
                select: {
                        id: true,
                        type: true,
                        config: true,
                        healthStatus: true,
                        healthAlertedAt: true,
                        agent: { select: { name: true, workspaceId: true } },
                },
                take: 500,
        })

        for (const ch of channels) {
                stats.checked += 1
                const probe = await probeMessengerChannel(ch.type, ch.config)
                if (probe.status === 'ok') stats.ok += 1
                if (probe.status === 'down') stats.down += 1

                const becameDown = probe.status === 'down'
                const wasDown = ch.healthStatus === 'down'

                await prisma.agentChannel
                        .update({
                                where: { id: ch.id },
                                data: {
                                        healthStatus: probe.status,
                                        healthCheckedAt: new Date(),
                                        healthError: probe.error,
                                        // Re-arm the silence alert latch on recovery so a
                                        // LATER down-episode notifies again.
                                        ...(probe.status === 'ok' && wasDown
                                                ? { healthAlertedAt: null }
                                                : {}),
                                },
                        })
                        .catch(() => {})

                // Notify on the down TRANSITION, deduped per episode.
                if (becameDown && !wasDown) {
                        const alertLatch = await getRedis()
                                .set(`health_alert:${ch.id}`, '1', 'EX', 6 * 3600, 'NX')
                                .catch(() => null)
                        if (alertLatch) {
                                stats.notified += 1
                                await notifyWorkspace({
                                        workspaceId: ch.agent.workspaceId,
                                        type: 'CHANNEL_DOWN',
                                        title: 'کانال پاسخگویی قطع شده است',
                                        body: `بررسی دوره‌ای نشان داد کانال ${ch.type} ایجنت «${ch.agent.name}» پاسخ نمی‌دهد${probe.error ? ` (${probe.error})` : ''}. لطفاً از بخش کانال‌ها دوباره متصل شوید.`,
                                        link: '/channels',
                                        operatorTelegram: true,
                                }).catch(() => {})
                        }
                }
        }

        // SMS provider probe — result cached in Redis for the dashboard API.
        const sms = await probeSmsProvider()
        await getRedis()
                .set(
                        SMS_HEALTH_REDIS_KEY,
                        JSON.stringify({
                                status: sms.status,
                                checkedAt: new Date().toISOString(),
                                error: sms.error,
                        }),
                        'EX',
                        30 * 60,
                )
                .catch(() => {})

        if (stats.down > 0) {
                captureError(
                        'channel-health:sweep',
                        new Error(`${stats.down}/${stats.checked} channels are down`),
                        {},
                )
        }
        return stats
}
