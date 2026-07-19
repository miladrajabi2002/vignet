export type ClientMessageCatalog = Record<string, unknown>

/**
 * Only messages consumed by Client Components need to cross the RSC boundary.
 * Server translations keep using the complete request catalog.
 */
export function pickClientMessages(
	messages: ClientMessageCatalog,
	paths: readonly string[],
): ClientMessageCatalog {
	const selected: ClientMessageCatalog = {}

	for (const path of paths) {
		const segments = path.split('.')
		let source: ClientMessageCatalog = messages
		let target = selected

		for (const [index, segment] of segments.entries()) {
			if (!(segment in source)) {
				throw new Error(`Missing client translation namespace: ${path}`)
			}

			const value = source[segment]
			const isLeaf = index === segments.length - 1
			if (isLeaf) {
				target[segment] = value
				continue
			}

			if (!value || typeof value !== 'object' || Array.isArray(value)) {
				throw new Error(`Client translation path is not a namespace: ${path}`)
			}

			const existing = target[segment]
			if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
				target[segment] = {}
			}
			target = target[segment] as ClientMessageCatalog
			source = value as ClientMessageCatalog
		}
	}

	return selected
}

export const MARKETING_CLIENT_MESSAGE_PATHS = [
	'nav',
	'marketing.hero',
	'marketing.stats',
	'marketing.faq',
	'marketing.footer',
] as const

export const AUTH_CLIENT_MESSAGE_PATHS = ['auth'] as const

export const DASHBOARD_CLIENT_MESSAGE_PATHS = [
	'common',
	'notifications',
	'learning',
	'dashboard',
	'settings',
	'agents',
	'channels',
	'conversations',
	'operatorChannel',
	'contacts',
	'knowledge',
	'products',
	'chatLink',
	'instagram',
] as const

export const ADMIN_CLIENT_MESSAGE_PATHS = ['blog'] as const
