import {
        BookOpen,
        Rocket,
        Bot,
        Database,
        Package,
        Share2,
        HelpCircle,
        Zap,
        Headset,
        UserCheck,
        ShoppingCart,
        Cpu,
        CreditCard,
        MessageCircle,
        Camera,
        Wrench,
        Settings,
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
                slug: 'managed-ai',
                href: '/docs/managed-ai',
                icon: Cpu,
                title: { fa: 'هوش مصنوعی و هزینه‌ها', en: 'Managed AI & costs' },
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
                slug: 'instagram-connection',
                href: '/docs/instagram-connection',
                icon: Camera,
                title: { fa: 'اتصال اینستاگرام', en: 'Connecting Instagram' },
        },
        {
                slug: 'instagram-troubleshooting',
                href: '/docs/instagram-troubleshooting',
                icon: Wrench,
                title: { fa: 'رفع اشکال اینستاگرام', en: 'Instagram troubleshooting' },
        },
        {
                slug: 'meta-app-setup',
                href: '/docs/meta-app-setup',
                icon: Settings,
                title: { fa: 'تنظیم اپ متا (تیم ویجنت)', en: 'Meta App setup (Vigent team)' },
        },
        {
                slug: 'handoff',
                href: '/docs/handoff',
                icon: Headset,
                title: { fa: 'انتقال به اپراتور', en: 'Operator handoff' },
        },
        {
                slug: 'customer-identification',
                href: '/docs/customer-identification',
                icon: UserCheck,
                title: { fa: 'شناسایی مشتری', en: 'Customer identification' },
        },
        {
                slug: 'woocommerce',
                href: '/docs/woocommerce',
                icon: ShoppingCart,
                title: { fa: 'اتصال ووکامرس', en: 'WooCommerce integration' },
        },
        {
                slug: 'models',
                href: '/docs/models',
                icon: Cpu,
                title: { fa: 'انتخاب مدل هوش مصنوعی', en: 'Choosing a model' },
        },
        {
                slug: 'billing',
                href: '/docs/billing',
                icon: CreditCard,
                title: { fa: 'پلن‌ها و پرداخت', en: 'Plans & billing' },
        },
        {
                slug: 'widget',
                href: '/docs/widget',
                icon: MessageCircle,
                title: { fa: 'ویجت چت وب‌سایت', en: 'Chat widget' },
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
