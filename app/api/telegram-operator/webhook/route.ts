import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readOperatorBotToken } from '@/lib/channels/operator-handoff'
import { routeOperatorReplyFromTelegram } from '@/lib/channels/operator-handoff'
import { captureError } from '@/lib/errors/capture'

export const dynamic = 'force-dynamic'

/**
 * Telegram operator bot webhook (F3).
 *
 * Telegram calls POST /api/telegram-operator/webhook?token={botToken} whenever
 * the operator sends a message to the bot. We:
 *   1. Look up the OperatorChannel by bot token (decrypted at rest). If no
 *      match, silently 200 — Telegram retries aggressively.
 *   2. Reject any update whose chat id ≠ op.operatorChatId — only the operator
 *      chat is allowed to drive replies through this bot.
 *   3. For /start — send a welcome message.
 *      For /chats and /open — list open handoff alerts for this workspace.
 *      For a reply-to-message — find the HandoffAlert whose
 *      externalMessageId matches the replied message_id, then route the
 *      operator's text back to the customer's original channel.
 *   4. Always 200 within ~3s. Long work is awaited (it's fast in practice)
 *      but wrapped so any failure still returns 200.
 *
 * NOTE: The bot token is in the URL path because Telegram can only send the
 * webhook to a fixed URL — we registered it that way in
 * /api/operator-channel POST. The lookup-by-token below is the auth check.
 */

interface TgMessage {
	message_id: number
	chat: { id: number }
	text?: string
	reply_to_message?: { message_id: number }
}
interface TgUpdate {
	update_id: number
	message?: TgMessage
}

async function tgSendMessage(botToken: string, chatId: string, text: string) {
	try {
		await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
		})
	} catch {
		// Swallow — best-effort reply.
	}
}

export async function POST(req: Request) {
	const url = new URL(req.url)
	const tokenParam = url.searchParams.get('token')
	if (!tokenParam) return NextResponse.json({ ok: true })

	const update = (await req.json().catch(() => null)) as TgUpdate | null
	if (!update || !update.message) return NextResponse.json({ ok: true })

	// Find the OperatorChannel by matching its decrypted bot token. One query
	// per webhook is acceptable here (operator traffic is low volume). Cache
	// later if needed.
	const candidates = await prisma.operatorChannel.findMany({
		where: { active: true },
		select: {
			id: true,
			workspaceId: true,
			botToken: true,
			operatorChatId: true,
			botUsername: true,
		},
	})
	const op = candidates.find((c) => readOperatorBotToken(c.botToken) === tokenParam)
	if (!op) return NextResponse.json({ ok: true })

	// Only accept messages from the configured operator chat id.
	if (!op.operatorChatId || String(update.message.chat.id) !== op.operatorChatId) {
		return NextResponse.json({ ok: true })
	}

	const botToken = readOperatorBotToken(op.botToken)
	if (!botToken) return NextResponse.json({ ok: true })

	const text = (update.message.text ?? '').trim()
	const repliedMsgId = update.message.reply_to_message?.message_id

	try {
		// Case 1: operator replied to one of our alert messages → route back to
		// the customer's original channel.
		if (repliedMsgId && text && !text.startsWith('/')) {
			await routeOperatorReplyFromTelegram({
				workspaceId: op.workspaceId,
				telegramMessageId: String(repliedMsgId),
				operatorText: text,
			})
			await tgSendMessage(
				botToken,
				op.operatorChatId,
				'✅ پیام شما برای مشتری ارسال شد.',
			)
			return NextResponse.json({ ok: true })
		}

		// Case 2: slash commands.
		if (text === '/start') {
			const welcome =
				`👋 سلام اپراتور عزیز.\n` +
				`این باتِ <b>Vigent</b> برای دریافت هشدارهای انتقال گفتگو به اپراتور است.\n\n` +
				`وقتی گفتگویی به شما ارجاع داده شود، اینجا پیام می‌گیرید.\n` +
				`برای پاسخ، کافی است روی پیام هشدار <b>reply</b> بزنید و متن پاسخ را بنویسید.\n\n` +
				`دستورات:\n` +
				`<code>/chats</code> — فهرست گفتگوهای بازِ منتظر اپراتور\n` +
				`<code>/open</code> — همان /chats`
			await tgSendMessage(botToken, op.operatorChatId, welcome)
			return NextResponse.json({ ok: true })
		}

		if (text === '/chats' || text === '/open') {
			const alerts = await prisma.handoffAlert.findMany({
				where: {
					workspaceId: op.workspaceId,
					state: { in: ['open', 'claimed'] },
								},
				orderBy: { createdAt: 'desc' },
				take: 10,
				select: {
					id: true,
					contactName: true,
					contactPhone: true,
					channel: true,
					reason: true,
					createdAt: true,
					conversationId: true,
				},
			})
			if (alerts.length === 0) {
				await tgSendMessage(
					botToken,
					op.operatorChatId,
					'📭 در حال حاضر گفتگوی منتظر اپراتوری وجود ندارد.',
				)
				return NextResponse.json({ ok: true })
			}
			const lines = ['📋 <b>گفتگوهای منتظر اپراتور</b>', '']
			for (const a of alerts) {
				const who = a.contactName || a.contactPhone || 'ناشناس'
				lines.push(
					`• <b>${who}</b> — ${a.channel}` +
						(a.reason ? `\n   دلیل: ${a.reason}` : '') +
						`\n   🔗 https://vigent.ir/conversations/${a.conversationId}`,
				)
			}
			await tgSendMessage(botToken, op.operatorChatId, lines.join('\n'))
			return NextResponse.json({ ok: true })
		}

		// Case 3: free text without a reply target — nudge the operator.
		if (text && !text.startsWith('/')) {
			await tgSendMessage(
				botToken,
				op.operatorChatId,
				'ℹ️ برای پاسخ به یک گفتگو، روی پیام هشدار <b>reply</b> بزنید ' +
					'یا از پنل ویجنت پاسخ بدهید.',
			)
		}
	} catch (e) {
		captureError('operator-webhook:processing', e, {
			workspaceId: op.workspaceId,
			metadata: { chatId: op.operatorChatId },
		})
	}

	return NextResponse.json({ ok: true })
}
