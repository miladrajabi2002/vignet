/**
 * Shared types + helpers for the public Chat Link page (/c/[slug]).
 *
 * A Chat Link is a standalone, shareable full-screen chat page for one agent —
 * built for the "link in bio" use case (Instagram, SMS signatures, QR codes).
 * Appearance settings live in ChatLink.settings (JSON); both the dashboard
 * editor and the public endpoints normalize through here so defaults and
 * validation stay in one place (same pattern as lib/widget/config.ts).
 */

/** Ambient background treatment behind the chat column. */
export type ChatLinkBackground = 'aurora' | 'mesh' | 'dots' | 'minimal'

export const CHAT_LINK_BACKGROUNDS: {
	value: ChatLinkBackground
	labelFa: string
}[] = [
	{ value: 'aurora', labelFa: 'شفق (پیش‌فرض)' },
	{ value: 'mesh', labelFa: 'هاله رنگی' },
	{ value: 'dots', labelFa: 'نقطه‌چین' },
	{ value: 'minimal', labelFa: 'ساده' },
]

export interface ChatLinkSettings {
	/** Public display name override (defaults to the agent name). */
	displayName: string | null
	/** One-line tagline under the name, e.g. «مشاوره آنلاین فوری». */
	tagline: string | null
	/** Brand accent: user bubbles, send button, chips, focus ring. */
	primaryColor: string
	/** Ambient background style behind the chat column. */
	background: ChatLinkBackground
	/** Suggested questions shown as tappable chips on the intro state. Max 6. */
	quickReplies: string[]
	/** Ask for name + phone before the first message (feeds CRM contact). */
	leadCapture: boolean
	leadCaptureMessage: string | null
	/** Show the eyebrow «پاسخ فوری با هوش مصنوعی» badge on the intro state. */
	showAiBadge: boolean
}

export const DEFAULT_CHAT_LINK_SETTINGS: ChatLinkSettings = {
	displayName: null,
	tagline: null,
	primaryColor: '#0F0F10',
	background: 'aurora',
	quickReplies: [],
	leadCapture: false,
	leadCaptureMessage: null,
	showAiBadge: true,
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** Coerce arbitrary JSON (ChatLink.settings) into a complete, safe object. */
export function normalizeChatLinkSettings(raw: unknown): ChatLinkSettings {
	const c = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

	const displayName =
		typeof c.displayName === 'string' && c.displayName.trim()
			? c.displayName.trim().slice(0, 60)
			: null

	const tagline =
		typeof c.tagline === 'string' && c.tagline.trim()
			? c.tagline.trim().slice(0, 90)
			: null

	const primaryColor =
		typeof c.primaryColor === 'string' && HEX.test(c.primaryColor.trim())
			? c.primaryColor.trim()
			: DEFAULT_CHAT_LINK_SETTINGS.primaryColor

	const background: ChatLinkBackground =
		c.background === 'mesh' || c.background === 'dots' || c.background === 'minimal'
			? c.background
			: 'aurora'

	const quickReplies = Array.isArray(c.quickReplies)
		? c.quickReplies
				.filter((q): q is string => typeof q === 'string' && !!q.trim())
				.map((q) => q.trim().slice(0, 80))
				.slice(0, 6)
		: []

	const leadCaptureMessage =
		typeof c.leadCaptureMessage === 'string' && c.leadCaptureMessage.trim()
			? c.leadCaptureMessage.trim().slice(0, 200)
			: null

	return {
		displayName,
		tagline,
		primaryColor,
		background,
		quickReplies,
		leadCapture: c.leadCapture === true,
		leadCaptureMessage,
		showAiBadge: c.showAiBadge !== false,
	}
}

// ─── Slug rules ────────────────────────────────────────────────────────────

/** 3-32 chars, lowercase latin + digits + hyphens, no leading/trailing hyphen. */
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30})[a-z0-9]$/

/** Route/brand names a workspace must not claim as its public slug. */
const RESERVED_SLUGS = new Set([
	'admin', 'api', 'app', 'auth', 'billing', 'blog', 'c', 'chat', 'dashboard',
	'docs', 'help', 'login', 'signup', 'status', 'support', 'test', 'vigent',
	'widget', 'www',
])

/** Lowercase/trim a hand-typed slug; returns null when invalid or reserved. */
export function normalizeSlug(raw: string): string | null {
	const slug = raw.trim().toLowerCase()
	if (!SLUG_RE.test(slug)) return null
	if (RESERVED_SLUGS.has(slug)) return null
	return slug
}

/** Absolute public URL for a slug (origin from env, no trailing slash). */
export function chatLinkUrl(slug: string): string {
	const base = (
		process.env.NEXT_PUBLIC_APP_URL ||
		process.env.NEXTAUTH_URL ||
		'https://vigent.ir'
	).replace(/\/+$/, '')
	return `${base}/c/${slug}`
}
