import type { Prisma, ChannelType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { captureError, captureWarning } from '@/lib/errors/capture'
import { readBotToken } from '@/lib/channels/config'
import { notifyWorkspace } from '@/lib/notifications/create'
import { TELEGRAM_BASE } from '@/lib/channels/telegram'
import { BALE_BASE } from '@/lib/channels/bale'
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
 * (`active = false`) so the sweep stops probing it. Every reconnect
 * flow (messenger POST, Instagram OAuth callback, generic channels POST)
 * upserts `active: true`, so the operator can bring the channel back from the
 * same channels page at any time.
 *
 * Whose problem is it? A rejected token is the CUSTOMER's side (they revoked
 * or regenerated it): the owner gets a plain-language notice and the admin
 * log gets one `warn`, never an `error`. Only a provider we cannot reach at
 * all is a platform-side signal — that is `degraded`, it never disables a
 * channel or bothers the owner, and it is what the sweep logs as an error.
 */

export type ChannelHealthStatus = 'ok' | 'degraded' | 'down' | 'unknown'

/**
 * Stable codes stored at the start of `healthError`; the channels page maps
 * them to an explanation for the owner.
 */
export type ChannelHealthReason = 'TOKEN_REJECTED' | 'NO_TOKEN' | 'UNREACHABLE'

type ProbeResult = {
        status: ChannelHealthStatus
        reason: ChannelHealthReason | null
        error: string | null
}

const CHANNEL_LABEL_FA: Partial<Record<ChannelType, string>> = {
        TELEGRAM: 'تلگرام',
        BALE: 'بله',
        RUBIKA: 'روبیکا',
        INSTAGRAM: 'اینستاگرام',
}

/** Owner-facing explanation of a lost connection, in plain language. */
function describeLostConnection(type: ChannelType, reason: ChannelHealthReason | null): string {
        const label = CHANNEL_LABEL_FA[type] ?? type
        if (reason === 'NO_TOKEN') return 'اطلاعات اتصال این کانال ناقص است.'
        if (type === 'INSTAGRAM') {
                return 'دسترسی ویجنت به این حساب اینستاگرام دیگر معتبر نیست؛ معمولاً بعد از تغییر رمز، حذف دسترسی اپ یا منقضی‌شدن اتصال پیش می‌آید.'
        }
        return `${label} توکن این ربات را دیگر قبول نمی‌کند؛ معمولاً یعنی توکن عوض یا باطل شده یا ربات حذف شده است.`
}

/**
 * `getMe` for the Telegram-style Bot APIs, telling a rejected token (4xx)
 * apart from a provider we could not reach (network error, 429, 5xx).
 */
async function probeBotApiToken(base: string, token: string): Promise<ProbeResult> {
        try {
                const res = await fetch(`${base}/bot${token}/getMe`, { signal: AbortSignal.timeout(10_000) })
                if (res.status === 429 || res.status >= 500) {
                        return { status: 'degraded', reason: 'UNREACHABLE', error: `UNREACHABLE: HTTP ${res.status}` }
                }
                const json = (await res.json().catch(() => ({}))) as { result?: { username?: string } }
                return res.ok && json.result?.username
                        ? { status: 'ok', reason: null, error: null }
                        : { status: 'down', reason: 'TOKEN_REJECTED', error: 'TOKEN_REJECTED' }
        } catch (e) {
                const detail = e instanceof Error ? e.message.slice(0, 200) : 'probe failed'
                return { status: 'degraded', reason: 'UNREACHABLE', error: `UNREACHABLE: ${detail}` }
        }
}

const SMS_HEALTH_REDIS_KEY = 'sms:provider-health'

/** A21: consecutive failed probes before the channel is auto-disabled (~15 min at the 5-min cadence). */
const CHANNEL_DOWN_DISABLE_AFTER_SWEEPS = 3
const DOWN_STREAK_KEY = (channelId: string) => `health_down_streak:${channelId}`
const DISABLED_ALERT_KEY = (channelId: string) => `health_disabled:${channelId}`

/** Emit the "N/M channels could not be probed" ErrorLog event at most once per hour. */
const SWEEP_ERROR_DEDUPE_KEY = 'health_sweep_error_dedupe'
const SWEEP_ERROR_DEDUPE_TTL_S = 60 * 60

/** One active probe of a single messenger channel. Never throws. */
async function probeMessengerChannel(
        type: ChannelType,
        config: Prisma.JsonValue,
): Promise<ProbeResult> {
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
        if (!token) return { status: 'down', reason: 'NO_TOKEN', error: 'NO_TOKEN' }

        try {
                let ok = false
                switch (type) {
                        case 'TELEGRAM':
                                return await probeBotApiToken(TELEGRAM_BASE, token)
                        case 'BALE':
                                return await probeBotApiToken(BALE_BASE, token)
                        case 'RUBIKA':
                                ok = Boolean(await getRubikaBotInfo(token))
                                break
                        case 'INSTAGRAM':
                                ok = Boolean(await getInstagramInfo(token))
                                break
                        default:
                                return { status: 'unknown', reason: null, error: null }
                }
                return ok
                        ? { status: 'ok', reason: null, error: null }
                        : { status: 'down', reason: 'TOKEN_REJECTED', error: 'TOKEN_REJECTED' }
        } catch (e) {
                const detail = e instanceof Error ? e.message.slice(0, 200) : 'probe failed'
                return { status: 'degraded', reason: 'UNREACHABLE', error: `UNREACHABLE: ${detail}` }
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

/**
 * Sweep every active messenger channel, persist results, and notify owners on
 * red transitions (once per channel per alert episode). Also probes the SMS
 * provider path and stores the result in Redis for the dashboard.
 *
 * A21: a channel that fails CHANNEL_DOWN_DISABLE_AFTER_SWEEPS consecutive
 * probes is deactivated (active = false) with a one-time operator
 * notification, while the reconnect flows can still re-activate the same row.
 */
export async function sweepChannelHealth(): Promise<{
        checked: number
        ok: number
        down: number
        unreachable: number
        disabled: number
        notified: number
}> {
        const stats = { checked: 0, ok: 0, down: 0, unreachable: 0, disabled: 0, notified: 0 }
        const channels = await prisma.agentChannel.findMany({
                where: { active: true, type: { in: ['TELEGRAM', 'BALE', 'RUBIKA', 'INSTAGRAM'] } },
                select: {
                        id: true,
                        type: true,
                        config: true,
                        healthStatus: true,
                        healthAlertedAt: true,
                        agent: { select: { id: true, name: true, workspaceId: true } },
                },
                take: 500,
        })

        for (const ch of channels) {
                stats.checked += 1
                const probe = await probeMessengerChannel(ch.type, ch.config)
                if (probe.status === 'ok') stats.ok += 1
                if (probe.status === 'down') stats.down += 1
                if (probe.reason === 'UNREACHABLE') stats.unreachable += 1

                const becameDown = probe.status === 'down'
                const wasDown = ch.healthStatus === 'down'
                const label = CHANNEL_LABEL_FA[ch.type] ?? ch.type

                // A21: track consecutive failures so a persistently dead channel
                // is auto-disabled instead of re-alarming every single sweep. An
                // unreachable provider says nothing about the token, so it neither
                // extends nor clears the streak.
                let disableNow = false
                if (probe.status === 'down') {
                        const streak = await getRedis()
                                .incr(DOWN_STREAK_KEY(ch.id))
                                .catch(() => 1)
                        await getRedis()
                                .expire(DOWN_STREAK_KEY(ch.id), 24 * 3600)
                                .catch(() => {})
                        if (streak >= CHANNEL_DOWN_DISABLE_AFTER_SWEEPS) disableNow = true
                } else if (probe.status === 'ok') {
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
                                                ? `${probe.error ?? 'unknown'} (auto-disabled after ${CHANNEL_DOWN_DISABLE_AFTER_SWEEPS} failed checks)`
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
                                // The customer's own connection, not a platform fault:
                                // one warning for the admin log, never an error.
                                captureWarning(
                                        'channel-health:customer-disconnected',
                                        `اتصال ${label} ایجنت «${ch.agent.name}» از سمت مشتری قطع است و کانال غیرفعال شد (خطای سیستم نیست؛ به صاحب کانال اطلاع داده شد)`,
                                        {
                                                workspaceId: ch.agent.workspaceId,
                                                metadata: {
                                                        channelId: ch.id,
                                                        channelType: ch.type,
                                                        agentId: ch.agent.id,
                                                        reason: probe.reason,
                                                },
                                        },
                                )
                                await notifyWorkspace({
                                        workspaceId: ch.agent.workspaceId,
                                        type: 'CHANNEL_DOWN',
                                        title: `${label} «${ch.agent.name}» غیرفعال شد`,
                                        body: 'چند بررسی پیاپی نشان داد اتصال همچنان قطع است، برای همین این کانال موقتاً غیرفعال شد. هر وقت از صفحهٔ کانال‌ها دوباره متصلش کنید، بلافاصله فعال می‌شود.',
                                        link: `/agents/${ch.agent.id}/channels`,
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
                                        title: `اتصال ${label} «${ch.agent.name}» قطع شده است`,
                                        body: `${describeLostConnection(ch.type, probe.reason)} تا اتصال دوباره، پیام مشتری‌ها در این کانال بی‌پاسخ می‌ماند. از صفحهٔ کانال‌ها دوباره متصلش کنید.`,
                                        link: `/agents/${ch.agent.id}/channels`,
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

        if (stats.unreachable > 0) {
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
                                new Error(`${stats.unreachable}/${stats.checked} channels could not be probed (provider unreachable)`),
                                {},
                        )
                }
        }
        return stats
}
