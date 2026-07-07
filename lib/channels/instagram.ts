import type { InboundMessage, MessengerAdapter, SendOptions } from '@/lib/channels/types'
import { GRAPH_BASE } from '@/lib/channels/whatsapp'

/**
 * Instagram Messaging adapter (Meta Graph APIs).
 *
 * Instagram access tokens come in two, host-incompatible flavors — both are
 * accepted here:
 *
 *  1. Page Access Token (graph.facebook.com) — issued from a Facebook Page that
 *     is linked to the Instagram professional account. This is the "full"
 *     token: it can both send/receive DMs (Messenger Platform /me/messages) AND
 *     reply publicly to post/reel comments.
 *
 *  2. Instagram User Access Token (graph.instagram.com, commonly prefixed
 *     "IGAA" or "IGQ") — issued by the Instagram Graph API Explorer / login
 *     flow. It can read the account profile and reply to comments, but it
 *     CANNOT send arbitrary DMs: the Messenger Platform /me/messages endpoint
 *     only exists on graph.facebook.com and requires a Page token.
 *
 * {@link resolveInstagramHost} probes both hosts so either token type connects
 * successfully. The inbound webhook is configured in the Meta App dashboard,
 * using the channel's webhookToken as the verify token.
 *
 * Two inbound kinds are handled:
 *   - Direct messages   (entry[].messaging[])      → reply as a DM
 *   - Post/Reel comments (entry[].changes[] field 'comments') → reply publicly
 *
 * Comment replies are routed by encoding the target in the chatId as
 * `comment:<commentId>`; {@link sendText} detects that prefix and posts a public
 * reply instead of a DM. This keeps the shared inbound pipeline untouched.
 *
 * Message-request folder: Instagram routes DMs from non-followers into a
 * "Message Requests" folder; the recipient must accept (move to primary) before
 * the conversation is considered active. Meta still delivers these via webhook
 * (field `message` with `is_unsupported_message: true` on some payloads, or
 * with `tag: "folder"` / a `delivery` field carrying the `folder` value). They
 * are parsed here so the dashboard can surface them; {@link sendText} will
 * surface a clear error if a reply is attempted with an IG-user token.
 */
const COMMENT_PREFIX = 'comment:'

/** Facebook Graph API base — used by Page Access Tokens (DMs + comments). */
const FB_BASE = GRAPH_BASE // https://graph.facebook.com/v21.0
/** Instagram Graph API base — used by Instagram User Access Tokens ("IGAA…"). */
const IG_BASE = 'https://graph.instagram.com/v21.0'

type IgHost = 'facebook' | 'instagram'

interface ResolvedHost {
	host: IgHost
	base: string
	username: string
}

/**
 * Detect which Meta Graph host a given Instagram token works against, and read
 * the linked account's display name. Returns null when the token is rejected by
 * both hosts (i.e. truly invalid).
 *
 * The probe order is biased by the token prefix so the likely-correct host is
 * tried first, keeping the happy path to a single network request:
 *   - tokens starting with "IGAA"/"IGQ" → try graph.instagram.com first
 *   - anything else                     → try graph.facebook.com first
 */
export async function resolveInstagramHost(token: string): Promise<ResolvedHost | null> {
	if (!token) return null

	const looksLikeIgToken = /^(IGAA|IGQ)/i.test(token)
	const order: IgHost[] = looksLikeIgToken
		? ['instagram', 'facebook']
		: ['facebook', 'instagram']

	for (const host of order) {
		const base = host === 'facebook' ? FB_BASE : IG_BASE
		try {
			const res = await fetch(`${base}/me?fields=username,name`, {
				headers: { Authorization: `Bearer ${token}` },
			})
			if (!res.ok) continue
			const json = (await res.json()) as { username?: string; name?: string }
			const username = json.username || json.name
			if (username) return { host, base, username }
		} catch {
			/* network / transient error — fall through to the other host */
		}
	}
	return null
}

export function instagramAdapter(token: string): MessengerAdapter {
	// Lazily resolve the working host on the first outbound call, then cache it
	// for the adapter's lifetime so we don't re-probe /me on every message.
	let resolved: ResolvedHost | null | undefined

	async function host(): Promise<ResolvedHost | null> {
		if (resolved !== undefined) return resolved
		resolved = await resolveInstagramHost(token)
		return resolved
	}

	return {
		channel: 'INSTAGRAM',

		parseUpdate(body: unknown): InboundMessage[] {
			const entries = (body as IgWebhook)?.entry
			if (!entries?.length) return []
			const out: InboundMessage[] = []
			for (const entry of entries) {
				// For Instagram, entry.id is the connected account's own id — used to
				// skip echoes of our own DMs and our own comment replies (loop guard).
				const selfId = entry.id

				for (const m of entry.messaging ?? []) {
					if (m.message?.is_echo) continue

					// Meta can deliver a `delivery` or `read` or `postback`/`referral`
					// event instead of a real message; only `message` with text is a
					// reply-able inbound. Empty text → skip, but it is NOT an error.
					const text = m.message?.text
					const senderId = m.sender?.id
					if (!senderId || !text) continue

					// IMPORTANT: do NOT skip messages based on folder flags.
					// Instagram delivers messages from ALL folders (Primary, General,
					// Message Requests) via the same webhook payload shape — the
					// folder is a UI concept, not a payload flag. The webhook may
					// include `is_unsupported_message` for content the API can't fully
					// represent (a like, sticker, share) — but if `text` is present we
					// still process it; if text is absent we already skipped above.
					// Replying to a message-request via the API auto-accepts it and
					// moves it to Primary, so we WANT to attempt the reply (the handler
					// captures any send failure gracefully).
					out.push({
						chatId: senderId,
						senderId,
						text,
					})
				}

				for (const change of entry.changes ?? []) {
					// ─── Comments: public reply to a post/reel comment ───
					if (change.field === 'comments') {
						const v = change.value
						const commentId = v?.id
						const text = v?.text
						if (!commentId || !text) continue
						// Skip the account's own comments/replies to avoid an answer loop.
						if (v?.from?.id && selfId && v.from.id === selfId) continue
						out.push({
							chatId: `${COMMENT_PREFIX}${commentId}`,
							senderId: v?.from?.id ?? commentId,
							senderName: v?.from?.username,
							text,
						})
						continue
					}
					// ─── Messages via changes[] format ───
					// Normally DMs arrive in entry[].messaging[]. But Meta's "Test"
					// button for the `messages` field sends a synthetic payload in
					// entry[].changes[] with field="messages" and value.message.text.
					// Some API versions / configurations may also deliver real DMs in
					// this shape. Extract the text so the message isn't silently
					// dropped — BUT skip the obvious test placeholders (id "0",
					// "random_mid", "random_text") so a Test click doesn't create a
					// fake conversation row in the CRM.
					if (change.field === 'messages') {
						const v = change.value
						const msg = v?.message
						const text = msg?.text
						const senderId = v?.sender?.id
						if (!senderId || !text) continue
						// Skip synthetic Test-button payloads.
						const isTest =
							entry.id === '0' || msg?.mid === 'random_mid' || text === 'random_text'
						if (isTest) continue
						out.push({
							chatId: senderId,
							senderId,
							text,
						})
					}
				}
			}
			return out
		},

		async sendText(chatId: string, text: string, opts?: SendOptions): Promise<void> {
			if (!token) throw new Error('INSTAGRAM invalid credentials')
			const h = await host()
			if (!h) {
				throw new Error(
					'INSTAGRAM invalid credentials (token rejected by both Meta Graph hosts)',
				)
			}

			// Public reply to a post/reel comment. Both hosts expose
			// `/{comment-id}/replies`, so comment replies work with either token type.
			if (chatId.startsWith(COMMENT_PREFIX)) {
				const commentId = chatId.slice(COMMENT_PREFIX.length)
				const res = await fetch(`${h.base}/${commentId}/replies`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ message: text }),
				})
				if (!res.ok) {
					const detail = await res.text().catch(() => '')
					throw new Error(`INSTAGRAM comment reply failed (${res.status}): ${detail}`)
				}
				return
			}

			// Direct message reply. `/me/messages` exists only on graph.facebook.com
			// and requires a Page Access Token. An Instagram User token
			// (graph.instagram.com) cannot send arbitrary DMs — surface a clear,
			// actionable error instead of an opaque failure from the IG host.
			if (h.host === 'instagram') {
				throw new Error(
					'INSTAGRAM_DM_UNAVAILABLE: این توکن از نوع Instagram User Access Token (graph.instagram.com) است ' +
						'که نمی‌تواند دایرکت ارسال کند. برای پاسخ به دایرکت، کانال را با یک Page Access Token ' +
						'(صادرشده از صفحه فیسبوک متصل به اکانت اینستاگرام) دوباره وصل کنید. ' +
						'پاسخ به کامنت‌ها با همین توکن کار می‌کند.',
				)
			}

			// Facebook host (Page token) — full DM support. Quick replies (tappable
			// suggestion chips) are supported on IG DMs; tapping one sends its title
			// as a normal message. Platform limits: max 13 replies, titles ≤20 chars.
			const message: Record<string, unknown> = { text }
			if (opts?.quickReplies?.length) {
				message.quick_replies = opts.quickReplies.slice(0, 13).map((q, i) => ({
					content_type: 'text',
					title: q.slice(0, 20),
					payload: `qr_${i}`,
				}))
			}
			const res = await fetch(`${h.base}/me/messages`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					recipient: { id: chatId },
					message,
					messaging_type: 'RESPONSE',
				}),
			})
			if (!res.ok) {
				const detail = await res.text().catch(() => '')
				// 10 (permission), 200-299 (permission/rate), 613 (capability) — the
				// most common causes of a "valid token but reply refused" failure.
				throw new Error(
					`INSTAGRAM sendText failed (${res.status}): ${detail}. ` +
						'علل رایج: گیرنده هنوز مکالمه را accept نکرده، توکن دسترسی instagram_manage_messages ندارد، ' +
						'یا پنجرهٔ ۲۴ساعتهٔ پاسخ‌دهی بسته شده است.',
				)
			}
		},

		async sendTyping(chatId: string): Promise<void> {
			// Comments have no typing state, and typing_on is a Messenger Platform
			// sender action that only exists on graph.facebook.com.
			if (!token || chatId.startsWith(COMMENT_PREFIX)) return
			const h = await host()
			if (!h || h.host === 'instagram') return
			await fetch(`${h.base}/me/messages`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					recipient: { id: chatId },
					sender_action: 'typing_on',
				}),
			})
		},
	}
}

/**
 * Validate an Instagram token by reading the linked account username from
 * whichever Meta Graph host accepts it — graph.facebook.com for Page Access
 * Tokens, graph.instagram.com for Instagram User Access Tokens (e.g. "IGAA…").
 * Returns null when neither host recognizes the token.
 */
export async function getInstagramInfo(
	token: string,
): Promise<{ username: string } | null> {
	const resolved = await resolveInstagramHost(token)
	return resolved ? { username: resolved.username } : null
}

/**
 * Return which Meta host a token resolved to (for diagnostics: the dashboard
 * uses this to show the operator whether DMs will work or only comments will).
 */
export async function getInstagramTokenDiagnostics(
	token: string,
): Promise<{ host: IgHost | null; username: string | null; canSendDms: boolean }> {
	const r = await resolveInstagramHost(token)
	return {
		host: r?.host ?? null,
		username: r?.username ?? null,
		canSendDms: r?.host === 'facebook',
	}
}

// ─── INSTAGRAM CONNECTION WIZARD ────────────────────────────────────
//
// The Instagram channel needs a Page Access Token (EAA…) to send DMs. Most
// operators only have a User Access Token (also EAA…, but issued to their
// Facebook user, not to a Page) from the Graph API Explorer. The wizard below
// bridges that gap:
//
//   1. operator pastes a User Access Token (EAA…)
//   2. listFacebookPagesWithInstagram() → GET /me/accounts returns the Pages
//      they administer, plus each Page's Page Access Token
//   3. for each Page, GET /{page-id}?fields=instagram_business_account tells
//      us whether an Instagram account is linked
//   4. for each linked IG account, GET /{ig-id}?fields=username,name,... gives
//      a human-readable label so the operator can confirm "yes, that's my page"
//   5. the operator picks a Page → we store that Page's Page Access Token
//
// This removes the #1 source of "my Instagram DMs don't work" reports: using
// the wrong token type.

export interface InstagramPageOption {
	pageId: string
	pageName: string
	pageAccessToken: string // EAA… — the token to store for DM replies
	pageCategory?: string
	instagram: {
		igBusinessAccountId: string
		username: string
		name?: string
		profilePictureUrl?: string
		followersCount?: number
		biography?: string
	} | null
	/** Why we couldn't read the IG account for this page, when applicable. */
	instagramError?: string
}

export interface FacebookPagesResult {
	tokenType:
		| 'PAGE' // already a Page token — /me/accounts will still work
		| 'USER' // a User token — exactly what the wizard is for
		| 'INSTAGRAM_USER' // IGAA… — wrong host entirely, can't list FB pages
		| 'UNKNOWN'
	pages: InstagramPageOption[]
	/** Present when the token is fundamentally wrong for this flow. */
	error?: string
	/** What the token resolved to (for display). */
	resolvedUsername?: string
	resolvedHost?: IgHost
}

/**
 * List the Facebook Pages the token-holder can administer, enriched with the
 * Instagram account linked to each page (if any). This is the data behind the
 * page-picker step of the connection wizard.
 *
 * Accepts either a User Access Token (EAA… from Graph API Explorer, the
 * intended use) or an already-issued Page Access Token (also EAA… — /me/accounts
 * still works, returning the same page). Rejects IGAA… tokens with a clear
 * error since those live on graph.instagram.com and can't see FB pages at all.
 *
 * Required permissions on the token (the wizard shows these in the UI):
 *   pages_show_list, pages_read_engagement, instagram_basic,
 *   instagram_manage_messages (for DM), instagram_manage_comments (for comments)
 */
export async function listFacebookPagesWithInstagram(
	token: string,
): Promise<FacebookPagesResult> {
	if (!token) {
		return { tokenType: 'UNKNOWN', pages: [], error: 'توکن خالی است.' }
	}

	// Reject IGAA/IGQ tokens upfront — they can't reach /me/accounts at all.
	if (/^(IGAA|IGQ)/i.test(token)) {
		return {
			tokenType: 'INSTAGRAM_USER',
			pages: [],
			error:
				'این توکن از نوع Instagram User (graph.instagram.com) است و نمی‌تواند صفحه‌های فیسبوک را ببیند. ' +
				'برای اتصال اینستاگرام، یک User Access Token از Graph API Explorer (با پیشوند EAA) وارد کنید — ' +
				'راهنما در کادر راه‌اندازی.',
		}
	}

	// Resolve the host (should be facebook for any EAA token) and read /me so we
	// can show who the token belongs to. We don't fail the whole call if /me
	// 401s — /me/accounts might still work for a Page token whose /me is
	// restricted; surface whatever we can.
	const resolved = await resolveInstagramHost(token)
	const tokenType: FacebookPagesResult['tokenType'] = resolved
		? resolved.host === 'facebook'
			? /^(EAA)/i.test(token)
				? 'USER' // could be PAGE — /me/accounts below disambiguates; treat as USER for UI
				: 'UNKNOWN'
			: 'INSTAGRAM_USER'
		: 'UNKNOWN'

	// Step 1: list Pages the token-holder administers.
	let pagesRaw: Array<{
		id: string
		name: string
		access_token: string
		category?: string
		tasks?: string[]
	}> = []
	try {
		const res = await fetch(
			`${FB_BASE}/me/accounts?fields=id,name,access_token,category,tasks&limit=100`,
			{ headers: { Authorization: `Bearer ${token}` } },
		)
		if (!res.ok) {
			const detail = await res.text().catch(() => '')
			return {
				tokenType,
				pages: [],
				resolvedHost: resolved?.host,
				resolvedUsername: resolved?.username,
				error:
					`GET /me/accounts ناموفق (${res.status}): ${detail.slice(0, 400)}. ` +
					'علل رایج: توکن دسترسی pages_show_list ندارد، یا منقضی شده. ' +
					'در Graph API Explorer، قبل از Generate Token، تیک pages_show_list و pages_read_engagement را بزنید.',
			}
		}
		const json = (await res.json()) as { data?: typeof pagesRaw }
		pagesRaw = json.data ?? []
	} catch (e) {
		return {
			tokenType,
			pages: [],
			error: `خطای شبکه در GET /me/accounts: ${e instanceof Error ? e.message : String(e)}`,
		}
	}

	if (!pagesRaw.length) {
		return {
			tokenType,
			pages: [],
			resolvedHost: resolved?.host,
			resolvedUsername: resolved?.username,
			error:
				'هیچ صفحه‌ی فیسبوکی برای این توکن پیدا نشد. مطمئن شوید: ۱) اکانت فیسبوک شما admin یک Page است، ' +
				'۲) توکن دسترسی pages_show_list دارد. برای ساخت Page: facebook.com/pages/create.',
		}
	}

	// Step 2: for each Page, find the linked Instagram Business/Creator account
	// and read its public profile. Parallelized for speed.
	const pages: InstagramPageOption[] = await Promise.all(
		pagesRaw.map(async (p): Promise<InstagramPageOption> => {
			// We use the PAGE's access token for the IG lookup so we get the IG id
			// even when the User token's permissions are narrower.
			const pageToken = p.access_token
			// 2a) instagram_business_account on the Page node.
			let igAccountId: string | null = null
			try {
				const r = await fetch(`${FB_BASE}/${p.id}?fields=instagram_business_account`, {
					headers: { Authorization: `Bearer ${pageToken}` },
				})
				if (r.ok) {
					const j = (await r.json()) as {
						instagram_business_account?: { id?: string }
					}
					igAccountId = j.instagram_business_account?.id ?? null
				}
			} catch {
				/* fall through to "no IG linked" */
			}

			if (!igAccountId) {
				return {
					pageId: p.id,
					pageName: p.name,
					pageAccessToken: pageToken,
					pageCategory: p.category,
					instagram: null,
					instagramError:
						'این Page هیچ اکانت اینستاگرام Business/Creator متصل ندارد. ' +
						'برای وصل کردن: اپ اینستاگرام → Settings → Business → Connect a Facebook Page.',
				}
			}

			// 2b) read the IG account profile (username, name, followers, avatar).
			try {
				const r = await fetch(
					`${FB_BASE}/${igAccountId}?fields=username,name,profile_picture_url,followers_count,biography`,
					{ headers: { Authorization: `Bearer ${pageToken}` } },
				)
				if (!r.ok) {
					const detail = await r.text().catch(() => '')
					return {
						pageId: p.id,
						pageName: p.name,
						pageAccessToken: pageToken,
						pageCategory: p.category,
						instagram: {
							igBusinessAccountId: igAccountId,
							username: '(unknown)',
						},
						instagramError: `خواندن پروفایل IG ناموفق (${r.status}): ${detail.slice(0, 300)}`,
					}
				}
				const j = (await r.json()) as {
					username?: string
					name?: string
					profile_picture_url?: string
					followers_count?: number
					biography?: string
					id?: string
				}
				return {
					pageId: p.id,
					pageName: p.name,
					pageAccessToken: pageToken,
					pageCategory: p.category,
					instagram: {
						igBusinessAccountId: igAccountId,
						username: j.username ?? '(unknown)',
						name: j.name,
						profilePictureUrl: j.profile_picture_url,
						followersCount: j.followers_count,
						biography: j.biography,
					},
				}
			} catch (e) {
				return {
					pageId: p.id,
					pageName: p.name,
					pageAccessToken: pageToken,
					pageCategory: p.category,
					instagram: {
						igBusinessAccountId: igAccountId,
						username: '(unknown)',
					},
					instagramError: `خطای شبکه در خواندن پروفایل IG: ${e instanceof Error ? e.message : String(e)}`,
				}
			}
		}),
	)

	return {
		tokenType,
		pages,
		resolvedHost: resolved?.host,
		resolvedUsername: resolved?.username,
	}
}

/**
 * Sanity-check a chosen Page Access Token + IG account by reading the IG
 * profile with it. Used as the final verification step before we persist the
 * token to the DB — returns the IG username so the dashboard can show
 * "Connected to @vigent.ir" instead of an opaque id.
 */
export async function verifyInstagramPageToken(
	pageAccessToken: string,
): Promise<{ username: string; igBusinessAccountId?: string } | null> {
	const resolved = await resolveInstagramHost(pageAccessToken)
	if (!resolved || resolved.host !== 'facebook') return null
	return { username: resolved.username }
}

/**
 * Instagram webhooks are registered in the Meta App dashboard, not via API.
 * No-op so the shared create flow can still call it uniformly.
 */
export async function setInstagramWebhook(): Promise<boolean> {
	return true
}

interface IgWebhook {
	entry?: {
		id?: string
		messaging?: {
			sender?: { id?: string }
			recipient?: { id?: string }
			message?: {
				text?: string
				mid?: string
				is_echo?: boolean
				is_unsupported_message?: boolean
				tag?: string
				folder?: string
			}
			delivery?: { folder?: string }
		}[]
		changes?: {
			field?: string
			value?: {
				// Comment fields
				id?: string
				text?: string
				from?: { id?: string; username?: string }
				media?: { id?: string; media_product_type?: string }
				// Messages-via-changes fields (Test button + some API shapes)
				sender?: { id?: string }
				recipient?: { id?: string }
				timestamp?: string
				message?: { mid?: string; text?: string }
			}
		}[]
	}[]
}
