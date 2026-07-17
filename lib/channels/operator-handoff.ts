/**
 * OPERATOR HANDOFF (F3)
 * ======================
 *
 * When an agent escalates a conversation to a human operator, this module:
 *   1. Creates a HandoffAlert row (snapshot of customer identity + summary).
 *   2. Detects which messenger channels the agent is connected to
 *      (Telegram/Bale/Rubika) so the operator panel can offer "go to that
 *      channel" links.
 *   3. If the workspace has an OperatorChannel (operator Telegram bot) configured,
 *      pushes the alert to that bot so the operator sees it in Telegram too.
 *
 * The operator then replies either:
 *   (a) inside the dashboard conversations panel (handled by the existing
 *       /api/conversations/[id]/reply route), OR
 *   (b) by replying to the Telegram bot (handled by
 *       /api/telegram-operator/webhook → routes the reply back to the customer's
 *       original channel).
 */

import type { ChannelType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import { notifyWorkspace } from '@/lib/notifications/create'
import { sendOutbound } from '@/lib/channels/outbound'
import { captureError } from '@/lib/errors/capture'
import { bumpContactActivity } from '@/lib/crm/contact-activity'
import { ensureConversationSummary } from '@/lib/conversations/summary'
import { recordConversationActivity } from '@/lib/conversations/activity'

/**
 * Decrypt the stored OperatorChannel.botToken. The column is TEXT and stores the
 * AES-256-GCM payload produced by `encrypt()` (iv:authTag:ciphertext). Returns
 * null when no token is set or the payload can't be decrypted.
 */
export function readOperatorBotToken(stored: string | null | undefined): string | null {
        if (!stored) return null
        try {
                return decrypt(stored)
        } catch {
                return null
        }
}

export interface HandoffContext {
        workspaceId: string
        conversationId: string
        agentId: string
        agentName: string
        channel: ChannelType
        contactId: string | null
        contactName: string | null
        contactPhone: string | null
        reason: string
        summary?: string | null
}

/**
 * Connected messenger channels for the agent — used by the UI to show
 * "go to Telegram/Bale/Rubika" buttons when handoff happens.
 */
export async function getConnectedMessengerChannels(
        agentId: string,
): Promise<ChannelType[]> {
        const channels = await prisma.agentChannel.findMany({
                where: { agentId, active: true },
                select: { type: true },
        })
        const messengerTypes: ChannelType[] = ['TELEGRAM', 'BALE', 'RUBIKA', 'WHATSAPP', 'INSTAGRAM']
        return channels
                .map((c) => c.type)
                .filter((t): t is ChannelType => (messengerTypes as string[]).includes(t))
}

/**
 * Create a HandoffAlert row + push the alert to the operator Telegram bot
 * (if configured) + fire an in-app notification. Returns the alert id.
 */
export async function createHandoffAlert(ctx: HandoffContext): Promise<string | null> {
        try {
                // Snapshot the conversation summary if not provided.
                let summary = ctx.summary ?? null
                if (!summary) {
                        // Persist a deterministic summary on the synchronous path.
                        // Provider-backed enhancement happens after the alert exists.
                        summary = (
                                await ensureConversationSummary(ctx.conversationId, {
                                        preferAi: false,
                                })
                        ).summary
                }

                const alert = await prisma.$transaction(async (tx) => {
                        const created = await tx.handoffAlert.create({
                                data: {
                                        workspaceId: ctx.workspaceId,
                                        conversationId: ctx.conversationId,
                                        agentId: ctx.agentId,
                                        contactName: ctx.contactName,
                                        contactPhone: ctx.contactPhone,
                                        channel: ctx.channel,
                                        reason: ctx.reason,
                                        summary,
                                        state: 'open',
                                },
                                select: { id: true },
                        })
                        await recordConversationActivity(tx, ctx.conversationId, {
                                kind: 'handoff_ready',
                                summaryReady: Boolean(summary),
                                source: 'agent',
                        })
                        return created
                })

                // Improve the fallback with the platform's economical model out
                // of band. No prompt/customer text is added to admin telemetry.
                void ensureConversationSummary(ctx.conversationId, {
                        preferAi: true,
                        replaceExisting: true,
                })
                        .then((result) => {
                                if (result.source !== 'ai' || !result.summary) return
                                return prisma.handoffAlert.update({
                                        where: { id: alert.id },
                                        data: { summary: result.summary },
                                })
                        })
                        .catch(() => {})

                // External fan-out must not delay the customer's chat response.
                // The database alert, activity, and fallback summary are durable.
                void notifyWorkspace({
                        workspaceId: ctx.workspaceId,
                        type: 'HANDOFF',
                        title: 'گفتگو به اپراتور انسانی منتقل شد',
                        body: `یک مکالمه نیاز به پاسخ شما دارد.${ctx.contactName ? ` مشتری: ${ctx.contactName}` : ''}`,
                        link: `/conversations/${ctx.conversationId}`,
                        sms: true,
                }).catch(() => {})

                // Push to operator Telegram bot if configured.
                void pushAlertToOperatorBot(ctx.workspaceId, alert.id, {
                        ...ctx,
                        summary,
                }).catch((e) => {
                        captureError('operator-handoff:telegram-push', e, {
                                workspaceId: ctx.workspaceId,
                                metadata: { alertId: alert.id, conversationId: ctx.conversationId },
                        })
                })

                return alert.id
        } catch (e) {
                captureError('operator-handoff:create', e, {
                        workspaceId: ctx.workspaceId,
                        metadata: { conversationId: ctx.conversationId },
                })
                return null
        }
}

// ─────────────────────────────────────────────────────────────────────
// Operator Telegram bot push
// ─────────────────────────────────────────────────────────────────────

async function pushAlertToOperatorBot(
        workspaceId: string,
        alertId: string,
        ctx: HandoffContext,
): Promise<void> {
        const op = await prisma.operatorChannel.findUnique({
                where: { workspaceId },
        })
        if (!op || !op.active || !op.operatorChatId) return
        const botToken = readOperatorBotToken(op.botToken)
        if (!botToken) return

        const text = formatOperatorAlertMessage(ctx)
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/$/, '')
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`
        const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                        chat_id: op.operatorChatId,
                        text,
                        parse_mode: 'HTML',
                        reply_markup: {
                                inline_keyboard: [
                                        [
                                                        {
                                                                text: 'پاسخ در پنل ویجنت',
                                                                url: `${appUrl}/conversations/${encodeURIComponent(ctx.conversationId)}`,
                                                        },
                                        ],
                                ],
                        },
                }),
                signal: AbortSignal.timeout(8_000),
        })
        if (!res.ok) {
                const errText = await res.text().catch(() => '')
                throw new Error(`Telegram sendMessage failed: ${res.status} ${errText}`)
        }
        const data = (await res.json()) as { ok: boolean; result?: { message_id: number } }
        if (data.ok && data.result?.message_id) {
                await prisma.handoffAlert.update({
                        where: { id: alertId },
                        data: { externalMessageId: String(data.result.message_id) },
                })
        }
}

function escapeTelegramHtml(value: string): string {
        return value
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
}

function formatOperatorAlertMessage(ctx: HandoffContext): string {
        const lines: string[] = []
        lines.push('🔔 <b>انتقال به اپراتور</b>')
        lines.push('')
        lines.push(`👤 <b>مشتری:</b> ${escapeTelegramHtml(ctx.contactName || 'ناشناس')}`)
        if (ctx.contactPhone) lines.push(`📞 <b>شماره:</b> ${escapeTelegramHtml(ctx.contactPhone)}`)
        lines.push(`📱 <b>کانال:</b> ${escapeTelegramHtml(ctx.channel)}`)
        lines.push(`🤖 <b>ایجنت:</b> ${escapeTelegramHtml(ctx.agentName)}`)
        lines.push(`📝 <b>دلیل:</b> ${escapeTelegramHtml(ctx.reason)}`)
        if (ctx.summary) {
                lines.push('')
                lines.push('📋 <b>خلاصه گفتگو:</b>')
                lines.push(escapeTelegramHtml(ctx.summary))
        }
        lines.push('')
        lines.push(`💬 شناسه گفتگو: <code>${escapeTelegramHtml(ctx.conversationId)}</code>`)
        return lines.join('\n')
}

/**
 * Route an operator reply (coming from the operator Telegram bot) back to the
 * customer's original channel. Used by /api/telegram-operator/webhook.
 *
 * The operator's message is matched to an open handoff alert by the Telegram
 * message_id we stored, which gives us the conversationId → channel + externalId.
 */
export async function routeOperatorReplyFromTelegram(params: {
        workspaceId: string
        telegramMessageId: string
        operatorText: string
}): Promise<{ ok: boolean; reason?: string }> {
        const alert = await prisma.handoffAlert.findFirst({
                where: {
                        workspaceId: params.workspaceId,
                        externalMessageId: params.telegramMessageId,
                        state: { in: ['open', 'claimed'] },
                },
                select: {
                        id: true,
                        conversationId: true,
                        conversation: { select: { agentId: true, channel: true, externalId: true } },
                },
        })
        if (!alert) return { ok: false, reason: 'no open alert for that message' }
        if (!alert.conversation.externalId) {
                return { ok: false, reason: 'conversation has no external id' }
        }

        let delivered = false
        try {
                delivered = await sendOutbound(
                        alert.conversation.agentId,
                        alert.conversation.channel,
                        alert.conversation.externalId,
                        params.operatorText,
                )
        } catch (e) {
                captureError('operator-handoff:route-reply', e, {
                        workspaceId: params.workspaceId,
                        metadata: { conversationId: alert.conversationId },
                })
                return { ok: false, reason: 'delivery failed' }
        }

        if (delivered) {
                await prisma.message.create({
                        data: {
                                conversationId: alert.conversationId,
                                role: 'ASSISTANT',
                                content: params.operatorText,
                                metadata: { operator: true, source: 'telegram_bot' },
                        },
                })
                await recordConversationActivity(prisma, alert.conversationId, {
                        kind: 'operator_reply',
                        source: 'telegram_bot',
                }).catch(() => {})
                await prisma.conversation.update({
                        where: { id: alert.conversationId },
                        data: {
                                status: 'HANDED_OFF',
                                messageCount: { increment: 1 },
                                lastMessageAt: new Date(),
                        },
                })
                // Keep the contact's denormalized last-activity fresh for the CRM list.
                bumpContactActivity(alert.conversationId)
                await prisma.handoffAlert.update({
                        where: { id: alert.id },
                        data: { state: 'claimed' },
                })
        }
        return { ok: delivered }
}
