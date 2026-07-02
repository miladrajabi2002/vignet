import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { captureError } from '@/lib/errors/capture'
import {
        getTelegramBotInfo,
        setTelegramWebhook,
} from '@/lib/channels/telegram'
import { readOperatorBotToken } from '@/lib/channels/operator-handoff'

/**
 * Workspace-scoped management of the operator Telegram bot (F3).
 *
 *   GET     /api/operator-channel               — return the workspace's
 *                                                  OperatorChannel (bot token
 *                                                  masked) or null.
 *   POST    /api/operator-channel               — create or update the channel.
 *                                                  Encrypts the bot token at
 *                                                  rest, registers the Telegram
 *                                                  webhook, fetches the bot
 *                                                  @username via getMe.
 *   DELETE  /api/operator-channel               — remove the channel (also
 *                                                  attempts to clear the
 *                                                  Telegram webhook so the bot
 *                                                  stops delivering updates).
 *
 * Public base URL is read from NEXT_PUBLIC_APP_URL (falls back to vigent.ir)
 * — the same value used everywhere else that builds webhook URLs.
 */

function appBaseUrl(): string {
        return process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir'
}

/** Mask the bot token for display, e.g. "1234567890:AA…xyz". */
function maskBotToken(stored: string | null | undefined): string | null {
        if (!stored) return null
        const plain = readOperatorBotToken(stored)
        if (!plain) return '••••'
        if (plain.length <= 8) return '••••'
        return `${plain.slice(0, 10)}…${plain.slice(-4)}`
}

const createSchema = z.object({
        botToken: z.string().min(10).max(500),
        operatorChatId: z.string().min(1).max(64).optional(),
        active: z.boolean().optional(),
})

const patchSchema = z.object({
        active: z.boolean().optional(),
        operatorChatId: z.string().min(1).max(64).optional(),
})

export async function GET() {
        const user = await getCurrentUser()
        if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

        const op = await prisma.operatorChannel.findUnique({
                where: { workspaceId: user.workspaceId },
                select: {
                        id: true,
                        workspaceId: true,
                        botToken: true,
                        operatorChatId: true,
                        botUsername: true,
                        active: true,
                        lastError: true,
                        createdAt: true,
                        updatedAt: true,
                },
        })

        if (!op) return NextResponse.json({ operatorChannel: null })

        // Strip the raw token; send a masked hint instead.
        const { botToken: _omit, ...rest } = op
        void _omit
        return NextResponse.json({
                operatorChannel: {
                        ...rest,
                        botTokenMasked: maskBotToken(op.botToken),
                },
        })
}

export async function POST(req: Request) {
        const user = await getCurrentUser()
        if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

        const json = await req.json().catch(() => null)
        const parsed = createSchema.safeParse(json)
        if (!parsed.success) {
                return NextResponse.json(
                        { error: 'INVALID', issues: parsed.error.flatten() },
                        { status: 400 },
                )
        }

        const { botToken, operatorChatId, active } = parsed.data
        const token = botToken.trim()

        // Verify the token with Telegram before persisting (getMe).
        const info = await getTelegramBotInfo(token)
        if (!info) {
                return NextResponse.json({ error: 'INVALID_TOKEN' }, { status: 400 })
        }

        const webhookUrl = `${appBaseUrl()}/api/telegram-operator/webhook?token=${encodeURIComponent(token)}`
        let webhookSet = false
        let lastError: string | null = null
        try {
                webhookSet = await setTelegramWebhook(token, webhookUrl)
                if (!webhookSet) lastError = 'Telegram setWebhook returned a non-OK response'
        } catch (e) {
                lastError = e instanceof Error ? e.message : 'Telegram setWebhook failed'
        }

        const encrypted = encrypt(token)

        const row = await prisma.operatorChannel.upsert({
                where: { workspaceId: user.workspaceId },
                update: {
                        botToken: encrypted,
                        botUsername: info.username,
                        operatorChatId: operatorChatId ?? null,
                        active: active ?? true,
                        lastError,
                },
                create: {
                        workspaceId: user.workspaceId,
                        botToken: encrypted,
                        botUsername: info.username,
                        operatorChatId: operatorChatId ?? null,
                        active: active ?? true,
                        lastError,
                },
                select: {
                        id: true,
                        workspaceId: true,
                        operatorChatId: true,
                        botUsername: true,
                        active: true,
                        lastError: true,
                        createdAt: true,
                        updatedAt: true,
                },
        })

        return NextResponse.json(
                {
                        operatorChannel: {
                                ...row,
                                botTokenMasked: maskBotToken(encrypted),
                        },
                        botUsername: info.username,
                        webhookSet,
                        webhookUrl,
                },
                { status: 201 },
        )
}

export async function DELETE() {
        const user = await getCurrentUser()
        if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

        const op = await prisma.operatorChannel.findUnique({
                where: { workspaceId: user.workspaceId },
                select: { id: true, botToken: true },
        })
        if (!op) return NextResponse.json({ ok: true })

        // Best-effort: ask Telegram to drop the webhook so the bot stops delivering.
        const token = readOperatorBotToken(op.botToken)
        if (token) {
                try {
                        await fetch(
                                `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`,
                        )
                } catch (e) {
                        captureError('operator-channel:delete-webhook', e, {
                                workspaceId: user.workspaceId,
                        })
                }
        }

        await prisma.operatorChannel.delete({ where: { id: op.id } })
        return NextResponse.json({ ok: true })
}

/**
 * PATCH — update just the active flag / operator chat id without rotating the
 * bot token. Used by the UI's "active" toggle.
 */
export async function PATCH(req: Request) {
        const user = await getCurrentUser()
        if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

        const existing = await prisma.operatorChannel.findUnique({
                where: { workspaceId: user.workspaceId },
                select: { id: true },
        })
        if (!existing) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

        const json = await req.json().catch(() => null)
        const parsed = patchSchema.safeParse(json ?? {})
        if (!parsed.success) {
                return NextResponse.json(
                        { error: 'INVALID', issues: parsed.error.flatten() },
                        { status: 400 },
                )
        }

        const data: { active?: boolean; operatorChatId?: string | null } = {}
        if (parsed.data.active !== undefined) data.active = parsed.data.active
        if (parsed.data.operatorChatId !== undefined) {
                data.operatorChatId = parsed.data.operatorChatId || null
        }

        const row = await prisma.operatorChannel.update({
                where: { id: existing.id },
                data,
                select: {
                        id: true,
                        botUsername: true,
                        operatorChatId: true,
                        active: true,
                        lastError: true,
                },
        })

        return NextResponse.json({ operatorChannel: row })
}
