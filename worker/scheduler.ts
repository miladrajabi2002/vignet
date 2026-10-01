import type { ChannelType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sweepImprovement } from '@/lib/improvement/automation'
import { sweepSkills } from '@/lib/skills/sweep'
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
import { captureError, persistLog } from '@/lib/errors/capture'
import {
        syncWooOrders,
        syncWooProducts,
        resolveWooCredentials,
        type StoreIntegrationInput,
} from '@/lib/integrations/woocommerce'
import { sweepChannelHealth } from '@/lib/channels/health'
import { refreshStaleUrlKnowledge } from '@/lib/integrations/crawler'
import { sweepAdminCommercialSmsOutbox } from '@/lib/billing/admin-commercial-outbox'
import { cleanupOldRecords } from '@/lib/maintenance/data-retention'
import { purgeSoftDeleted } from '@/lib/maintenance/soft-delete-purge'
import { sweepRestockAlerts } from '@/lib/commerce/restock-service'
import { sweepCheckoutLinks } from '@/lib/commerce/checkout-service'
import { sweepCartHolds } from '@/lib/commerce/cart-hold'
import { purgeExpiredOrderWatches } from '@/lib/commerce/order-updates'
import { sweepOperatorDailyReports } from '@/lib/channels/operator-daily-report'
import { sweepLowStockAlerts } from '@/lib/commerce/low-stock'
import { sweepPlanExpiryAlerts } from '@/lib/billing/plan-expiry-alerts'
import { sweepCustomerBookingReminders } from '@/lib/bookings/customer-reminders'
import { sweepCourseReminders } from '@/lib/courses/reminders'

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
const SKILLS_SWEEP_INTERVAL_MS = 6 * HOUR_MS
const SOFT_DELETE_PURGE_INTERVAL_MS = 6 * HOUR_MS
// «موجود شد خبرم کن»: catalog syncs land every few minutes; customers are
// told within ~10 minutes of a product becoming available again.
const RESTOCK_SWEEP_INTERVAL_MS = 10 * 60 * 1000

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
// A20: active health probe cadence (mission: every 5–10 minutes).
const CHANNEL_HEALTH_INTERVAL_MS = 5 * 60_000

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
const KNOWLEDGE_REFRESH_MS = 5 * 60 * 1000 // every 5 minutes; staleness gates real crawls
                                                                                                // (supports 15/30-min source cadences)

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
                        // The panel bell and the manager bot get their own 7/3/1-day
                        // notices (sweepPlanExpiryAlerts); this is the SMS only.
                        await sendSubscriptionExpiringSms(owner.phone, {
                                plan: sub.plan,
                                daysRemaining,
                                currentPeriodEnd: sub.currentPeriodEnd,
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
        'اتصال اولین کانال',
        'تأیید نهایی راه‌اندازی',
] as const

/**
 * Send only milestone SMS messages: one nudge per unfinished step, one success
 * message, and one trial-expiry reminder. Redis keys keep every message unique.
 */
export async function runTrialLifecycleSweep(): Promise<void> {
        const startedAt = Date.now()
        const stats = {
                scanned: 0,
                notDue: 0,
                missingPhone: 0,
                deduplicated: 0,
                attempted: 0,
                delivered: 0,
                failed: 0,
                skippedConfig: 0,
        }

        try {
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
                                onboardingStepUpdatedAt: true,
                                trialEndsAt: true,
                                onboardingStep: true,
                                onboardingCompleted: true,
                                owner: {
                                        select: { phone: true },
                                },
                        },
                        take: 300,
                })
                stats.scanned = workspaces.length
                await persistLog('info', 'scheduler:trial-lifecycle:start', 'Trial lifecycle sweep started', {
                        metadata: { candidates: workspaces.length, reminderHorizon },
                })

                const redis = getRedis()
                for (const workspace of workspaces) {
                        const phone = workspace.owner?.phone
                        if (!phone || !workspace.trialEndsAt) {
                                stats.missingPhone += 1
                                await persistLog('warn', 'scheduler:trial-lifecycle:skipped', 'Trial lifecycle SMS skipped because the owner phone is missing', {
                                        workspaceId: workspace.id,
                                        metadata: { reason: 'missing_owner_phone' },
                                })
                                continue
                        }

                        let kind: 'activation_complete' | 'trial_expiring' | 'activation_reminder'
                        let dedupKey: string
                        let dedupTtlSeconds: number
                        let send: () => Promise<boolean>

                        if (workspace.onboardingCompleted) {
                                // A17: the activation-complete pattern code is empty in .env
                                // (IPPANEL_ACTIVATION_COMPLETE_PATTERN_CODE=""). Sending would
                                // deterministically fail and the dedup release retried it every
                                // sweep — 83 error + 83 retry-warning rows. Skip the milestone
                                // cleanly (stats only) until the pattern is provisioned in the
                                // IPPanel panel and the env var is filled.
                                if (!process.env.IPPANEL_ACTIVATION_COMPLETE_PATTERN_CODE?.trim()) {
                                        stats.skippedConfig += 1
                                        continue
                                }
                                kind = 'activation_complete'
                                dedupKey = `lifecycle_sms:activation_complete:${workspace.id}`
                                dedupTtlSeconds = 45 * 24 * 3600
                                send = () => sendActivationCompleteSms(phone, {
                                        workspaceId: workspace.id,
                                        metadata: { lifecycleKind: kind },
                                })
                        } else if (workspace.trialEndsAt <= reminderHorizon) {
                                kind = 'trial_expiring'
                                const period = workspace.trialEndsAt.getTime().toString(36)
                                const daysRemaining = Math.max(
                                        1,
                                        Math.ceil((workspace.trialEndsAt.getTime() - now.getTime()) / (24 * HOUR_MS)),
                                )
                                dedupKey = `lifecycle_sms:trial_expiring:${workspace.id}:${period}`
                                dedupTtlSeconds = 7 * 24 * 3600
                                send = () => sendTrialExpiringSms(phone, { daysRemaining }, {
                                        workspaceId: workspace.id,
                                        metadata: { lifecycleKind: kind, daysRemaining, trialEndsAt: workspace.trialEndsAt },
                                })
                        } else {
                                const inactiveMs = now.getTime() - workspace.onboardingStepUpdatedAt.getTime()
                                if (inactiveMs < 24 * HOUR_MS) {
                                        stats.notDue += 1
                                        continue
                                }
                                kind = 'activation_reminder'
                                const step = Math.min(workspace.onboardingStep, ONBOARDING_NEXT_STEP_FA.length - 1)
                                const nextStep = ONBOARDING_NEXT_STEP_FA[step]
                                dedupKey = `lifecycle_sms:activation_step:${workspace.id}:${step}`
                                dedupTtlSeconds = 21 * 24 * 3600
                                send = () => sendActivationReminderSms(phone, { nextStep }, {
                                        workspaceId: workspace.id,
                                        metadata: {
                                                lifecycleKind: kind,
                                                onboardingStep: step,
                                                nextStep,
                                                inactiveHours: Math.floor(inactiveMs / HOUR_MS),
                                        },
                                })
                        }

                        let acquired = false
                        try {
                                acquired = Boolean(await redis.set(dedupKey, '1', 'EX', dedupTtlSeconds, 'NX'))
                                if (!acquired) {
                                        stats.deduplicated += 1
                                        continue
                                }

                                stats.attempted += 1
                                const delivered = await send()
                                if (delivered) {
                                        stats.delivered += 1
                                        await persistLog('info', 'scheduler:trial-lifecycle:delivered', 'Trial lifecycle SMS delivery was accepted', {
                                                workspaceId: workspace.id,
                                                metadata: { lifecycleKind: kind, dedupKey },
                                        })
                                        continue
                                }

                                await redis.del(dedupKey)
                                acquired = false
                                stats.failed += 1
                                await persistLog('warn', 'scheduler:trial-lifecycle:retry-enabled', 'Trial lifecycle SMS failed; deduplication claim was released for retry', {
                                        workspaceId: workspace.id,
                                        metadata: { lifecycleKind: kind, dedupKey },
                                })
                        } catch (error) {
                                stats.failed += 1
                                if (acquired) {
                                        await redis.del(dedupKey).catch((releaseError) => {
                                                captureError('scheduler:trial-lifecycle:dedup-release', releaseError, {
                                                        workspaceId: workspace.id,
                                                        metadata: { lifecycleKind: kind, dedupKey },
                                                })
                                        })
                                }
                                await persistLog('error', 'scheduler:trial-lifecycle:workspace-failed', error, {
                                        workspaceId: workspace.id,
                                        metadata: { lifecycleKind: kind, dedupKey },
                                })
                        }
                }

                await persistLog('info', 'scheduler:trial-lifecycle:complete', 'Trial lifecycle sweep completed', {
                        metadata: { ...stats, durationMs: Date.now() - startedAt },
                })
        } catch (error) {
                await persistLog('error', 'scheduler:trial-lifecycle:sweep-failed', error, {
                        metadata: { ...stats, durationMs: Date.now() - startedAt },
                })
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
        const runImprovementSweep = () => sweepImprovement().catch(() => console.error('[scheduler] improvement sweep failed'))
        const initialImprovement = setTimeout(runImprovementSweep, 120_000)
        const improvementInterval = setInterval(runImprovementSweep, HOUR_MS)
        const initialSweep = setTimeout(runSweep, 30_000)
        const sweepInterval = setInterval(runSweep, HOUR_MS)

        const initialChannel = setTimeout(runChannelCheck, 60_000)
        const channelInterval = setInterval(runChannelCheck, CHANNEL_CHECK_MS)

        const initialStore = setTimeout(runStoreSync, 60_000)
        const storeInterval = setInterval(runStoreSync, STORE_SYNC_INTERVAL_MS)

        const initialKnowledge = setTimeout(runKnowledgeRefresh, 2 * 60_000)
        const knowledgeInterval = setInterval(runKnowledgeRefresh, KNOWLEDGE_REFRESH_MS)

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

        // ─ A20: real periodic channel health checks (getMe / token validity / SMS
        // proxy). Every 5 minutes; first run shortly after boot so the dashboard
        // has a true status quickly.
        const runChannelHealthSweep = async () => {
                try {
                        const stats = await sweepChannelHealth()
                        if (stats.down > 0) {
                                console.log(`[scheduler] channel health: ${stats.down}/${stats.checked} down (${stats.notified} notified, ${stats.disabled} auto-disabled)`)
                        }
                } catch (e) {
                        console.error('[scheduler] channel health sweep failed:', e)
                }
        }
        const initialChannelHealth = setTimeout(runChannelHealthSweep, 90_000)
        const channelHealthInterval = setInterval(runChannelHealthSweep, CHANNEL_HEALTH_INTERVAL_MS)

        // ─ Admin improvement skills: a FREE pass every 6 hours keeps the
        // SkillFinding board fresh (knowledge gaps, tool failures, regression
        // guards, before/after metrics). Only TODAY's conversations are
        // reviewed — older findings are auto-resolved as stale. DEEP skills
        // stay manual-only.
        const runSkillsSweep = () => sweepSkills().catch(() => console.error('[scheduler] skills sweep failed'))
        const initialSkills = setTimeout(runSkillsSweep, 4 * 60_000)
        const skillsInterval = setInterval(runSkillsSweep, SKILLS_SWEEP_INTERVAL_MS)

        // ─ Soft-delete retention: physically remove rows that were trashed
        // more than 7 days ago (bulk-delete undo window is long over). Runs
        // every 6 hours; first run a few minutes after boot.
        const runSoftDeletePurge = () => purgeSoftDeleted()
                .then(() => purgeExpiredOrderWatches())
                .catch((e) => console.error('[scheduler] soft-delete purge failed:', e))
        const initialSoftDeletePurge = setTimeout(runSoftDeletePurge, 6 * 60_000)
        const softDeletePurgeInterval = setInterval(runSoftDeletePurge, SOFT_DELETE_PURGE_INTERVAL_MS)

        const runRestockSweep = async () => {
                try {
                        const stats = await sweepRestockAlerts()
                        if (stats.notified || stats.followUp || stats.failed) {
                                console.log(`[scheduler] restock alerts: ${stats.notified} notified, ${stats.followUp} follow-up, ${stats.failed} retry (${stats.checked} checked)`)
                        }
                } catch (e) {
                        console.error('[scheduler] restock sweep failed:', e)
                }
        }
        const initialRestock = setTimeout(runRestockSweep, 3 * 60_000)
        const restockInterval = setInterval(runRestockSweep, RESTOCK_SWEEP_INTERVAL_MS)

        // In-chat checkout: expire unpaid payment links and send one reminder
        // an hour after an unpaid link (push channels only).
        const runCheckoutSweep = async () => {
                try {
                        const stats = await sweepCheckoutLinks()
                        if (stats.reminded || stats.expired) {
                                console.log(`[scheduler] checkout links: ${stats.reminded} reminded, ${stats.expired} expired`)
                        }
                } catch (e) {
                        console.error('[scheduler] checkout sweep failed:', e)
                }
        }
        const initialCheckout = setTimeout(runCheckoutSweep, 2 * 60_000)
        const checkoutInterval = setInterval(runCheckoutSweep, 5 * 60_000)

        // Cart hold (agent.cartHoldEnabled): the 30-minutes-left reminder and
        // the end of the one-hour hold, when sold-out lines leave the cart.
        const runCartHoldSweep = async () => {
                try {
                        const stats = await sweepCartHolds()
                        if (stats.reminded || stats.trimmed) {
                                console.log(`[scheduler] cart holds: ${stats.reminded} reminded, ${stats.released} released, ${stats.trimmed} trimmed`)
                        }
                } catch (e) {
                        // Until the migration is applied the hold columns do not
                        // exist (P2022 / unknown field): nothing is held yet.
                        const schemaNotReady = (e as { code?: string })?.code === 'P2022'
                                || (e as { name?: string })?.name === 'PrismaClientValidationError'
                        if (!schemaNotReady) console.error('[scheduler] cart hold sweep failed:', e)
                }
        }
        const initialCartHold = setTimeout(runCartHoldSweep, 90_000)
        const cartHoldInterval = setInterval(runCartHoldSweep, 2 * 60_000)

        // Manager bot «گزارش صبحگاهی»: checked every 10 minutes, sent once per
        // Tehran day from 09:00 (idempotent via Redis).
        const runOperatorDailyReports = () => sweepOperatorDailyReports().catch((e) => console.error('[scheduler] operator daily report failed:', e))
        const initialOperatorDaily = setTimeout(runOperatorDailyReports, 4 * 60_000)
        const operatorDailyInterval = setInterval(runOperatorDailyReports, 10 * 60_000)

        // Until the migration lands the new columns/tables do not exist
        // (P2021/P2022, or a raw-query 42703): the sweep simply waits.
        const schemaPending = (e: unknown) => {
                const code = (e as { code?: string; meta?: { code?: string } })?.code
                return code === 'P2021' || code === 'P2022' || code === 'P2010'
                        || (e as { name?: string })?.name === 'PrismaClientValidationError'
        }

        // Low stock → owner (panel + manager bot «موجودی کم محصول»).
        const runLowStockSweep = async () => {
                try {
                        const alerted = await sweepLowStockAlerts()
                        if (alerted) console.log(`[scheduler] low-stock alerts: ${alerted} product(s)`)
                } catch (e) {
                        if (!schemaPending(e)) console.error('[scheduler] low-stock sweep failed:', e)
                }
        }
        const initialLowStock = setTimeout(runLowStockSweep, 150_000)
        const lowStockInterval = setInterval(runLowStockSweep, 10 * 60_000)

        // Plan / trial ending in 7, 3 or 1 day(s) → panel + manager bot.
        const runPlanExpiryAlerts = () => sweepPlanExpiryAlerts()
                .then((sent) => { if (sent) console.log(`[scheduler] plan-expiry alerts: ${sent}`) })
                .catch((e) => console.error('[scheduler] plan-expiry alerts failed:', e))
        const initialPlanExpiry = setTimeout(runPlanExpiryAlerts, 100_000)
        const planExpiryInterval = setInterval(runPlanExpiryAlerts, HOUR_MS)

        // Booking and course reminders to the customer, in their conversation.
        const runCustomerReminders = async () => {
                try {
                        const bookings = await sweepCustomerBookingReminders()
                        const courses = await sweepCourseReminders()
                        if (bookings.sent || bookings.skipped || courses.sent) {
                                console.log(`[scheduler] customer reminders: ${bookings.sent} booking sent, ${bookings.skipped} skipped, ${courses.sent} course sent`)
                        }
                } catch (e) {
                        if (!schemaPending(e)) console.error('[scheduler] customer reminders failed:', e)
                }
        }
        const initialCustomerReminders = setTimeout(runCustomerReminders, 80_000)
        const customerRemindersInterval = setInterval(runCustomerReminders, 10 * 60_000)

        return () => {
                clearTimeout(initialLowStock)
                clearInterval(lowStockInterval)
                clearTimeout(initialPlanExpiry)
                clearInterval(planExpiryInterval)
                clearTimeout(initialCustomerReminders)
                clearInterval(customerRemindersInterval)
                clearTimeout(initialCheckout)
                clearInterval(checkoutInterval)
                clearTimeout(initialCartHold)
                clearInterval(cartHoldInterval)
                clearTimeout(initialOperatorDaily)
                clearInterval(operatorDailyInterval)
                clearTimeout(initialRestock)
                clearInterval(restockInterval)
                clearTimeout(initialImprovement)
                clearInterval(improvementInterval)
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
                clearTimeout(initialChannelHealth)
                clearInterval(channelHealthInterval)
                clearTimeout(initialSkills)
                clearInterval(skillsInterval)
                clearTimeout(initialSoftDeletePurge)
                clearInterval(softDeletePurgeInterval)
        }
}
