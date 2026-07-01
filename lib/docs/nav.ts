import {
	BookOpen,
	Rocket,
	Bot,
	Database,
	Package,
	Share2,
	HelpCircle,
	Zap,
	type LucideIcon,
} from 'lucide-react'

export interface DocNavItem {
	slug: string
	href: string
	icon: LucideIcon
	title: { fa: string; en: string }
}

/** Lightweight nav (no page bodies) — safe to import into the client sidebar. */
export const DOCS_NAV: DocNavItem[] = [
	{
		slug: 'introduction',
		href: '/docs',
		icon: BookOpen,
		title: { fa: 'معرفی', en: 'Introduction' },
	},
	{
		slug: 'getting-started',
		href: '/docs/getting-started',
		icon: Rocket,
		title: { fa: 'شروع به کار', en: 'Getting started' },
	},
	{
		slug: 'agents',
		href: '/docs/agents',
		icon: Bot,
		title: { fa: 'ساخت ایجنت', en: 'Building agents' },
	},
	{
		slug: 'knowledge-base',
		href: '/docs/knowledge-base',
		icon: Database,
		title: { fa: 'پایگاه دانش', en: 'Knowledge base' },
	},
	{
		slug: 'products',
		href: '/docs/products',
		icon: Package,
		title: { fa: 'کاتالوگ محصولات', en: 'Product catalog' },
	},
	{
		slug: 'channels',
		href: '/docs/channels',
		icon: Share2,
		title: { fa: 'کانال‌ها و ویجت', en: 'Channels & widget' },
	},
	{
		slug: 'caching',
		href: '/docs/caching',
		icon: Zap,
		title: { fa: 'سیستم کش', en: 'Caching' },
	},
	{
		slug: 'faq',
		href: '/docs/faq',
		icon: HelpCircle,
		title: { fa: 'سوالات متداول', en: 'FAQ' },
	},
]
