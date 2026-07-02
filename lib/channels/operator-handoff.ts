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
                        const conv = await prisma.conversation.findUnique({
                                where: { id: ctx.conversationId },
                                select: { summary: true },
                        })
                        summary = conv?.summary ?? null
                }

                const alert = await prisma.handoffAlert.create({
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

                // In-app + SMS notification (existing flow).
                await notifyWorkspace({
                        workspaceId: ctx.workspaceId,
                        type: 'HANDOFF',
                        title: 'گفتگو به اپراتور انسانی منتقل شد',
                        body: `یک مکالمه نیاز به پاسخ شما دارد.${ctx.contactName ? ` مشتری: ${ctx.contactName}` : ''}`,
                        link: `/conversations/${ctx.conversationId}`,
                        sms: true,
                }).catch(() => {})

                // Push to operator Telegram bot if configured.
                await pushAlertToOperatorBot(ctx.workspaceId, alert.id, ctx).catch((e) => {
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

/**
 * Mark a handoff alert as resolved (operator answered or conversation closed).
 */
export async function resolveHandoffAlert(
        workspaceId: string,
        conversationId: string,
): Promise<void> {
        await prisma.handoffAlert
                .updateMany({
                        where: { workspaceId, conversationId, state: { in: ['open', 'claimed'] } },
                        data: { state: 'resolved', resolvedAt: new Date() },
                })
                .catch(() => {})
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
                                                        url: `https://vigent.ir/conversations/${ctx.conversationId}`,
                                                },
                                        ],
                                ],
                        },
                }),
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

function formatOperatorAlertMessage(ctx: HandoffContext): string {
        const lines: string[] = []
        lines.push('🔔 <b>انتقال به اپراتور</b>')
        lines.push('')
        lines.push(`👤 <b>مشتری:</b> ${ctx.contactName || 'ناشناس'}`)
        if (ctx.contactPhone) lines.push(`📞 <b>شماره:</b> ${ctx.contactPhone}`)
        lines.push(`📱 <b>کانال:</b> ${ctx.channel}`)
        lines.push(`🤖 <b>ایجنت:</b> ${ctx.agentName}`)
        lines.push(`📝 <b>دلیل:</b> ${ctx.reason}`)
        if (ctx.summary) {
                lines.push('')
                lines.push('📋 <b>خلاصه گفتگو:</b>')
                lines.push(ctx.summary)
        }
        lines.push('')
        lines.push(`💬 شناسه گفتگو: <code>${ctx.conversationId}</code>`)
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
                await prisma.conversation.update({
                        where: { id: alert.conversationId },
                        data: {
                                status: 'HANDED_OFF',
                                messageCount: { increment: 1 },
                                lastMessageAt: new Date(),
                        },
                })
                await prisma.handoffAlert.update({
                        where: { id: alert.id },
                        data: { state: 'claimed' },
                })
        }
        return { ok: delivered }
}
