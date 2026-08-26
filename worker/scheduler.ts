import type { ChannelType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { dispatchProductEmbed, dispatchSummary } from '@/lib/queue/jobs'
import { MESSENGER_TYPES } from '@/lib/channels/registry'
import { notifyWorkspace } from '@/lib/notifications/create'
import { encrypt, decrypt } from '@/lib/crypto'
import { refreshLongLivedToken as refreshInstagramLongLivedToken } from '@/lib/instagram/oauth'
import {
        sendActivationCompleteSms,
        sendActivationReminderSms,
        sendSubscriptionExpiringSms,
        sendTrialExpiringSms,
} from '@/lib/sms/ippanel'
import { captureError } from '@/lib/errors/capture'
import {
        syncWooOrders,
        syncWooProducts,
        resolveWooCredentials,
        type StoreIntegrationInput,
} from '@/lib/integrations/woocommerce'
import { refreshStaleUrlKnowledge } from '@/lib/integrations/crawler'
import { sweepAdminCommercialSmsOutbox } from '@/lib/billing/admin-commercial-outbox'
import { cleanupOldRecords } from '@/lib/maintenance/data-retention'

/**
 * Lightweight in-process scheduler for the background worker. Uses plain
 * intervals (no extra cron dependency) to run periodic maintenance tasks.
 *
 * Currently:
 *  - Every hour, auto-resolve conversations that have been idle for over
 *    STALE_HOURS and enqueue a summary for each. This keeps the inbox tidy and
 *    populates conversation summaries without manual action.
 *  - Every 6 hours, alert workspaces whose active messenger channels have
 *    gone silent (suspected revoked token).
 *  - Every 10 minutes, poll active store integrations whose pollInterval has
 *    elapsed and re-sync their products/orders (F2).
 *  - Every hour, re-crawl stale URL knowledge bases whose refreshInterval has
 *    elapsed (F2/F4).
 */

const HOUR_MS = 60 * 60 * 1000
const STALE_HOURS = 24
const BATCH = 100
const ADMIN_COMMERCIAL_SMS_SWEEP_INTERVAL_MS = 5 * 60_000

async function sweepStaleConversations(): Promise<void> {
        const cutoff = new Date(Date.now() - STALE_HOURS * HOUR_MS)
        const stale = await prisma.conversation.findMany({
                where: {
                        status: 'OPEN',
                        lastMessageAt: { lt: cutoff },
                        messageCount: { gt: 0 },
                },
                select: { id: true },
                take: BATCH,
        })
        if (!stale.length) return

        const ids = stale.map((c) => c.id)
        await prisma.conversation.updateMany({
                where: { id: { in: ids } },
                data: { status: 'RESOLVED' },
        })
        for (const id of ids) {
                await dispatchSummary({ conversationId: id })
        }
        console.log(`[scheduler] auto-resolved ${ids.length} stale conversation(s)`)
}

async function runSweep(): Promise<void> {
        try {
                await sweepStaleConversations()
        } catch (e) {
                console.error('[scheduler] sweep failed:', e)
        }
}

const CHANNEL_CHECK_MS = 6 * HOUR_MS
const CHANNEL_SILENT_MS = 3 * 24 * HOUR_MS // a connected channel silent >3d is suspect

/**
 * Alert workspaces whose active messenger channels have gone silent (no inbound
 * message for over CHANNEL_SILENT_MS) — usually a revoked/expired bot token.
 * Deduped via healthAlertedAt so each silence episode alerts at most once.
 */
async function alertSilentChannels(): Promise<void> {
        const cutoff = new Date(Date.now() - CHANNEL_SILENT_MS)
        const channels = await prisma.agentChannel.findMany({
                where: { active: true, type: { in: [...MESSENGER_TYPES] as ChannelType[] } },
                select: {
                        id: true,
                        type: true,
                        lastInboundAt: true,
                        healthAlertedAt: true,
                        createdAt: true,
                        agent: { select: { name: true, workspaceId: true } },
                },
                take: 500,
        })

        for (const ch of channels) {
                const lastActivity = ch.lastInboundAt ?? ch.createdAt
                if (lastActivity >= cutoff) continue
                // Only alert once per silence episode (not already alerted since last activity).
                if (ch.healthAlertedAt && ch.healthAlertedAt >= lastActivity) continue

                await notifyWorkspace({
                        workspaceId: ch.agent.workspaceId,
                        type: 'CHANNEL_DOWN',
                        title: `اتصال ${ch.type} قطع به نظر می‌رسد`,
                        body: `کانال «${ch.agent.name}» بیش از ۳ روز پیامی دریافت نکرده است. ممکن است توکن منقضی شده باشد.`,
                        link: '/integrations',
                        opsEmail: true,
                })
                await prisma.agentChannel.update({
                        where: { id: ch.id },
                        data: { healthAlertedAt: new Date() },
                })
        }
}

async function runChannelCheck(): Promise<void> {
        try {
                await alertSilentChannels()
        } catch (e) {
                console.error('[scheduler] channel-health check failed:', e)
        }
}

// ─── store integration polling (F2) ─────────────────────────────────────────

// 30 minutes — matches the WP plugin's own auto-sync cadence so the server
// and the plugin stay in lockstep. Going faster risks rate-limit issues on
// stores with thousands of products (each sync walks the full catalog).
const STORE_SYNC_INTERVAL_MS = 30 * 60 * 1000 // every 30 minutes

/**
 * Find every active store integration whose `pollIntervalMinutes` has elapsed
 * since `lastSyncAt` and re-sync its products + orders. For non-WooCommerce
 * types (CUSTOM_URL) the polling path is a no-op — those are handled by the
 * URL crawler instead. Per-integration errors are caught and logged so a
 * single failing store doesn't block the rest.
 *
 * Integrations are synced in parallel via `Promise.allSettled` so a slow or
 * unresponsive store doesn't stall the rest of the queue — a 30s timeout on
 * one store only costs the others 30s of waiting at worst (vs. sequential
 * processing which would block for N × 30s).
 */
async function syncStoreIntegrations(): Promise<void> {
        const now = Date.now()
        const rows = await prisma.storeIntegration.findMany({
                where: { active: true, pollIntervalMinutes: { gt: 0 } },
                select: {
                        id: true,
                        workspaceId: true,
                        storeUrl: true,
                        credentials: true,
                        type: true,
                        pollIntervalMinutes: true,
                        lastSyncAt: true,
                },
                take: 100,
        })

        // Filter to WooCommerce integrations whose poll interval has elapsed.
        // We do the type + elapsed check up front so we don't even spin up a
        // promise for stores that don't need syncing this cycle.
        const due = rows.filter((row) => {
                if (row.type !== 'WOOCOMMERCE') return false
                const lastMs = row.lastSyncAt ? row.lastSyncAt.getTime() : 0
                const elapsed = now - lastMs
                return elapsed >= row.pollIntervalMinutes * 60 * 1000
        })

        if (due.length === 0) return

        // Sync all due integrations in parallel. Each one resolves or rejects
        // independently; a single failure never blocks the others.
        const results = await Promise.allSettled(
                due.map(async (row) => {
                        let credentials
                        try {
                                credentials = resolveWooCredentials(row.credentials)
                        } catch (e) {
                                throw new Error(
                                        `credential resolve failed: ${e instanceof Error ? e.message : e}`,
                                )
                        }

                        const integration: StoreIntegrationInput = {
                                id: row.id,
                                workspaceId: row.workspaceId,
                                storeUrl: row.storeUrl,
                                credentials,
                        }

                        const products = await syncWooProducts(integration)
                        const orders = await syncWooOrders(integration, { sinceDays: 30 })
                        return { id: row.id, products: products.count, orders: orders.count }
                }),
        )

        // Log each result — settled or rejected — so the operator can see what
        // happened without grepping for stack traces.
        let okCount = 0
        let errCount = 0
        results.forEach((r, i) => {
                const row = due[i]
                if (r.status === 'fulfilled') {
                        okCount++
                        console.log(
                                `[scheduler] store ${row.id} synced: ${r.value.products} products, ${r.value.orders} orders`,
                        )
                } else {
                        errCount++
                        console.error(
                                `[scheduler] store ${row.id} sync failed:`,
                                r.reason instanceof Error ? r.reason.message : r.reason,
                        )
                }
        })
        if (okCount + errCount > 0) {
                console.log(
                        `[scheduler] store-sync batch: ${okCount} ok, ${errCount} failed (of ${due.length} due)`,
                )
        }
}

async function runStoreSync(): Promise<void> {
        try {
                await syncStoreIntegrations()
        } catch (e) {
                console.error('[scheduler] store-sync failed:', e)
        }
}

// ─── stale URL knowledge refresh (F2/F4) ────────────────────────────────────

async function runKnowledgeRefresh(): Promise<void> {
        try {
                const { refreshed } = await refreshStaleUrlKnowledge()
                if (refreshed > 0) {
                        console.log(`[scheduler] refreshed ${refreshed} stale URL knowledge base(s)`)
                }
        } catch (e) {
                console.error('[scheduler] knowledge refresh failed:', e)
        }
}

// ─── product embedding repair ────────────────────────────────────────────────────

/**
 * Heal legacy/dashboard products that were assigned before creation started
 * dispatching semantic embeddings. A small bounded hourly batch avoids a
 * migration-time API burst while eventually making every active catalog item
 * discoverable by needs and descriptive phrases, not only exact text.
 */
async function repairMissingProductEmbeddings(): Promise<void> {
        const products = await prisma.product.findMany({
                where: {
                        active: true,
                        embeddingUpdatedAt: null,
                        catalogItems: { some: {} },
                },
                orderBy: { createdAt: 'asc' },
                take: 50,
                select: { id: true, workspaceId: true },
        })
        if (!products.length) return

        const results = await Promise.allSettled(
                products.map((product) =>
                        dispatchProductEmbed({
                                productId: product.id,
                                workspaceId: product.workspaceId,
                        }),
                ),
        )
        const queued = results.filter((result) => result.status === 'fulfilled').length
        if (queued > 0) {
                console.log(`[scheduler] queued ${queued} missing product embedding(s)`)
        }
}

async function runProductEmbeddingRepair(): Promise<void> {
        try {
                await repairMissingProductEmbeddings()
        } catch (error) {
                console.error('[scheduler] product embedding repair failed:', error)
        }
}

// ─── appointment reminders ────────────────────────────────────────────────

const APPOINTMENT_REMINDER_INTERVAL_MS = HOUR_MS

/**
 * Remind the business manager once when an active appointment enters the next
 * 24-hour window. Redis keeps the worker restart-safe without adding a noisy
 * persistence column to every booking.
 */
async function remindUpcomingAppointments(): Promise<void> {
        const now = new Date()
        const horizon = new Date(now.getTime() + 24 * HOUR_MS)
        const appointments = await prisma.appointment.findMany({
                where: {
                        startsAt: { gt: now, lte: horizon },
                        status: { in: ['PENDING', 'CONFIRMED'] },
                },
                orderBy: { startsAt: 'asc' },
                take: 500,
                select: {
                        id: true,
                        workspaceId: true,
                        customerName: true,
                        startsAt: true,
                        timezone: true,
                        service: { select: { name: true } },
                },
        })
        if (!appointments.length) return

        const redis = getRedis()
        for (const appointment of appointments) {
                const acquired = await redis.set(
                        `appointment_reminder:${appointment.id}`,
                        '1',
                        'EX',
                        48 * 3600,
                        'NX',
                )
                if (!acquired) continue
                const when = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
                        timeZone: appointment.timezone,
                        dateStyle: 'medium',
                        timeStyle: 'short',
                }).format(appointment.startsAt)
                await notifyWorkspace({
                        workspaceId: appointment.workspaceId,
                        type: 'APPOINTMENT',
                        title: `یادآوری نوبت ${appointment.service.name}`,
                        body: `${appointment.customerName} · ${when}`,
                        link: '/appointments',
                        operatorTelegram: true,
                })
        }
}

async function runAppointmentReminders(): Promise<void> {
        try {
                await remindUpcomingAppointments()
        } catch (error) {
                console.error('[scheduler] appointment reminder failed:', error)
        }
}

// ─── data retention cleanup ─────────────────────────────────────────────────

const CLEANUP_INTERVAL_MS = 24 * HOUR_MS

async function runCleanup(): Promise<void> {
        try {
                const result = await cleanupOldRecords()
                const total =
                        result.otpLogs +
                        result.errorLogs +
                        result.syncLogsByAge +
                        result.syncLogsOverCap +
                        result.orphanWorkspaces
                if (total > 0) {
                        console.log(
                                `[scheduler] retention cleanup: ${result.otpLogs} OTP, ${result.errorLogs} error, ${result.syncLogsByAge + result.syncLogsOverCap} sync log, ${result.orphanWorkspaces} orphan workspace rows deleted`,
                        )
                }
        } catch (e) {
                console.error('[scheduler] retention cleanup failed:', e)
        }
}

// ─── subscription expiry reminders ──────────────────────────────────────────

const SUBSCRIPTION_SWEEP_INTERVAL_MS = 6 * HOUR_MS // every 6 hours
const TRIAL_LIFECYCLE_INTERVAL_MS = 6 * HOUR_MS
// Send the reminder this many days before expiry. Overridable via env so the
// operator can tune the lead time without a redeploy.
function subscriptionRemindDays(): number {
        const v = Number(process.env.SUBSCRIPTION_REMIND_DAYS)
        return Number.isFinite(v) && v > 0 && v <= 30 ? Math.round(v) : 3
}

/**
 * Find ACTIVE paid subscriptions ending within SUBSCRIPTION_REMIND_DAYS and
 * text the workspace owner a renewal reminder. Each (workspaceId, period) pair
 * is deduped via Redis so the reminder fires at most once per period — the
 * dedup key outlives the period so a renewal that extends the same period
 * doesn't re-alert, and a fresh period (new currentPeriodEnd) gets a fresh key.
 */
async function remindExpiringSubscriptions(): Promise<void> {
        const now = Date.now()
        const remindDays = subscriptionRemindDays()
        const horizon = new Date(now + remindDays * 24 * HOUR_MS)
        const subs = await prisma.subscription.findMany({
                where: {
                        status: 'ACTIVE',
                        currentPeriodEnd: { gt: new Date(now), lte: horizon },
                },
                select: {
                        id: true,
                        workspaceId: true,
                        plan: true,
                        currentPeriodEnd: true,
                },
                take: 200,
        })
        if (!subs.length) return

        const redis = getRedis()
        for (const sub of subs) {
                const periodKey = sub.currentPeriodEnd.getTime().toString(36)
                const dedupKey = `sub_expiring_notified:${sub.workspaceId}:${periodKey}`
                // SETNX: only the first sweep to hit this key sends the SMS.
                const acquired = await redis.set(
                        dedupKey,
                        '1',
                        'EX',
                        remindDays * 24 * 3600 + 86400,
                        'NX',
                )
                if (!acquired) continue

                try {
                        const owner = await prisma.user.findFirst({
                                where: { workspaceId: sub.workspaceId },
                                select: { phone: true },
                        })
                        if (!owner?.phone) continue
                        const daysRemaining = Math.max(
                                1,
                                Math.ceil((sub.currentPeriodEnd.getTime() - now) / (24 * HOUR_MS)),
                        )
                        await sendSubscriptionExpiringSms(owner.phone, {
                                plan: sub.plan,
                                daysRemaining,
                                currentPeriodEnd: sub.currentPeriodEnd,
                        })
                        await notifyWorkspace({
                                workspaceId: sub.workspaceId,
                                type: 'SYSTEM',
                                title: 'اشتراک در حال اتمام',
                                body: `اشتراک ${sub.plan} شما ${daysRemaining} روز دیگر منقضی می‌شود. برای تمدید وارد حساب کاربری خود شوید.`,
                                link: '/billing',
                        })
                } catch (e) {
                        captureError('scheduler:sub-expiring-sms', e, {
                                workspaceId: sub.workspaceId,
                        })
                }
        }
        console.log(`[scheduler] checked ${subs.length} expiring subscription(s)`)
}

async function runSubscriptionExpirySweep(): Promise<void> {
        try {
                await remindExpiringSubscriptions()
        } catch (e) {
                console.error('[scheduler] subscription-expiry sweep failed:', e)
        }
}

// ─── trial activation SMS lifecycle ─────────────────────────────────────────

const ONBOARDING_NEXT_STEP_FA = [
        'ساخت اولین ایجنت',
        'افزودن محصول یا اطلاعات کسب‌وکار',
        'فعال‌کردن پاسخ‌های هوش مصنوعی',
        'انجام اولین گفتگوی آزمایشی',
        'اتصال اولین کانال',
] as const

/**
 * Send only milestone SMS messages: one nudge per unfinished step, one success
 * message, and one trial-expiry reminder. Redis keys keep every message unique.
 */
async function runTrialLifecycleSweep(): Promise<void> {
        const now = new Date()
        const reminderHorizon = new Date(now.getTime() + 3 * 24 * HOUR_MS)
        const workspaces = await prisma.workspace.findMany({
                where: {
                        plan: 'TRIAL',
                        trialEndsAt: { gt: now },
                        owner: { isNot: null },
                },
                select: {
                        id: true,
                        createdAt: true,
                        trialEndsAt: true,
                        onboardingStep: true,
                        onboardingCompleted: true,
                        owner: {
                                select: { phone: true },
                        },
                },
                take: 300,
        })
        const redis = getRedis()

        for (const workspace of workspaces) {
                const phone = workspace.owner?.phone
                if (!phone || !workspace.trialEndsAt) continue

                if (workspace.onboardingCompleted) {
                        const key = `lifecycle_sms:activation_complete:${workspace.id}`
                        const acquired = await redis.set(key, '1', 'EX', 45 * 24 * 3600, 'NX')
                        if (acquired) await sendActivationCompleteSms(phone)
                        continue
                }

                if (workspace.trialEndsAt <= reminderHorizon) {
                        const period = workspace.trialEndsAt.getTime().toString(36)
                        const key = `lifecycle_sms:trial_expiring:${workspace.id}:${period}`
                        const acquired = await redis.set(key, '1', 'EX', 7 * 24 * 3600, 'NX')
                        if (acquired) {
                                const daysRemaining = Math.max(
                                        1,
                                        Math.ceil((workspace.trialEndsAt.getTime() - now.getTime()) / (24 * HOUR_MS)),
                                )
                                await sendTrialExpiringSms(phone, { daysRemaining })
                        }
                        continue
                }

                // Give a new user a full day to explore before sending one clear next step.
                if (now.getTime() - workspace.createdAt.getTime() < 24 * HOUR_MS) continue
                const step = Math.min(workspace.onboardingStep, ONBOARDING_NEXT_STEP_FA.length - 1)
                const key = `lifecycle_sms:activation_step:${workspace.id}:${step}`
                const acquired = await redis.set(key, '1', 'EX', 21 * 24 * 3600, 'NX')
                if (acquired) {
                        await sendActivationReminderSms(phone, {
                                nextStep: ONBOARDING_NEXT_STEP_FA[step],
                        })
                }
        }
}

async function runAdminCommercialSmsOutbox(): Promise<void> {
        try {
                const delivered = await sweepAdminCommercialSmsOutbox()
                if (delivered > 0) {
                        console.log(`[scheduler] delivered ${delivered} commercial admin SMS alert(s)`)
                }
        } catch (error) {
                captureError('scheduler:admin-commercial-sms-outbox', error)
        }
}

// ─── Instagram OAuth token refresh ──────────────────────────────────────────

const TOKEN_REFRESH_INTERVAL_MS = 12 * HOUR_MS
// Refresh well before the ~60-day expiry so a few failed attempts still leave
// plenty of runway before the channel actually dies.
const TOKEN_REFRESH_WINDOW_MS = 10 * 24 * HOUR_MS

/**
 * Instagram Login long-lived user tokens expire after ~60 days. Without a refresh sweep every
 * OAuth-connected channel silently dies: inbound keeps arriving but every send
 * fails with OAuthException until the operator manually reconnects. Refresh
 * every channel whose token expires inside the window; on failure near expiry,
 * tell the workspace to reconnect BEFORE the channel breaks.
 */
async function refreshOauthTokens(): Promise<void> {
        const channels = await prisma.agentChannel.findMany({
                where: { active: true, type: 'INSTAGRAM' },
                select: {
                        id: true,
                        type: true,
                        config: true,
                        agent: { select: { name: true, workspaceId: true } },
                },
                take: 500,
        })
        const cutoff = Date.now() + TOKEN_REFRESH_WINDOW_MS

        for (const ch of channels) {
                const cfg = (ch.config as Record<string, unknown> | null) ?? {}
                // Only Instagram-Login / Embedded-Signup channels hold a refreshable
                // user token. Legacy FB-Login page tokens are effectively permanent.
                if (cfg.mode !== 'OAUTH' || typeof cfg.userTokenEnc !== 'string') continue
                const expiresAtMs =
                        typeof cfg.userTokenExpiresAt === 'string'
                                ? Date.parse(cfg.userTokenExpiresAt)
                                : NaN
                // Unknown expiry (pre-tracking rows) counts as due now.
                if (Number.isFinite(expiresAtMs) && expiresAtMs > cutoff) continue

                let token: string
                try {
                        token = decrypt(cfg.userTokenEnc)
                } catch {
                        continue
                }

                try {
                        const fresh = await refreshInstagramLongLivedToken(token)
                        await prisma.agentChannel.update({
                                where: { id: ch.id },
                                data: {
                                        config: {
                                                ...cfg,
                                                userTokenEnc: encrypt(fresh.token),
                                                userTokenExpiresAt: fresh.expiresAt.toISOString(),
                                        } as Prisma.InputJsonValue,
                                },
                        })
                        console.log(`[scheduler] refreshed ${ch.type} OAuth token for channel ${ch.id}`)
                } catch (error) {
                        captureError('scheduler:oauth-token-refresh', error, {
                                metadata: { channelId: ch.id, type: ch.type },
                        })
                        // Near-expiry failure → the operator must reconnect. Dedup the
                        // alert per channel per week so retries don't spam.
                        const daysLeft = Number.isFinite(expiresAtMs)
                                ? expiresAtMs - Date.now()
                                : 0
                        if (daysLeft < 7 * 24 * HOUR_MS) {
                                try {
                                        const redis = getRedis()
                                        const acquired = await redis.set(
                                                `oauth_refresh_alert:${ch.id}`,
                                                '1',
                                                'EX',
                                                7 * 24 * 3600,
                                                'NX',
                                        )
                                        if (acquired) {
                                                await notifyWorkspace({
                                                        workspaceId: ch.agent.workspaceId,
                                                        type: 'CHANNEL_DOWN',
                                                        title: 'اتصال اینستاگرام نیاز به اتصال مجدد دارد',
                                                        body: `تمدید خودکار دسترسی کانال «${ch.agent.name}» ناموفق بود و اعتبار آن به‌زودی تمام می‌شود. لطفاً از بخش کانال‌ها دوباره متصل شوید.`,
                                                        link: '/integrations',
                                                })
                                        }
                                } catch (notifyError) {
                                        console.error('[scheduler] oauth refresh alert failed:', notifyError)
                                }
                        }
                }
        }
}

async function runOauthTokenRefresh(): Promise<void> {
        try {
                await refreshOauthTokens()
        } catch (e) {
                console.error('[scheduler] oauth token refresh sweep failed:', e)
        }
}

// ─── scheduler entry point ──────────────────────────────────────────────────

/** Start periodic tasks. Returns a function that stops them. */
export function startScheduler(): () => void {
        console.log(
                '[scheduler] started — hourly conversation, knowledge, and appointment sweeps + channel health + store sync + retention + billing lifecycle reminders',
        )
        // Kick off shortly after boot, then on their own cadences.
        const initialSweep = setTimeout(runSweep, 30_000)
        const sweepInterval = setInterval(runSweep, HOUR_MS)

        const initialChannel = setTimeout(runChannelCheck, 60_000)
        const channelInterval = setInterval(runChannelCheck, CHANNEL_CHECK_MS)

        const initialStore = setTimeout(runStoreSync, 60_000)
        const storeInterval = setInterval(runStoreSync, STORE_SYNC_INTERVAL_MS)

        const initialKnowledge = setTimeout(runKnowledgeRefresh, 2 * 60_000)
        const knowledgeInterval = setInterval(runKnowledgeRefresh, HOUR_MS)

        const initialProductEmbeddingRepair = setTimeout(runProductEmbeddingRepair, 105_000)
        const productEmbeddingRepairInterval = setInterval(runProductEmbeddingRepair, HOUR_MS)

        const initialAppointments = setTimeout(runAppointmentReminders, 75_000)
        const appointmentInterval = setInterval(
                runAppointmentReminders,
                APPOINTMENT_REMINDER_INTERVAL_MS,
        )

        const initialCleanup = setTimeout(runCleanup, 5 * 60_000)
        const cleanupInterval = setInterval(runCleanup, CLEANUP_INTERVAL_MS)

        const initialSubExpiry = setTimeout(runSubscriptionExpirySweep, 90_000)
        const subExpiryInterval = setInterval(
                runSubscriptionExpirySweep,
                SUBSCRIPTION_SWEEP_INTERVAL_MS,
        )

        const initialTrialLifecycle = setTimeout(runTrialLifecycleSweep, 2 * 60_000)
        const trialLifecycleInterval = setInterval(
                runTrialLifecycleSweep,
                TRIAL_LIFECYCLE_INTERVAL_MS,
        )

        const initialCommercialSms = setTimeout(runAdminCommercialSmsOutbox, 45_000)
        const commercialSmsInterval = setInterval(
                runAdminCommercialSmsOutbox,
                ADMIN_COMMERCIAL_SMS_SWEEP_INTERVAL_MS,
        )

        const initialTokenRefresh = setTimeout(runOauthTokenRefresh, 3 * 60_000)
        const tokenRefreshInterval = setInterval(
                runOauthTokenRefresh,
                TOKEN_REFRESH_INTERVAL_MS,
        )

        return () => {
                clearTimeout(initialSweep)
                clearInterval(sweepInterval)
                clearTimeout(initialChannel)
                clearInterval(channelInterval)
                clearTimeout(initialStore)
                clearInterval(storeInterval)
                clearTimeout(initialKnowledge)
                clearInterval(knowledgeInterval)
                clearTimeout(initialProductEmbeddingRepair)
                clearInterval(productEmbeddingRepairInterval)
                clearTimeout(initialAppointments)
                clearInterval(appointmentInterval)
                clearTimeout(initialCleanup)
                clearInterval(cleanupInterval)
                clearTimeout(initialSubExpiry)
                clearInterval(subExpiryInterval)
                clearTimeout(initialTrialLifecycle)
                clearInterval(trialLifecycleInterval)
                clearTimeout(initialCommercialSms)
                clearInterval(commercialSmsInterval)
                clearTimeout(initialTokenRefresh)
                clearInterval(tokenRefreshInterval)
        }
}
