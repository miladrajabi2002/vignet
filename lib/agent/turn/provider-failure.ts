/**
 * Consecutive provider failures (moved from chat-engine.ts): after a streak
 * the owner is notified and the failing conversations go to an operator.
 */
import type { ChannelType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'
import { notifyWorkspace } from '@/lib/notifications/create'
import { notifyHandoff } from '@/lib/ai/handoff'

// ─ A4: consecutive provider-failure escalation ──────────────────────────────
// A single failed completion answers with the fallback text. But consecutive
// failures (provider outage, bad platform key, exhausted daily budget) must
// surface to the workspace owner AND hand the current conversation to an
// operator so customers do not keep receiving the apology text forever.
const PROVIDER_FAILURE_STREAK_WINDOW_S = 30 * 60
const PROVIDER_FAILURE_STREAK_THRESHOLD = 3
const providerFailureStreakKey = (workspaceId: string) => `provider-fail-streak:${workspaceId}`

export async function resetProviderFailureStreak(workspaceId: string): Promise<void> {
        await getRedis().del(providerFailureStreakKey(workspaceId)).catch(() => {})
}

export async function trackProviderFailureStreak(params: {
        workspaceId: string
        conversationId: string
        agentId: string
        channel: ChannelType
        contactId: string | null
        contactName: string | null
}): Promise<void> {
        try {
                const redis = getRedis()
                const key = providerFailureStreakKey(params.workspaceId)
                const streak = await redis.incr(key)
                if (streak === 1) await redis.expire(key, PROVIDER_FAILURE_STREAK_WINDOW_S).catch(() => {})
                if (streak < PROVIDER_FAILURE_STREAK_THRESHOLD) return
                const agentRow = await prisma.agent.findUnique({
                        where: { id: params.agentId },
                        select: { name: true },
                })
                // Notify the owner once per window, when the streak crosses the
                // threshold; every failing thread from then on is still handed over.
                if (streak === PROVIDER_FAILURE_STREAK_THRESHOLD) {
                        await notifyWorkspace({
                                workspaceId: params.workspaceId,
                                type: 'SYSTEM',
                                title: 'خطای پیوسته در سرویس هوش مصنوعی',
                                body: `در ۳۰ دقیقه اخیر ${streak} پاسخ با خطای سرویس AI مواجه شد. مشتریان پیام «مشکل فنی» می‌گیرند و گفتگوهای اخیر به اپراتور ارجاع شده‌اند.`,
                                link: '/conversations',
                        }).catch(() => {})
                }
                await notifyHandoff({
                        workspaceId: params.workspaceId,
                        conversationId: params.conversationId,
                        agentId: params.agentId,
                        agentName: agentRow?.name ?? 'ایجنت',
                        channel: params.channel,
                        contactId: params.contactId,
                        contactName: params.contactName,
                        contactPhone: null,
                        reason: `خطای پیوسته سرویس AI (${streak} مورد متوالی)؛ گفتگو به اپراتور ارجاع شد`,
                }).catch(() => {})
                await prisma.conversation.updateMany({
                        where: { id: params.conversationId },
                        data: { handedOff: true, status: 'HANDED_OFF' },
                }).catch(() => {})
        } catch (e) {
                console.error('[chat-engine] failure streak tracking failed:', e)
        }
}
