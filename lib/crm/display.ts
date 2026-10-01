import type { ChannelType } from '@prisma/client'
import { displayPhone } from '@/lib/phone'

/**
 * Resolve the best display name for a contact across channels.
 *
 * Why this exists: Instagram DM webhooks only carry the sender's PSID (no
 * username, name, or avatar). Meta's API doesn't let us fetch another user's
 * profile with an Instagram User Token. So for Instagram DMs, the contact's
 * `name`, `instagramUsername`, etc. are all null until the visitor types their
 * name in the chat (which `extractIdentity` picks up). Without a fallback,
 * these contacts show as "ناشناس" everywhere — confusing and unprofessional.
 *
 * This helper provides a per-channel fallback ("کاربر اینستاگرام", etc.) so the
 * operator always sees something meaningful instead of "ناشناس".
 *
 * For Telegram/Bale/Rubika the webhook already carries the full name + @handle,
 * so this fallback is rarely needed there — but it's a safe last resort.
 */
const PLACEHOLDER_NAMES = new Set(['none', 'null', 'undefined', 'n/a', 'nan'])

/**
 * Some channels hand over a literal placeholder ("None", "null") as the
 * profile name. Treat those as "no name" so the list falls back to the
 * handle or the per-channel label instead of printing the raw value.
 */
export function cleanContactName(name?: string | null): string | null {
	const trimmed = name?.trim()
	if (!trimmed || PLACEHOLDER_NAMES.has(trimmed.toLowerCase())) return null
	return trimmed
}

export function contactDisplayName(params: {
	name?: string | null
	phone?: string | null
	handle?: string | null
	channel?: ChannelType | null
	channelId?: string | null
	anonymousLabel: string
}): string {
	const { phone, handle, channel, channelId, anonymousLabel } = params
	const name = cleanContactName(params.name)
	if (name) return name
	const formattedPhone = displayPhone(phone)
	if (formattedPhone) return formattedPhone
	if (handle && handle.trim()) return handle.trim()
	// Per-channel fallback when we at least know the platform (i.e. the
	// contact exists on that channel even without a display name).
	if (channelId) {
		switch (channel) {
			case 'INSTAGRAM':
				return 'کاربر اینستاگرام'
			case 'TELEGRAM':
				return 'کاربر تلگرام'
			case 'BALE':
				return 'کاربر بله'
			case 'RUBIKA':
				return 'کاربر روبیکا'
			case 'WHATSAPP':
				return 'کاربر واتساپ'
			case 'WEB_WIDGET':
				return 'کاربر وب‌ویجت'
			case 'CHAT_LINK':
				return 'کاربر لینک‌چت'
			default:
				return anonymousLabel
		}
	}
	return anonymousLabel
}

/**
 * Pick the per-channel handle (username) for a contact, given the conversation
 * channel. Returns null when the contact has no handle on that channel.
 */
export function channelHandleFor(params: {
	channel: ChannelType | null
	telegramUsername?: string | null
	baleUsername?: string | null
	rubikaUsername?: string | null
	whatsappName?: string | null
	instagramUsername?: string | null
}): string | null {
	switch (params.channel) {
		case 'INSTAGRAM':
			return params.instagramUsername ?? null
		case 'TELEGRAM':
			return params.telegramUsername ?? null
		case 'BALE':
			return params.baleUsername ?? null
		case 'RUBIKA':
			return params.rubikaUsername ?? null
		case 'WHATSAPP':
			return params.whatsappName ?? null
		default:
			return null
	}
}

/**
 * Pick the per-channel avatar URL for a contact, given the conversation
 * channel. Returns null when the contact has no avatar on that channel.
 */
export function channelAvatarFor(params: {
	channel: ChannelType | null
	telegramAvatarUrl?: string | null
	baleAvatarUrl?: string | null
	rubikaAvatarUrl?: string | null
	whatsappAvatarUrl?: string | null
	instagramAvatarUrl?: string | null
}): string | null {
	switch (params.channel) {
		case 'INSTAGRAM':
			return params.instagramAvatarUrl ?? null
		case 'TELEGRAM':
			return params.telegramAvatarUrl ?? null
		case 'BALE':
			return params.baleAvatarUrl ?? null
		case 'RUBIKA':
			return params.rubikaAvatarUrl ?? null
		case 'WHATSAPP':
			return params.whatsappAvatarUrl ?? null
		default:
			return null
	}
}
