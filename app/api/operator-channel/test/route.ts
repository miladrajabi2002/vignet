import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { captureError } from '@/lib/errors/capture'
import { readOperatorBotToken } from '@/lib/channels/operator-handoff'

/**
 * POST /api/operator-channel/test — sends a test message "✅ اتصال بات اپراتور
 * ویجنت تأیید شد" to the configured operatorChatId and reports whether it
 * succeeded. Used by the UI's "test connection" button to verify the bot token
 * + chat id are correct after saving.
 */
export async function POST() {
	const user = await getCurrentUser()
	if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

	const op = await prisma.operatorChannel.findUnique({
		where: { workspaceId: user.workspaceId },
		select: { id: true, botToken: true, operatorChatId: true },
	})
	if (!op) return NextResponse.json({ error: 'NOT_CONFIGURED' }, { status: 404 })
	if (!op.operatorChatId) {
		return NextResponse.json({ error: 'NO_CHAT_ID' }, { status: 400 })
	}

	const token = readOperatorBotToken(op.botToken)
	if (!token) {
		return NextResponse.json({ error: 'INVALID_TOKEN' }, { status: 400 })
	}

	const text = '✅ اتصال بات اپراتور ویجنت تأیید شد'
	try {
		const res = await fetch(
			`https://api.telegram.org/bot${token}/sendMessage`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ chat_id: op.operatorChatId, text }),
			},
		)
		if (!res.ok) {
			const errText = await res.text().catch(() => '')
			const message = `Telegram sendMessage failed: ${res.status} ${errText}`
			await prisma.operatorChannel.update({
				where: { id: op.id },
				data: { lastError: message },
			})
			return NextResponse.json(
				{ ok: false, error: 'TELEGRAM_FAILED', message },
				{ status: 502 },
			)
		}

		await prisma.operatorChannel.update({
			where: { id: op.id },
			data: { lastError: null },
		})
		return NextResponse.json({ ok: true })
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Network error'
		captureError('operator-channel:test', e, { workspaceId: user.workspaceId })
		await prisma.operatorChannel.update({
			where: { id: op.id },
			data: { lastError: message },
		})
		return NextResponse.json(
			{ ok: false, error: 'NETWORK', message },
			{ status: 502 },
		)
	}
}
