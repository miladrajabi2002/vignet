import type { Prisma } from '@prisma/client'
import { readPageToken, readUserToken, readIgUserId } from '@/lib/instagram/config'
import { readBotToken } from '@/lib/channels/config'

/**
 * Fetch the DM sender's profile (name, username, avatar) by trying every
 * available token × host × fields combination. The Instagram webhook only
 * carries the sender's PSID — no name/handle/avatar — so we MUST call the
 * Graph API to enrich the contact.
 *
 * Why so many attempts? Instagram tokens come in different flavors and Meta's
 * permissions are inconsistent:
 *   - Instagram User Token (IGAA…) → graph.instagram.com, but usually only
 *     works for the connected account, NOT for other users.
 *   - Page Access Token (EAA…) → graph.facebook.com, CAN fetch other users'
 *     profiles when the app has `instagram_manage_messages` + App Review.
 *   - Legacy bot token → either host.
 *
 * We try all combinations and return the first that yields ANY profile field.
 * Detailed logging at each step so the operator can see exactly what worked
 * and what Meta refused — this is the only way to debug "ناشناس" contacts.
 */
export async function fetchInstagramSenderProfile(
	channelConfig: Prisma.JsonValue,
	senderId: string,
): Promise<{ name?: string; username?: string; avatarUrl?: string } | null> {
	if (!senderId || senderId.startsWith('comment:')) return null

	// Collect every token we have. (Some channels only have userToken; legacy
	// channels only have botToken; FB-Login channels have pageToken.)
	const tokens: { label: string; value: string }[] = []
	const userToken = readUserToken(channelConfig)
	if (userToken) tokens.push({ label: 'IG-User-Token', value: userToken })
	const pageToken = readPageToken(channelConfig)
	if (pageToken && pageToken !== userToken) {
		tokens.push({ label: 'Page-Token', value: pageToken })
	}
	const botToken = readBotToken(channelConfig)
	if (botToken && botToken !== userToken && botToken !== pageToken) {
		tokens.push({ label: 'Bot-Token', value: botToken })
	}

	if (tokens.length === 0) {
		console.warn(
			`[ig-profile] sender=${senderId} → no access token found in channel config`,
		)
		return null
	}

	const igUserId = readIgUserId(channelConfig)
	console.log(
		`[ig-profile] sender=${senderId} trying ${tokens.length} token(s): ` +
			tokens.map((t) => t.label).join(', ') +
			` (igUserId=${igUserId ?? 'n/a'})`,
	)

	// Hosts + field-sets to try. We try the most-likely-to-work first.
	// Note: graph.facebook.com is the ONLY host that can fetch OTHER users'
	// profiles (with a Page token). graph.instagram.com only works for the
	// connected account itself.
	const hosts = [
		{ label: 'graph.facebook.com/v23.0', base: 'https://graph.facebook.com/v23.0' },
		{ label: 'graph.facebook.com/v21.0', base: 'https://graph.facebook.com/v21.0' },
		{ label: 'graph.instagram.com/v21.0', base: 'https://graph.instagram.com/v21.0' },
	]
	// Different field names across API versions.
	const fieldSets = [
		'name,username,profile_pic',
		'name,username,profile_picture_url',
		'username,profile_picture_url',
		'username,name',
	]

	for (const tok of tokens) {
		for (const h of hosts) {
			for (const fields of fieldSets) {
				try {
					const url = `${h.base}/${senderId}?fields=${fields}`
					console.log(
						`[ig-profile] → ${tok.label} @ ${h.label} fields=${fields} → ${url}`,
					)
					const res = await fetch(url, {
						headers: { Authorization: `Bearer ${tok.value}` },
					})
					const bodyText = await res.text().catch(() => '')
					if (!res.ok) {
						console.warn(
							`[ig-profile] ✗ ${tok.label} @ ${h.label} fields=${fields} → ${res.status}: ${bodyText.slice(0, 300)}`,
						)
						continue
					}
					let json: Record<string, unknown>
					try {
						json = JSON.parse(bodyText) as Record<string, unknown>
					} catch {
						console.warn(
							`[ig-profile] ✗ ${tok.label} @ ${h.label} fields=${fields} → non-JSON response`,
						)
						continue
					}
					// Meta sometimes returns an error object even with 200.
					if (json.error) {
						console.warn(
							`[ig-profile] ✗ ${tok.label} @ ${h.label} fields=${fields} → error in body: ${JSON.stringify(json.error).slice(0, 300)}`,
						)
						continue
					}
					const name = typeof json.name === 'string' ? json.name : undefined
					const username = typeof json.username === 'string' ? json.username : undefined
					const avatarUrl =
						(typeof json.profile_pic === 'string' ? json.profile_pic : undefined) ??
						(typeof json.profile_picture_url === 'string'
							? json.profile_picture_url
							: undefined)
					console.log(
						`[ig-profile] ✓ SUCCESS ${tok.label} @ ${h.label} fields=${fields} → name=${name ?? '∅'} username=${username ?? '∅'} avatar=${avatarUrl ? 'yes' : 'no'}`,
					)
					if (name || username || avatarUrl) {
						return { name, username, avatarUrl }
					}
				} catch (e) {
					console.warn(
						`[ig-profile] ✗ ${tok.label} @ ${h.label} fields=${fields} → exception: ${(e as Error).message}`,
					)
				}
			}
		}
	}

	console.warn(
		`[ig-profile] sender=${senderId} → ALL attempts failed. Meta did not return any profile fields for this user with any available token. ` +
			`This is a known Meta limitation: Instagram User Tokens (IGAA…) can only read the connected account's profile, not other users'. ` +
			`To fetch other users' profiles you need a Page Access Token (from FB Login) with instagram_manage_messages + App Review.`,
	)
	return null
}
