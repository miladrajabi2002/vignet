import { NextResponse } from 'next/server'
import { isAdminAuthedRequest } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { readBotToken } from '@/lib/channels/config'
import { resolveInstagramHost } from '@/lib/channels/instagram'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/instagram-diag
 *
 * Admin-only diagnostic for the Instagram channel. Reports, for every
 * INSTAGRAM channel in the system:
 *   - which Meta Graph host the stored token works against
 *   - the linked account username
 *   - whether DM replies are possible (only Page tokens can send DMs)
 *   - the last send attempt's outcome (captured live by sending a typing_on
 *     indicator, which is the cheapest possible authenticated call against
 *     /me/messages and does NOT post any visible message to the user)
 *
 * Query params:
 *   - channelId=<id>  → limit to one channel
 *   - probeSend=1     → actually attempt a /me/messages call (typing_on) to
 *                       confirm DM capability empirically. Without it we only
 *                       do the static host probe (no /me/messages call).
 */
export async function GET(req: Request) {
	if (!(await isAdminAuthedRequest(req))) {
		return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
	}

	const url = new URL(req.url)
	const channelId = url.searchParams.get('channelId')
	const probeSend = url.searchParams.get('probeSend') === '1'

	const channels = await prisma.agentChannel.findMany({
		where: {
			type: 'INSTAGRAM',
			...(channelId ? { id: channelId } : {}),
		},
		select: { id: true, agentId: true, config: true, lastInboundAt: true },
	})

	const results = []
	for (const ch of channels) {
		const token = readBotToken(ch.config)
		if (!token) {
			results.push({
				channelId: ch.id,
				agentId: ch.agentId,
				error: 'NO_TOKEN_STORED',
				lastInboundAt: ch.lastInboundAt,
			})
			continue
		}

		// Token-type detection by prefix. This is the single most important
		// diagnostic: most "Instagram DMs don't work" reports come from using
		// an Instagram User Access Token (IGAA/IGQ) when a Page Access Token
		// (EAA…) is required. Tell the user upfront which one they have.
		const tokenType = /^(IGAA|IGQ)/i.test(token)
			? 'INSTAGRAM_USER'
			: /^EAA/i.test(token)
				? 'PAGE'
				: 'UNKNOWN'
		const tokenTypeLabel =
			tokenType === 'INSTAGRAM_USER'
				? 'Instagram User Access Token (IGAA) — از "API Setup with Instagram Login"'
				: tokenType === 'PAGE'
					? 'Page Access Token (EAA) — از Messenger product'
					: 'نوع توکن نامشخص'
		const tokenTypeCanDm = tokenType === 'PAGE'

		// Static probe: which host accepts the token, and what's the username?
		const resolved = await resolveInstagramHost(token)
		if (!resolved) {
			results.push({
				channelId: ch.id,
				agentId: ch.agentId,
				tokenType,
				tokenTypeLabel,
				error: 'TOKEN_REJECTED_BY_BOTH_HOSTS',
				hint:
					'توکن نه روی graph.facebook.com کار می‌کند نه روی graph.instagram.com. ' +
					'احتمالاً منقضی شده یا از اکانت اشتباه صادر شده. ' +
					(tokenType === 'INSTAGRAM_USER'
						? 'توکن‌های IGAA معمولاً ۱ ساعته‌اند و منقضی می‌شوند — باید توکن دائمی Page بسازید.'
						: ''),
				lastInboundAt: ch.lastInboundAt,
			})
			continue
		}

		// Empirical DM-send probe: send typing_on (no visible message posted) to
		// a fake recipient id; if the host/token accepts the CALL shape, we learn
		// DM capability without ever messaging a real user. We use a clearly-
		// invalid recipient id (0) so even if the call shape is accepted, Meta
		// refuses the recipient — but the error code tells us capability.
		let dmCapability: 'yes' | 'no_token_type' | 'refused' | 'unknown' = 'unknown'
		let dmProbeDetail = ''
		if (probeSend) {
			if (resolved.host === 'instagram') {
				dmCapability = 'no_token_type'
				dmProbeDetail =
					'توکن از نوع Instagram User (graph.instagram.com) است. ' +
					'این توکن به‌طور ذاتی نمی‌تواند DM بفرستد — endpoint /me/messages روی این هاست وجود ندارد. ' +
					'برای DM: یک Page Access Token از graph.facebook.com بسازید.'
			} else {
				try {
					const res = await fetch(`${resolved.base}/me/messages`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${token}`,
						},
						body: JSON.stringify({
							recipient: { id: '0' },
							sender_action: 'typing_on',
						}),
					})
					const body = await res.text().catch(() => '')
					if (res.ok) {
						// Extremely unlikely with id=0, but if accepted → full capability.
						dmCapability = 'yes'
						dmProbeDetail = `unexpected 200 (recipient 0 accepted). body=${body}`
					} else {
						// We expect an error. The error CODE/MESSAGE tells us whether
						// the problem is "bad recipient" (capability OK) vs "no permission"
						// (capability missing). Common cases:
						//   - code 100 "Parameter error: You cannot send messages to this id"
						//     → recipient invalid (id=0) but token CAN send → CAPABILITY OK
						//   - code 100 "Invalid recipient" → CAPABILITY OK
						//   - code 200 "Cannot send messages to this person" / "isn't receiving messages"
						//     → 24h window / permission → CAPABILITY OK (window, not token issue)
						//   - code 10 "Permission denied" / "Requires permission" → NO
						//   - "instagram_manage_messages" mentioned → NO
						const looksLikeRecipientError =
							/recipient|cannot send messages to this id|invalid.*id|parameter error|subcode 2018/i.test(
								body,
							)
						const looksLikePermissionError =
							/requires.*permission|permission denied|subcode 10\b|instagram_manage_messages/i.test(
								body,
							)
						// Special: code 100 with "Parameter error" is ALWAYS a recipient
						// problem, never a permission problem — it means the API call shape
						// was accepted and only the recipient id was rejected.
						const isCode100ParameterError = /#100\).*Parameter error/i.test(body)
						if (
							isCode100ParameterError ||
							(looksLikeRecipientError && !looksLikePermissionError)
						) {
							dmCapability = 'yes'
							dmProbeDetail =
								`✅ توکن می‌تواند DM بفرستد — خطای دریافتی فقط به‌خاطر recipient id=0 (غیر واقعی) است، نه مشکل توکن. ` +
								`status=${res.status} body=${body.slice(0, 300)}`
						} else {
							dmCapability = 'refused'
							dmProbeDetail = `⚠️ خطای احتمالی permission. status=${res.status} body=${body.slice(0, 400)}`
						}
					}
				} catch (e) {
					dmCapability = 'unknown'
					dmProbeDetail = `network error: ${e instanceof Error ? e.message : String(e)}`
				}
			}
		}

		results.push({
			channelId: ch.id,
			agentId: ch.agentId,
			tokenType,
			tokenTypeLabel,
			tokenTypeCanDm,
			host: resolved.host,
			hostUrl: resolved.base,
			username: resolved.username,
			canSendDms:
				resolved.host === 'facebook' && (probeSend ? dmCapability === 'yes' : true),
			...(probeSend ? { dmProbe: dmCapability, dmProbeDetail } : {}),
			lastInboundAt: ch.lastInboundAt,
			verdict:
				tokenType === 'INSTAGRAM_USER'
					? '❌ این توکن IGAA است و نمی‌تواند دایرکت بفرستد. ' +
						'برای پاسخ به دایرکت باید یک Page Access Token بسازید (راهنما در README). ' +
						'پاسخ به کامنت‌ها با همین توکن کار می‌کند.'
					: tokenType === 'PAGE' && resolved.host === 'facebook'
						? '✅ این توکن Page است و می‌تواند دایرکت بفرستد (اگر دسترسی instagram_manage_messages داشته باشد).'
						: '⚠️ نوع توکن نامشخص — نتایج probe را بررسی کنید.',
			// If the live probe returned "refused" specifically because of error
			// code 230, surface the App Review guidance — this is THE most common
			// reason "DMs don't work" for a correctly-connected Page token.
			...(probeSend &&
			dmCapability === 'refused' &&
			/"code"\s*:\s*230/.test(dmProbeDetail)
				? {
						needsAppReview: true,
						appReviewGuidance: {
							problem:
								'اپ شما در Development Mode است و فقط Standard Access به instagram_manage_messages دارد. ' +
								'در این حالت متا پیام‌ها را دریافت می‌کند ولی اجازه پاسخ‌دهی (send) نمی‌دهد — خطای 230.',
							solution:
								'برای پاسخ به دایرکت، باید App Review بزنید و Advanced Access بگیرید. ' +
								'تا Approval (معمولاً ۲-۵ روز)، فقط اکانت‌های tester/admin می‌توانند پیام بفرستند و پاسخ بگیرند.',
							steps: [
								'developers.facebook.com → اپ شما → App Review → Permissions and Features',
								'این موارد را پیدا کنید و «Request Advanced Access» بزنید:',
								'  • instagram_manage_messages (مهم‌ترین — برای پاسخ به دایرکت)',
								'  • instagram_manage_comments (برای پاسخ به کامنت)',
								'  • instagram_basic',
								'  • pages_messaging',
								'برای هر کدام use case بنویسید: «Vigent is an AI customer service platform. We use instagram_manage_messages to let businesses auto-reply to their Instagram DMs through our dashboard.»',
								'اسکرین‌شات از پنل vigent (صفحه Channels + یک گفتگو) آپلود کنید',
								'Submit — معمولاً ۲-۵ روز کاری طول می‌کشد',
								'بعد از approval: اپ را Live کنید (toggle بالای صفحه)',
							],
							testingWithoutReview:
								'تا Approval: فقط اکانت‌هایی که tester/admin اپ هستند می‌توانند پیام بفرستند و پاسخ بگیرند. ' +
								'برای تست: App Roles → Instagram Testers → اکانت تست را اضافه کنید، ' +
								'آن شخص در اپ اینستاگرامش Settings → Business → Invitations → دعوت را قبول کند.',
						},
					}
				: {}),
			howToFixDms:
				'برای ساخت Page Access Token:\n' +
				'1. در developers.facebook.com → اپ شما\n' +
				'2. در منوی سمت چپ، محصول Messenger را پیدا کنید (نه Instagram Graph API).\n' +
				'   اگر Messenger را ندارید: Add Product → Messenger → Set Up\n' +
				'3. در Messenger → Settings → بخش "Instagram Settings" → اکانت اینستاگرام را وصل کنید\n' +
				'4. در بخش "Access Tokens" → روی Page خود "Generate Access Token" بزنید\n' +
				'5. توکن جدید (با پیشوند EAA) را کپی کنید\n' +
				'6. در پنل vigent، کانال اینستاگرام را disconnect و با توکن جدید وصل کنید\n' +
				'پیش‌نیاز: اکانت اینستاگرام باید Business/Creator باشد و به یک Facebook Page متصل باشد.',
		})
	}

	return NextResponse.json({ count: results.length, channels: results })
}
