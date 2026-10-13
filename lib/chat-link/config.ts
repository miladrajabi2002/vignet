/**
 * Shared types + helpers for the public Chat Link page (/c/[slug]).
 *
 * A Chat Link is a standalone, shareable full-screen chat page for one agent —
 * built for the "link in bio" use case (Instagram, SMS signatures, QR codes).
 * Appearance settings live in ChatLink.settings (JSON); both the dashboard
 * editor and the public endpoints normalize through here so defaults and
 * validation stay in one place (same pattern as lib/widget/config.ts).
 */

import { openState } from '@/lib/menu/settings'

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
        /**
         * When lead capture is on, force the visitor to fill the form — hide the
         * "skip and start chat" button. Default false (skipping allowed) so the
         * AI can fall back to extracting name/phone from the conversation itself.
         */
        leadCaptureRequired: boolean
        leadCaptureMessage: string | null
        /** Show the eyebrow «پاسخ فوری با هوش مصنوعی» badge on the intro state. */
        showAiBadge: boolean
        /** Business logo shown instead of the agent avatar / monogram. */
        logoUrl: string | null
        /** Wide photo above the intro; also the image of the share card. */
        coverUrl: string | null
        /** Welcome bubble for this link (defaults to the agent's welcome message). */
        welcomeMessage: string | null
        // Quick actions under the name on the intro state; an empty one is hidden.
        phone: string | null
        mapUrl: string | null
        /** Instagram handle without the «@». */
        instagram: string | null
        website: string | null
        /** Show a few of the agent's products on the intro state. */
        showcase: boolean
        /** Daily opening hours (Tehran time); outside them the page says «بسته». */
        hoursEnabled: boolean
        /** 'HH:MM', or '' when not set. */
        openAt: string
        closeAt: string
        closedMessage: string | null
        /** Title/description of the card messengers show for the link. */
        shareTitle: string | null
        shareDescription: string | null
        /** Tracking links: `/c/slug?src=<key>` counts visits per place the link is shared. */
        sources: ChatLinkSource[]
}

export interface ChatLinkSource {
        key: string
        label: string
}

export const MAX_CHAT_LINK_SOURCES = 8

export const DEFAULT_CHAT_LINK_SETTINGS: ChatLinkSettings = {
        displayName: null,
        tagline: null,
        primaryColor: '#0F0F10',
        background: 'aurora',
        quickReplies: [],
        // Default ON: new chat links ask for name + phone before the chat opens
        // so the workspace captures a CRM lead on every conversation. Existing
        // links keep their stored values; only newly-created links get this.
        leadCapture: true,
        leadCaptureRequired: true,
        leadCaptureMessage: null,
        showAiBadge: true,
        logoUrl: null,
        coverUrl: null,
        welcomeMessage: null,
        phone: null,
        mapUrl: null,
        instagram: null,
        website: null,
        showcase: false,
        hoursEnabled: false,
        openAt: '',
        closeAt: '',
        closedMessage: null,
        shareTitle: null,
        shareDescription: null,
        sources: [],
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/
const SOURCE_KEY = /^[a-z0-9][a-z0-9_-]{0,23}$/

function text(value: unknown, max: number): string | null {
        return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
}

/** An uploaded image: https, or a path on this site. */
function imageUrl(value: unknown): string | null {
        const url = text(value, 600)
        return url && (/^https:\/\//.test(url) || /^\/(?!\/)/.test(url)) ? url : null
}

function httpsUrl(value: unknown): string | null {
        const url = text(value, 600)
        return url && /^https:\/\//.test(url) ? url : null
}

/** `?src=` value → a tracking key, or null when it is not one. */
export function normalizeSourceKey(raw: unknown): string | null {
        if (typeof raw !== 'string') return null
        const key = raw.trim().toLowerCase()
        return SOURCE_KEY.test(key) ? key : null
}

function sources(value: unknown): ChatLinkSource[] {
        if (!Array.isArray(value)) return []
        const out: ChatLinkSource[] = []
        for (const item of value) {
                if (!item || typeof item !== 'object') continue
                const key = normalizeSourceKey((item as Record<string, unknown>).key)
                const label = text((item as Record<string, unknown>).label, 40)
                if (!key || !label || out.some((source) => source.key === key)) continue
                out.push({ key, label })
                if (out.length === MAX_CHAT_LINK_SOURCES) break
        }
        return out
}

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
                leadCaptureRequired: c.leadCaptureRequired === true,
                leadCaptureMessage,
                showAiBadge: c.showAiBadge !== false,
                logoUrl: imageUrl(c.logoUrl),
                coverUrl: imageUrl(c.coverUrl),
                welcomeMessage: text(c.welcomeMessage, 500),
                phone: text(c.phone, 24),
                mapUrl: httpsUrl(c.mapUrl),
                instagram:
                        typeof c.instagram === 'string' && /^@?[A-Za-z0-9._]{1,40}$/.test(c.instagram.trim())
                                ? c.instagram.trim().replace(/^@/, '')
                                : null,
                website: httpsUrl(c.website),
                showcase: c.showcase === true,
                hoursEnabled: c.hoursEnabled === true,
                openAt: typeof c.openAt === 'string' && CLOCK.test(c.openAt) ? c.openAt : '',
                closeAt: typeof c.closeAt === 'string' && CLOCK.test(c.closeAt) ? c.closeAt : '',
                closedMessage: text(c.closedMessage, 200),
                shareTitle: text(c.shareTitle, 70),
                shareDescription: text(c.shareDescription, 160),
                sources: sources(c.sources),
        }
}

/** Open right now? null when the link has no opening hours. */
export function chatLinkOpenState(
        settings: Pick<ChatLinkSettings, 'hoursEnabled' | 'openAt' | 'closeAt'>,
        now: Date,
): { open: boolean; until: string } | null {
        return settings.hoursEnabled ? openState(settings, now) : null
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
export function chatLinkUrl(slug: string, source?: string | null): string {
        const base = (
                process.env.NEXT_PUBLIC_APP_URL ||
                process.env.NEXTAUTH_URL ||
                'https://vigent.ir'
        ).replace(/\/+$/, '')
        return `${base}/c/${slug}${source ? `?src=${source}` : ''}`
}
