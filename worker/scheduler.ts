import type { ChannelType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { dispatchSummary } from '@/lib/queue/jobs'
import { MESSENGER_TYPES } from '@/lib/channels/registry'
import { notifyWorkspace } from '@/lib/notifications/create'
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
                        sms: true,
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

const STORE_SYNC_INTERVAL_MS = 10 * 60 * 1000 // every 10 minutes

/**
 * Find every active store integration whose `pollIntervalMinutes` has elapsed
 * since `lastSyncAt` and re-sync its products + orders. For non-WooCommerce
 * types (CUSTOM_URL) the polling path is a no-op — those are handled by the
 * URL crawler instead. Per-integration errors are caught and logged so a
 * single failing store doesn't block the rest.
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

        for (const row of rows) {
                if (row.type !== 'WOOCOMMERCE') continue
                const lastMs = row.lastSyncAt ? row.lastSyncAt.getTime() : 0
                const elapsed = now - lastMs
                if (elapsed < row.pollIntervalMinutes * 60 * 1000) continue

                let credentials
                try {
                        credentials = resolveWooCredentials(row.credentials)
                } catch (e) {
                        console.error(
                                `[scheduler] store ${row.id} credential resolve failed:`,
                                e instanceof Error ? e.message : e,
                        )
                        continue
                }

                const integration: StoreIntegrationInput = {
                        id: row.id,
                        workspaceId: row.workspaceId,
                        storeUrl: row.storeUrl,
                        credentials,
                }

                try {
                        const products = await syncWooProducts(integration)
                        const orders = await syncWooOrders(integration, { sinceDays: 30 })
                        console.log(
                                `[scheduler] store ${row.id} synced: ${products.count} products, ${orders.count} orders`,
                        )
                } catch (e) {
                        console.error(
                                `[scheduler] store ${row.id} sync failed:`,
                                e instanceof Error ? e.message : e,
                        )
                }
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
const RETENTION_DAYS = 30

/**
 * Prune unbounded audit tables daily: OTP logs, error logs and store sync logs
 * older than RETENTION_DAYS. Keeps these tables from growing forever (OTPLog
 * gets a row per login attempt, ErrorLog per captured error).
 */
async function cleanupOldRecords(): Promise<void> {
        const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * HOUR_MS)
        const [otp, errors, syncLogs] = await Promise.all([
                prisma.oTPLog.deleteMany({ where: { sentAt: { lt: cutoff } } }),
                prisma.errorLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
                prisma.storeSyncLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
        ])
        const total = otp.count + errors.count + syncLogs.count
        if (total > 0) {
                console.log(
                        `[scheduler] retention cleanup: ${otp.count} OTP, ${errors.count} error, ${syncLogs.count} sync log rows deleted`,
                )
        }
}

async function runCleanup(): Promise<void> {
        try {
                await cleanupOldRecords()
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

        return () => {
                clearTimeout(initialSweep)
                clearInterval(sweepInterval)
                clearTimeout(initialChannel)
                clearInterval(channelInterval)
                clearTimeout(initialStore)
                clearInterval(storeInterval)
                clearTimeout(initialKnowledge)
                clearInterval(knowledgeInterval)
                clearTimeout(initialAppointments)
                clearInterval(appointmentInterval)
                clearTimeout(initialCleanup)
                clearInterval(cleanupInterval)
                clearTimeout(initialSubExpiry)
                clearInterval(subExpiryInterval)
                clearTimeout(initialTrialLifecycle)
                clearInterval(trialLifecycleInterval)
        }
}
