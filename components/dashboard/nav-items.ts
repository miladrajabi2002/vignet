import {
	LayoutDashboard,
	Bot,
	Package,
	BriefcaseBusiness,
	QrCode,
	MessagesSquare,
	Users,
	Plug,
	CreditCard,
	Settings,
	CalendarDays,
	BarChart3,
	Camera,
	GraduationCap,
} from 'lucide-react'
import {
	collapseDashboardNavigationModules,
	getDashboardNavigationModules,
	type CapabilityKey,
	type DashboardModuleKey,
} from '@/lib/verticals/registry'

// Shared dashboard navigation, consumed by both the desktop Sidebar and the
// mobile drawer (MobileNav) so the two never drift out of sync.
const NAV_ITEMS = {
	overview: { key: 'overview', href: '/overview', icon: LayoutDashboard },
	agents: { key: 'agents', href: '/agents', icon: Bot },
	products: { key: 'products', href: '/products', icon: Package },
	services: { key: 'services', href: '/services', icon: BriefcaseBusiness },
	menu: { key: 'menu', href: '/menu', icon: QrCode },
	appointments: { key: 'appointments', href: '/appointments', icon: CalendarDays },
	courses: { key: 'courses', href: '/courses', icon: GraduationCap },
	conversations: { key: 'conversations', href: '/conversations', icon: MessagesSquare },
	contacts: { key: 'contacts', href: '/contacts', icon: Users },
	analytics: { key: 'analytics', href: '/analytics', icon: BarChart3 },
	instagram: { key: 'instagram', href: '/instagram', icon: Camera },
	integrations: { key: 'integrations', href: '/integrations', icon: Plug },
	billing: { key: 'billing', href: '/billing', icon: CreditCard },
	settings: { key: 'settings', href: '/settings', icon: Settings },
} as const satisfies Record<DashboardModuleKey, {
	key: DashboardModuleKey
	href: string
	icon: typeof LayoutDashboard
}>

export function getDashboardNavForProfile(capabilities: readonly CapabilityKey[] = []) {
	return getDashboardNavigationModules(capabilities).map((module) => NAV_ITEMS[module])
}

export function getDashboardNavFromModules(modules: readonly DashboardModuleKey[]) {
	return collapseDashboardNavigationModules(modules).map((module) => NAV_ITEMS[module]).filter(Boolean)
}

// The rail groups modules by job so a long vertical profile still scans in
// three short runs. Order inside a group keeps the vertical's own order.
export type DashboardNavGroup = 'daily' | 'business' | 'setup'

const NAV_GROUP: Record<DashboardModuleKey, DashboardNavGroup> = {
	overview: 'daily',
	conversations: 'daily',
	contacts: 'daily',
	appointments: 'daily',
	courses: 'daily',
	analytics: 'daily',
	products: 'business',
	services: 'business',
	menu: 'business',
	instagram: 'business',
	agents: 'setup',
	integrations: 'setup',
	billing: 'setup',
	settings: 'setup',
}

const GROUP_ORDER: DashboardNavGroup[] = ['daily', 'business', 'setup']

export function groupDashboardNav<T extends { key: DashboardModuleKey }>(items: readonly T[]) {
	return GROUP_ORDER
		.map((group) => ({ group, items: items.filter((item) => NAV_GROUP[item.key] === group) }))
		.filter((section) => section.items.length > 0)
}
