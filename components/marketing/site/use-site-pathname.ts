'use client'

import { usePathname } from 'next/navigation'
import { SITE_ROUTE_PREFIX } from '@/lib/marketing/site-variant'

/**
 * usePathname for public-site components. A statically prerendered page sees
 * its internal path (/vg-site/fa/blog) while rendering; this returns the
 * public path (/blog) instead, so the first paint already shows the right
 * active link. In the browser usePathname is the visible URL and passes through.
 */
export function useSitePathname(): string {
	const pathname = usePathname() ?? '/'
	if (!pathname.startsWith(`${SITE_ROUTE_PREFIX}/`)) return pathname
	const rest = pathname.slice(SITE_ROUTE_PREFIX.length + 1)
	const slash = rest.indexOf('/')
	return slash === -1 ? '/' : rest.slice(slash)
}
