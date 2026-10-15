import type { DashboardModuleKey } from '@/lib/verticals/registry'

/**
 * A live state beside a menu item: a connection that works (`live`), one
 * half set up (`setup`) or one that needs the owner now (`alert`, with an
 * optional count). Pure: the layout computes it, the rails only draw it.
 */
export type NavStatusTone = 'live' | 'setup' | 'alert'

export interface NavStatus {
	tone: NavStatusTone
	count?: number
	/** Read by screen readers and shown as the item's tooltip. */
	label: string
}

export type NavStatusMap = Partial<Record<DashboardModuleKey, NavStatus>>
