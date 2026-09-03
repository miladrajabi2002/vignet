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
import { getScopedWebhookPayloads } from '@/lib/channels/webhook-debug'

export const dynamic = 'force-dynamic'

/** How many recent (owned or unclaimed) webhook payloads the screen shows. */
const MAX_DIAGNOSTIC_PAYLOADS = 5

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

	// The debug buffer is process-global (every workspace's payloads). Scope it:
	// this workspace only ever sees its OWN payloads plus ids claimed by no
	// channel at all — the Meta id-mismatch case this screen exists to debug.
	// Customer message text and webhook-token hints are never returned here.
	const { payloads: recentPayloads, otherTenantPayloadCount } =
		getScopedWebhookPayloads('INSTAGRAM', storedIds, await allClaimedInstagramIds(), 5)

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
				? otherTenantPayloadCount > 0
					? 'وب‌هوک روی سرور دریافت می‌شود، ولی هیچ رویدادی مربوط به اکانت شما نبوده. در Meta dashboard مطمئن شوید همین اکانت Subscribe شده است.'
					: 'هیچ وب‌هوکی دریافت نشده. در Meta dashboard → Webhooks مطمئن شوید Callback URL ثبت شده و Subscribe فیلدها فعال است.'
				: matchFound
					? subscription === null || subscription.length === 0
						? 'وب‌هوک میاد و id مطابقت داره، ولی subscription فعال نیست. روی دکمه «فعال‌سازی مجدد» بزنید.'
						: 'همه‌چیز درسته. اگه بازم پیام نمیاد، /admin/errors رو چک کنید.'
					: `وب‌هوک دریافت شده ولی هیچ id در payload با id‌های ذخیره‌شده مطابقت نداره. id‌های دریافتی: ${JSON.stringify(
							recentPayloads.flatMap((p) => p.allSentIds),
						)}. id‌های ذخیره‌شده: ${JSON.stringify(storedIds)}. ` +
						'این یک رفتار شناخته‌شده‌ی متاست (id رابط کاربری با id وب‌هوک متفاوته). ' +
						'با دکمه «اصلاح id» می‌توانید id دریافتی را ثبت کنید.',
	})
}

/**
 * Every Instagram routing id currently claimed by ANY channel. Used to decide
 * whether a buffered payload is "orphan" (safe to show/claim) or belongs to
 * another workspace (must stay hidden and unclaimable).
 */
async function allClaimedInstagramIds(): Promise<string[]> {
	const channels = await prisma.agentChannel.findMany({
		where: { type: 'INSTAGRAM' },
		select: { config: true },
	})
	const ids: string[] = []
	for (const c of channels) {
		const cfg = (c.config as Record<string, unknown> | null) ?? {}
		for (const field of ['igUserId', 'pageId', 'igBusinessAccountId', 'webhookIgId']) {
			const v = cfg[field]
			if (v !== undefined && v !== null && String(v)) ids.push(String(v))
		}
	}
	return ids
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
 * Fix the stored webhook alias when it doesn't match what Meta sends.
 *
 * Instagram Login's `GET /me` returns both an app-scoped `id` (used for Graph
 * calls) and a native `user_id` (used in webhook owner fields). Older channel
 * records only stored the former. Never overwrite `igUserId` here: doing so
 * would repair routing while breaking subscriptions and other Graph calls.
 *
 * SECURITY: this value IS the global webhook's routing key, so an unvalidated
 * write let one workspace claim another workspace's Instagram id and receive
 * their DMs. A submitted id is therefore accepted only when it is provably
 * ours — it matches the Meta-verified profile for our own token, or it arrived
 * as an owner-side id in a recent webhook payload that no other channel claims
 * — and never when another channel already claims it.
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

	const config = (channel.config as Record<string, unknown> | null) ?? {}
	const ownStoredIds = ['igUserId', 'pageId', 'igBusinessAccountId', 'webhookIgId']
		.map((f) => (config[f] === undefined || config[f] === null ? '' : String(config[f])))
		.filter(Boolean)

	// Already ours — nothing to prove, nothing to change.
	if (!ownStoredIds.includes(newId)) {
		// 1) Refuse ids another workspace's channel already routes on.
		const claimedElsewhere = await prisma.agentChannel.findFirst({
			where: {
				type: 'INSTAGRAM',
				id: { not: channel.id },
				OR: [
					{ config: { path: ['igUserId'], equals: newId } },
					{ config: { path: ['pageId'], equals: newId } },
					{ config: { path: ['igBusinessAccountId'], equals: newId } },
					{ config: { path: ['webhookIgId'], equals: newId } },
				],
			},
			select: { id: true },
		})
		if (claimedElsewhere) {
			return NextResponse.json(
				{
					error: 'ID_ALREADY_CLAIMED',
					hint: 'این شناسه به کانال دیگری تعلق دارد و قابل ثبت نیست.',
				},
				{ status: 409 },
			)
		}

		// 2) Prove ownership: the Meta-verified profile of OUR token, or an
		//    owner-side id from a recent unclaimed webhook payload.
		const token = readPageToken(channel.config)
		const profile = token ? await getInstagramProfile(token).catch(() => null) : null
		let verified = profile?.webhookIgId === newId

		if (!verified) {
			const { payloads } = getScopedWebhookPayloads(
				'INSTAGRAM',
				ownStoredIds,
				await allClaimedInstagramIds(),
				MAX_DIAGNOSTIC_PAYLOADS,
			)
			verified = payloads.some((p) => p.allSentIds.includes(newId))
		}

		if (!verified) {
			return NextResponse.json(
				{
					error: 'ID_NOT_VERIFIED',
					hint:
						'این شناسه نه با پروفایل متصل‌شده مطابقت دارد و نه در وب‌هوک‌های اخیر این اکانت دیده شده است. ' +
						'ابتدا یک پیام تست به اکانت خود بفرستید و سپس دوباره تلاش کنید.',
				},
				{ status: 422 },
			)
		}
	}

	const updated: Record<string, unknown> = {
		...config,
		webhookIgId: newId,
	}
	await prisma.agentChannel.update({
		where: { id: channel.id },
		data: { config: updated as unknown as Prisma.InputJsonValue },
	})

	return NextResponse.json({
		ok: true,
		webhookIgId: newId,
		note: 'شناسه وب‌هوک ثبت شد؛ شناسه اصلی Graph بدون تغییر باقی ماند.',
	})
}
