import { revalidatePath } from 'next/cache'
import { SITE_ROUTE_PREFIX } from '@/lib/marketing/site-variant'

/**
 * Re-render every static public page, in every variant, on its next request.
 * Call after an admin edit to anything public pages show (posts, categories,
 * prices). Best-effort: a freshness nudge must never fail the API call.
 */
export function revalidatePublicSite(): void {
	try {
		revalidatePath(`${SITE_ROUTE_PREFIX}/[variant]`, 'layout')
	} catch {
		// Outside a request (scripts, tests) there is no cache to revalidate.
	}
}
