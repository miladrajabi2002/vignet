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
} from 'lucide-react'
import {
	getDashboardModules,
	type BusinessTypeValue,
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

export function getDashboardNav(businessType?: BusinessTypeValue | null) {
	return getDashboardModules(businessType).map((module) => NAV_ITEMS[module])
}

export function getDashboardNavForProfile(
	businessType?: BusinessTypeValue | null,
	services: readonly string[] = [],
) {
	return getDashboardModules(businessType, services).map((module) => NAV_ITEMS[module])
}

export function getDashboardNavFromModules(modules: readonly DashboardModuleKey[]) {
	return modules.map((module) => NAV_ITEMS[module]).filter(Boolean)
}

// Backwards-compatible full navigation for consumers that have not received a
// workspace vertical yet. CUSTOM intentionally exposes both optional modules.
export const NAV = getDashboardNav('CUSTOM')
