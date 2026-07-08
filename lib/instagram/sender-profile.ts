import type { Prisma } from '@prisma/client'
import { readUserToken, readIgUserId } from '@/lib/instagram/config'

/**
 * Fetch the DM sender's profile (name, username, avatar).
 *
 * KEY INSIGHT (confirmed by Meta's docs + community reports):
 * Instagram User Access Tokens (from "Instagram API with Instagram Login")
 * ONLY work on `graph.instagram.com`. Sending them to `graph.facebook.com`
 * returns 401 "Cannot parse access token" — the token is valid, just on the
 * wrong host. So we go DIRECTLY to graph.instagram.com and skip the 8 wasted
 * facebook.com attempts that the old code did.
 *
 * Note: graph.instagram.com can only fetch the CONNECTED account's profile,
 * not arbitrary users. For DM senders (other users), this may return limited
 * data. But it's the only host that accepts an IG User Token, so it's our
 * best (and only) option without a Page Access Token.
 */
export async function fetchInstagramSenderProfile(
	channelConfig: Prisma.JsonValue,
	senderId: string,
): Promise<{ name?: string; username?: string; avatarUrl?: string } | null> {
	if (!senderId || senderId.startsWith('comment:')) return null

	const userToken = readUserToken(channelConfig)
	if (!userToken) {
		console.warn(
			`[ig-profile] sender=${senderId} → no IG user token in channel config`,
		)
		return null
	}

	const igUserId = readIgUserId(channelConfig)
	console.log(
		`[ig-profile] sender=${senderId} → graph.instagram.com/v21.0 (igUserId=${igUserId ?? 'n/a'})`,
	)

	// Try a few field combinations on graph.instagram.com (the ONLY host that
	// accepts IG User Tokens). Different API versions expose different field
	// names, so we try the most common ones.
	const fieldSets = [
		'name,username,profile_pic',
		'name,username,profile_picture_url',
		'username,profile_picture_url',
		'username,name',
	]

	for (const fields of fieldSets) {
		try {
			const url = `https://graph.instagram.com/v21.0/${senderId}?fields=${fields}`
			console.log(`[ig-profile] → fields=${fields}`)
			const res = await fetch(url, {
				headers: { Authorization: `Bearer ${userToken}` },
			})
			const bodyText = await res.text().catch(() => '')
			if (!res.ok) {
				console.warn(
					`[ig-profile] ✗ fields=${fields} → ${res.status}: ${bodyText.slice(0, 300)}`,
				)
				continue
			}
			let json: Record<string, unknown>
			try {
				json = JSON.parse(bodyText) as Record<string, unknown>
			} catch {
				continue
			}
			if (json.error) {
				console.warn(
					`[ig-profile] ✗ fields=${fields} → error: ${JSON.stringify(json.error).slice(0, 300)}`,
				)
				continue
			}
			const name = typeof json.name === 'string' ? json.name : undefined
			const username = typeof json.username === 'string' ? json.username : undefined
			const avatarUrl =
				(typeof json.profile_pic === 'string' ? json.profile_pic : undefined) ??
				(typeof json.profile_picture_url === 'string' ? json.profile_picture_url : undefined)
			console.log(
				`[ig-profile] ✓ SUCCESS fields=${fields} → name=${name ?? '∅'} username=${username ?? '∅'} avatar=${avatarUrl ? 'yes' : 'no'}`,
			)
			if (name || username || avatarUrl) {
				return { name, username, avatarUrl }
			}
		} catch (e) {
			console.warn(`[ig-profile] ✗ fields=${fields} → exception: ${(e as Error).message}`)
		}
	}

	console.warn(
		`[ig-profile] sender=${senderId} → all graph.instagram.com attempts failed. ` +
			`This is a known Meta limitation: IG User Tokens can only read the connected ` +
			`account's profile. To fetch other users' profiles you need a Page Access Token.`,
	)
	return null
}
