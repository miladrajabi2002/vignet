import type { Locale } from '@/lib/locale'

/*
 * The public site is prerendered once per (locale × signed-in) combination and
 * served from an internal path: middleware rewrites /pricing to
 * /vg-site/<variant>/pricing. The browser URL never changes, and each visitor
 * gets exactly the page the old per-request render produced for them — the
 * locale from /en or the `locale` cookie, the navbar CTA from the session
 * cookie — while the server answers from the static cache.
 */

export const SITE_ROUTE_PREFIX = '/vg-site'

export const SITE_VARIANTS = ['fa', 'en', 'fa-member', 'en-member'] as const
export type SiteVariant = (typeof SITE_VARIANTS)[number]

export function siteVariant(locale: Locale, signedIn: boolean): SiteVariant {
	return `${locale}${signedIn ? '-member' : ''}` as SiteVariant
}

export function parseSiteVariant(value: string): { locale: Locale; signedIn: boolean } | null {
	if (!(SITE_VARIANTS as readonly string[]).includes(value)) return null
	return { locale: value.startsWith('en') ? 'en' : 'fa', signedIn: value.endsWith('-member') }
}

/** Top-level public pages served from the static site (everything else is per-request). */
const MARKETING_ROOTS = ['/pricing', '/privacy', '/terms', '/status', '/solutions', '/docs', '/blog'] as const

export function isMarketingPath(pathname: string): boolean {
	if (pathname === '/') return true
	return MARKETING_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`))
}

/** Matches the old marketing layout check: any Auth.js session cookie (signature verified elsewhere). */
const SESSION_COOKIE_NAMES = ['authjs.session-token', '__Secure-authjs.session-token'] as const

export function hasSessionCookie(cookieNames: Iterable<string>): boolean {
	for (const name of cookieNames) {
		if (SESSION_COOKIE_NAMES.some((base) => name === base || name.startsWith(`${base}.`))) return true
	}
	return false
}
