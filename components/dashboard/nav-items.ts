import {
	LayoutDashboard,
	Bot,
	Package,
	MessagesSquare,
	Users,
	Plug,
	CreditCard,
	Settings,
} from 'lucide-react'

// Shared dashboard navigation, consumed by both the desktop Sidebar and the
// mobile drawer (MobileNav) so the two never drift out of sync.
export const NAV = [
	{ key: 'overview', href: '/overview', icon: LayoutDashboard },
	{ key: 'agents', href: '/agents', icon: Bot },
	{ key: 'products', href: '/products', icon: Package },
	{ key: 'conversations', href: '/conversations', icon: MessagesSquare },
	{ key: 'contacts', href: '/contacts', icon: Users },
	{ key: 'integrations', href: '/integrations', icon: Plug },
	{ key: 'billing', href: '/billing', icon: CreditCard },
	{ key: 'settings', href: '/settings', icon: Settings },
] as const
