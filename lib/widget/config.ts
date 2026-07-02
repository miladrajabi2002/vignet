/**
 * Shared types + helpers for the public web widget appearance/security settings.
 *
 * Widget settings live in the WEB_WIDGET AgentChannel's `config` JSON column, so
 * there is no dedicated table/migration. Both the dashboard (to edit) and the
 * public widget endpoints (to serve + enforce) go through the normalizer here so
 * defaults and validation stay in one place.
 */

export type WidgetTheme = 'dark' | 'light'
export type WidgetPosition = 'right' | 'left'
export type WidgetFont = 'vazirmatn' | 'samim' | 'yekan' | 'inherit'
export type WidgetCorners = 'soft' | 'round' | 'sharp'

/** Preset avatar/launcher icons (keys shared between loader.js + dashboard). */
export const WIDGET_ICONS = ['chat', 'bot', 'headset', 'sparkles', 'bag', 'help'] as const
export type WidgetIcon = (typeof WIDGET_ICONS)[number]

/** Human-readable label + Google Fonts URL per font option. */
export const WIDGET_FONTS: {
	value: WidgetFont
	labelFa: string
	labelEn: string
	href?: string
	family: string
}[] = [
	{
		value: 'vazirmatn',
		labelFa: 'وزیرمتن',
		labelEn: 'Vazirmatn',
		href: 'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css',
		family:
			"'Vazirmatn',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif",
	},
	{
		value: 'samim',
		labelFa: 'صمیم',
		labelEn: 'Samim',
		href: 'https://cdn.jsdelivr.net/gh/rastikerdar/samim-font@v4.0.5/dist/font-face.css',
		family:
			"'Samim',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif",
	},
	{
		value: 'yekan',
		labelFa: 'یکان',
		labelEn: 'Yekan',
		href: 'https://cdn.jsdelivr.net/gh/rastikerdar/vazir-font@v30.1.0/dist/font-face.css',
		family:
			"'Vazir',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif",
	},
	{ value: 'inherit', labelFa: 'فونت سایت', labelEn: 'Inherit', family: 'inherit' },
]

export interface WidgetSettings {
	/** Brand accent: launcher fill, user bubble, send button. */
	primaryColor: string
	/** Panel surface scheme. */
	theme: WidgetTheme
	/** Which corner the launcher sits in. */
	position: WidgetPosition
	/** Optional header title override (defaults to the agent name). */
	headerTitle: string | null
	/** Optional short label shown beside the launcher icon. */
	launcherLabel: string | null
	/** Font family key. */
	font: WidgetFont
	/** Preset avatar/launcher icon key. */
	icon: WidgetIcon
	/** Optional header subtitle/tagline (defaults to the online status text). */
	subtitle: string | null
	/** Corner-radius style for the panel + bubbles (legacy preset; cornerRadius wins if set). */
	corners: WidgetCorners
	/** Continuous corner radius in px (0-30). When > 0, overrides `corners`. */
	cornerRadius: number
	/**
	 * Auto-pop the welcome message as a teaser bubble after a few seconds.
	 * Delay is configurable in ms (default 4000).
	 */
	autoGreet: boolean
	autoGreetDelayMs: number
	/**
	 * Lead-capture form: shows a "please leave your phone" step before the chat
	 * opens, so the visitor can't bail mid-conversation. Disabled by default.
	 */
	leadCapture: boolean
	leadCaptureMessage: string | null
	/**
	 * Hostnames allowed to embed the widget. Empty = allow everywhere (with an
	 * "unprotected" warning shown in the dashboard).
	 */
	allowedDomains: string[]
}

export const DEFAULT_WIDGET_SETTINGS: WidgetSettings = {
	primaryColor: '#0F0F10',
	theme: 'light',
	position: 'right',
	headerTitle: null,
	launcherLabel: null,
	font: 'vazirmatn',
	icon: 'chat',
	subtitle: null,
	corners: 'soft',
	cornerRadius: 0,
	autoGreet: false,
	autoGreetDelayMs: 4000,
	leadCapture: false,
	leadCaptureMessage: null,
	allowedDomains: [],
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** Coerce arbitrary JSON (channel config) into a complete, safe settings object. */
export function normalizeWidgetSettings(raw: unknown): WidgetSettings {
	const c = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

	const primaryColor =
		typeof c.primaryColor === 'string' && HEX.test(c.primaryColor.trim())
			? c.primaryColor.trim()
			: DEFAULT_WIDGET_SETTINGS.primaryColor

	// White-first brand: default to light unless the widget explicitly opted into dark.
	const theme: WidgetTheme = c.theme === 'dark' ? 'dark' : 'light'
	const position: WidgetPosition = c.position === 'left' ? 'left' : 'right'

	const headerTitle =
		typeof c.headerTitle === 'string' && c.headerTitle.trim()
			? c.headerTitle.trim().slice(0, 60)
			: null

	const launcherLabel =
		typeof c.launcherLabel === 'string' && c.launcherLabel.trim()
			? c.launcherLabel.trim().slice(0, 40)
			: null

	// Backward-compat: legacy 'default' / 'inherit' values map to vazirmatn / inherit.
	let font: WidgetFont = DEFAULT_WIDGET_SETTINGS.font
	if (c.font === 'inherit') font = 'inherit'
	else if (c.font === 'samim') font = 'samim'
	else if (c.font === 'yekan') font = 'yekan'
	else if (typeof c.font === 'string' && c.font === 'vazirmatn') font = 'vazirmatn'
	// legacy: 'default' → 'vazirmatn'

	const icon: WidgetIcon = WIDGET_ICONS.includes(c.icon as WidgetIcon)
		? (c.icon as WidgetIcon)
		: 'chat'
	const corners: WidgetCorners =
		c.corners === 'round' || c.corners === 'sharp' ? c.corners : 'soft'

	const subtitle =
		typeof c.subtitle === 'string' && c.subtitle.trim()
			? c.subtitle.trim().slice(0, 50)
			: null

	// cornerRadius — coerce to integer 0..30; 0 means "use preset corners".
	let cornerRadius = DEFAULT_WIDGET_SETTINGS.cornerRadius
	if (typeof c.cornerRadius === 'number' && Number.isFinite(c.cornerRadius)) {
		cornerRadius = Math.max(0, Math.min(30, Math.round(c.cornerRadius)))
	} else if (typeof c.cornerRadius === 'string') {
		const n = parseInt(c.cornerRadius, 10)
		if (Number.isFinite(n)) cornerRadius = Math.max(0, Math.min(30, n))
	}

	// autoGreetDelay — coerce to integer 0..30000ms
	let autoGreetDelayMs = DEFAULT_WIDGET_SETTINGS.autoGreetDelayMs
	if (typeof c.autoGreetDelayMs === 'number' && Number.isFinite(c.autoGreetDelayMs)) {
		autoGreetDelayMs = Math.max(0, Math.min(30_000, Math.round(c.autoGreetDelayMs)))
	}

	const leadCaptureMessage =
		typeof c.leadCaptureMessage === 'string' && c.leadCaptureMessage.trim()
			? c.leadCaptureMessage.trim().slice(0, 200)
			: null

	return {
		primaryColor,
		theme,
		position,
		headerTitle,
		launcherLabel,
		font,
		icon,
		subtitle,
		corners,
		cornerRadius,
		autoGreet: c.autoGreet === true,
		autoGreetDelayMs,
		leadCapture: c.leadCapture === true,
		leadCaptureMessage,
		allowedDomains: normalizeDomains(c.allowedDomains),
	}
}

/** Lowercase, strip scheme/path/port/`www.`, dedupe. Used for storage + checks. */
export function normalizeDomains(raw: unknown): string[] {
	const list = Array.isArray(raw)
		? raw
		: typeof raw === 'string'
			? raw.split(/[\n,]/)
			: []
	const out = new Set<string>()
	for (const item of list) {
		const host = hostnameOf(String(item))
		if (host) out.add(host)
	}
	return [...out]
}

/** Extract a bare hostname from a URL, "Origin" header, or hand-typed domain. */
export function hostnameOf(value: string): string | null {
	let v = value.trim().toLowerCase()
	if (!v) return null
	// Drop scheme + any path/query the user pasted along.
	v = v.replace(/^[a-z]+:\/\//, '').replace(/\/.*$/, '')
	// Drop port + leading www.
	v = v.replace(/:\d+$/, '').replace(/^www\./, '')
	// A valid hostname has at least one dot, or is localhost.
	if (v !== 'localhost' && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(v)) return null
	return v
}

/**
 * Is a request from `origin`/`referer` allowed by the allowlist?
 * Empty allowlist = allow all. Hostname compared with www-insensitivity.
 */
export function isOriginAllowed(
	origin: string | null,
	referer: string | null,
	allowed: string[],
): boolean {
	if (allowed.length === 0) return true
	const host = hostnameOf(origin || '') || hostnameOf(referer || '')
	if (!host) return false
	return allowed.includes(host)
}

/** Resolve a corner-radius triple (panel / bubble / input) given settings. */
export function resolveCornerRadii(s: Pick<WidgetSettings, 'corners' | 'cornerRadius'>): {
	panel: number
	bubble: number
	input: number
} {
	if (s.cornerRadius > 0) {
		// Continuous mode: scale panel slightly larger than bubble/input for visual hierarchy.
		return {
			panel: Math.min(32, s.cornerRadius + 6),
			bubble: s.cornerRadius,
			input: Math.max(8, s.cornerRadius - 2),
		}
	}
	// Preset mode
	switch (s.corners) {
		case 'round':
			return { panel: 28, bubble: 20, input: 24 }
		case 'sharp':
			return { panel: 12, bubble: 9, input: 11 }
		case 'soft':
		default:
			return { panel: 22, bubble: 17, input: 18 }
	}
}

/** Pick black/white text for legibility on a given hex background. */
export function contrastOn(hex: string): '#ffffff' | '#000000' {
	const h = hex.replace('#', '')
	const full =
		h.length === 3
			? h
					.split('')
					.map((x) => x + x)
					.join('')
			: h
	const r = parseInt(full.slice(0, 2), 16)
	const g = parseInt(full.slice(2, 4), 16)
	const b = parseInt(full.slice(4, 6), 16)
	// Relative luminance (sRGB approximation).
	const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
	return lum > 0.6 ? '#000000' : '#ffffff'
}
