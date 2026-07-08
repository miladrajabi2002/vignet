import type { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { readPageToken, readIgUserId } from '@/lib/instagram/config'
import {
	subscribeIgUserToWebhook,
	getIgUserWebhookSubscription,
	getInstagramProfile,
} from '@/lib/instagram/oauth'
import { getWebhookPayloads } from '@/lib/channels/webhook-debug'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ agentId: string }> }

/**
 * Diagnostics + manual webhook (re)subscription for an Instagram channel.
 *
 * GET  → returns the current subscription status + profile snapshot
 * POST → re-subscribes the IG user to webhook fields (idempotent)
 *
 * Use this when "messages aren't arriving" — it tells you whether the webhook
 * subscription is active, and lets you retry it without reconnecting.
 */
export async function GET(_req: Request, props: Params) {
	const params = await props.params
	const user = await getCurrentUser()
	if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

	const agent = await prisma.agent.findFirst({
		where: { id: params.agentId, workspaceId: user.workspaceId },
		select: {
			id: true,
			channels: {
				where: { type: 'INSTAGRAM' },
				select: { id: true, config: true, lastInboundAt: true },
			},
		},
	})
	if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
	const channel = agent.channels[0]
	if (!channel) return NextResponse.json({ error: 'IG_NOT_CONNECTED' }, { status: 400 })

	const token = readPageToken(channel.config)
	const igUserId = readIgUserId(channel.config)
	if (!token || !igUserId) {
		return NextResponse.json({ error: 'NO_OAUTH_TOKEN' }, { status: 400 })
	}

	// Check current subscription + fresh profile in parallel.
	const [subscription, profile] = await Promise.all([
		getIgUserWebhookSubscription(igUserId, token),
		getInstagramProfile(token).catch(() => null),
	])

	// Cast config once for safe property access (Prisma JsonValue is a union).
	const cfg = (channel.config ?? {}) as Record<string, unknown>

	// Pull the last few webhook payloads so the operator can compare the ids
	// Meta sent against the ids we stored. A mismatch is the #1 cause of
	// "messages arrive but nothing happens" — the single-channel fallback in
	// handleInstagramGlobalInbound self-heals this, but we surface it here so
	// the operator knows what happened.
	const storedIds = [
		String(cfg.igUserId ?? ''),
		String(cfg.pageId ?? ''),
		String(cfg.igBusinessAccountId ?? ''),
		String(cfg.webhookIgId ?? ''),
	].filter(Boolean)

	const recentPayloads = getWebhookPayloads('INSTAGRAM', 5).map((p) => {
		const body = p.body as {
			entry?: Array<{
				id?: string | number
				messaging?: Array<{
					recipient?: { id?: string | number }
				}>
			}>
		} | null
		const entryIds: string[] = []
		const recipientIds: string[] = []
		for (const e of body?.entry ?? []) {
			if (e?.id !== undefined && e?.id !== null) entryIds.push(String(e.id))
			for (const m of e?.messaging ?? []) {
				if (m?.recipient?.id !== undefined && m?.recipient?.id !== null) {
					recipientIds.push(String(m.recipient.id))
				}
			}
		}
		const allSentIds = Array.from(new Set([...entryIds, ...recipientIds]))
		return {
			ts: p.ts,
			eventType: p.eventType,
			parsedCount: p.parsedCount,
			entryIds,
			recipientIds,
			allSentIds,
			tokenHint: p.tokenHint,
		}
	})

	// Check: do any of the recent payloads have ANY id that matches ANY stored id?
	const matchFound = recentPayloads.some((p) =>
		p.allSentIds.some((id) => storedIds.includes(id)),
	)

	return NextResponse.json({
		connected: true,
		igUserId,
		webhookIgId: cfg.webhookIgId ?? null,
		storedIds,
		username: profile?.username ?? null,
		webhookSubscription: subscription,
		subscribed: subscription !== null && subscription.length > 0,
		lastInboundAt: channel.lastInboundAt?.toISOString() ?? null,
		webhookUrl: 'https://vigent.ir/api/webhook/instagram',
		recentPayloads,
		entryIdMatches: matchFound,
		diagnosis:
			recentPayloads.length === 0
				? 'هیچ وب‌هوکی دریافت نشده. در Meta dashboard → Webhooks مطمئن شوید Callback URL ثبت شده و Subscribe فیلدها فعال است.'
				: matchFound
					? subscription === null || subscription.length === 0
						? 'وب‌هوک میاد و id مطابقت داره، ولی subscription فعال نیست. روی دکمه «فعال‌سازی مجدد» بزنید.'
						: 'همه‌چیز درسته. اگه بازم پیام نمیاد، /admin/errors رو چک کنید.'
					: `وب‌هوک دریافت شده ولی هیچ id در payload با id‌های ذخیره‌شده مطابقت نداره. id‌های دریافتی: ${JSON.stringify(
							recentPayloads.flatMap((p) => p.allSentIds),
						)}. id‌های ذخیره‌شده: ${JSON.stringify(storedIds)}. ` +
						'این یک رفتار شناخته‌شده‌ی متاست (id رابط کاربری با id وب‌هوک متفاوته). ' +
						'سیستم با single-channel fallback خودکار این رو حل می‌کنه — اگه بازم کار نکرد، یک پیام تست بفرستید.',
	})
}

/** Re-subscribe the IG user to webhook fields. */
export async function POST(_req: Request, props: Params) {
	const params = await props.params
	const user = await getCurrentUser()
	if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

	const agent = await prisma.agent.findFirst({
		where: { id: params.agentId, workspaceId: user.workspaceId },
		select: {
			id: true,
			channels: { where: { type: 'INSTAGRAM' }, select: { id: true, config: true } },
		},
	})
	if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
	const channel = agent.channels[0]
	if (!channel) return NextResponse.json({ error: 'IG_NOT_CONNECTED' }, { status: 400 })

	const token = readPageToken(channel.config)
	const igUserId = readIgUserId(channel.config)
	if (!token || !igUserId) {
		return NextResponse.json({ error: 'NO_OAUTH_TOKEN' }, { status: 400 })
	}

	const result = await subscribeIgUserToWebhook(igUserId, token)
	if (!result) {
		return NextResponse.json(
			{
				error: 'SUBSCRIBE_FAILED',
				hint: 'مطمئن شوید در Meta dashboard → Webhooks → Callback URL تنظیم شده و Verify تایید شده.',
			},
			{ status: 500 },
		)
	}

	return NextResponse.json({ ok: true, subscribedFields: result })
}

/**
 * Fix the stored igUserId when it doesn't match what Meta sends in webhooks.
 *
 * With Instagram API with Instagram Login, the id returned by `GET /me`
 * (which we store as igUserId) can DIFFER from the id Meta sends as
 * `recipient.id` in webhook payloads. This is a known Meta behavior. When that
 * happens, the demux can't find the channel and messages are silently dropped.
 *
 * This endpoint takes a `recipientId` (extracted from a webhook payload's
 * `entry[].messaging[].recipient.id`) and updates the channel config to use it
 * as the primary `igUserId`. After this, the demux will match.
 *
 * Body: `{ recipientId: string }` — the id Meta sent as recipient.id.
 */
export async function PUT(req: Request, props: Params) {
	const params = await props.params
	const user = await getCurrentUser()
	if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

	const agent = await prisma.agent.findFirst({
		where: { id: params.agentId, workspaceId: user.workspaceId },
		select: {
			id: true,
			channels: { where: { type: 'INSTAGRAM' }, select: { id: true, config: true } },
		},
	})
	if (!agent) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
	const channel = agent.channels[0]
	if (!channel) return NextResponse.json({ error: 'IG_NOT_CONNECTED' }, { status: 400 })

	const body = (await req.json().catch(() => null)) as {
		recipientId?: string
		igUserId?: string
	}
	const newId = body?.recipientId ?? body?.igUserId
	if (!newId || !/^\d+$/.test(newId)) {
		return NextResponse.json(
			{ error: 'INVALID_ID', hint: 'recipientId must be a numeric string.' },
			{ status: 400 },
		)
	}

	// Merge the new igUserId into the existing config.
	const config = (channel.config as Record<string, unknown> | null) ?? {}
	const updated: Record<string, unknown> = {
		...config,
		igUserId: newId,
	}
	await prisma.agentChannel.update({
		where: { id: channel.id },
		data: { config: updated as unknown as Prisma.InputJsonValue },
	})

	return NextResponse.json({
		ok: true,
		igUserId: newId,
		note: 'igUserId به‌روز شد. حالا demux باید مطابقت داشته باشه. یک پیام تست بفرستید.',
	})
}
