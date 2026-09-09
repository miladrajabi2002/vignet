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
 *
 * A21 — auto-disable: a channel that keeps failing its probe across
 * CHANNEL_DOWN_DISABLE_AFTER_SWEEPS consecutive sweeps is deactivated
 * (`active = false`) so the sweep stops probing it and stops emitting the
 * recurring "N/M channels are down" error every 5 minutes. Every reconnect
 * flow (messenger POST, Instagram OAuth callback, generic channels POST)
 * upserts `active: true`, so the operator can bring the channel back from the
 * same channels page at any time.
 */

export type ChannelHealthStatus = 'ok' | 'degraded' | 'down' | 'unknown'

const SMS_HEALTH_REDIS_KEY = 'sms:provider-health'

/** A21: consecutive failed probes before the channel is auto-disabled (~15 min at the 5-min cadence). */
const CHANNEL_DOWN_DISABLE_AFTER_SWEEPS = 3
const DOWN_STREAK_KEY = (channelId: string) => `health_down_streak:${channelId}`
const DISABLED_ALERT_KEY = (channelId: string) => `health_disabled:${channelId}`

/** Emit the "N/M channels are down" ErrorLog event at most once per hour. */
const SWEEP_ERROR_DEDUPE_KEY = 'health_sweep_error_dedupe'
const SWEEP_ERROR_DEDUPE_TTL_S = 60 * 60

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
 *
 * A21: a channel that fails CHANNEL_DOWN_DISABLE_AFTER_SWEEPS consecutive
 * probes is deactivated (active = false) with a one-time operator
 * notification, so persistent outages stop re-logging every sweep while the
 * reconnect flows can still re-activate the same row.
 */
export async function sweepChannelHealth(): Promise<{
        checked: number
        ok: number
        down: number
        disabled: number
        notified: number
}> {
        const stats = { checked: 0, ok: 0, down: 0, disabled: 0, notified: 0 }
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

                // A21: track consecutive failures so a persistently dead channel
                // is auto-disabled instead of re-alarming every single sweep.
                let disableNow = false
                if (probe.status === 'down') {
                        const streak = await getRedis()
                                .incr(DOWN_STREAK_KEY(ch.id))
                                .catch(() => 1)
                        await getRedis()
                                .expire(DOWN_STREAK_KEY(ch.id), 24 * 3600)
                                .catch(() => {})
                        if (streak >= CHANNEL_DOWN_DISABLE_AFTER_SWEEPS) disableNow = true
                } else {
                        await getRedis().del(DOWN_STREAK_KEY(ch.id)).catch(() => {})
                }

                await prisma.agentChannel
                        .update({
                                where: { id: ch.id },
                                data: {
                                        ...(disableNow ? { active: false } : {}),
                                        healthStatus: probe.status,
                                        healthCheckedAt: new Date(),
                                        healthError: disableNow
                                                ? `auto-disabled after ${CHANNEL_DOWN_DISABLE_AFTER_SWEEPS} failed probes: ${probe.error ?? 'unknown'}`
                                                : probe.error,
                                        // Re-arm the silence alert latch on recovery so a
                                        // LATER down-episode notifies again.
                                        ...(probe.status === 'ok' && wasDown
                                                ? { healthAlertedAt: null }
                                                : {}),
                                },
                        })
                        .catch(() => {})

                // A21: one-time operator notification when the channel is
                // auto-disabled, so they know to reconnect it from /channels.
                if (disableNow) {
                        stats.disabled += 1
                        await getRedis().del(DOWN_STREAK_KEY(ch.id)).catch(() => {})
                        const disabledLatch = await getRedis()
                                .set(DISABLED_ALERT_KEY(ch.id), '1', 'EX', 24 * 3600, 'NX')
                                .catch(() => null)
                        if (disabledLatch) {
                                await notifyWorkspace({
                                        workspaceId: ch.agent.workspaceId,
                                        type: 'CHANNEL_DOWN',
                                        title: 'کانال به‌صورت خودکار غیرفعال شد',
                                        body: `بررسی دوره‌ای چند بار متوالی نشان داد کانال ${ch.type} ایجنت «${ch.agent.name}» قطع است${probe.error ? ` (${probe.error})` : ''}. برای توقف هشدارهای تکراری، کانال غیرفعال شد؛ هر وقت خواستید از صفحه کانال‌ها دوباره متصلش کنید.`,
                                        link: '/channels',
                                        operatorTelegram: true,
                                }).catch(() => {})
                        }
                }

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
                // Log the sweep alarm at most once per hour; fail open on Redis
                // errors so observability never degrades silently.
                let shouldLog = true
                try {
                        shouldLog = Boolean(
                                await getRedis().set(
                                        SWEEP_ERROR_DEDUPE_KEY,
                                        '1',
                                        'EX',
                                        SWEEP_ERROR_DEDUPE_TTL_S,
                                        'NX',
                                ),
                        )
                } catch {
                        shouldLog = true
                }
                if (shouldLog) {
                        captureError(
                                'channel-health:sweep',
                                new Error(`${stats.down}/${stats.checked} channels are down`),
                                {},
                        )
                }
        }
        return stats
}
