import {
  BarChart3,
  Bot,
  BrainCircuit,
  Cpu,
  CreditCard,
  Database,
  FileText,
  LayoutDashboard,
  LayoutTemplate,
  Mail,
  MessagesSquare,
  Radar,
  ServerCog,
  Settings2,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type AdminNavItem = {
  href: string
  label: string
  /** Label under a launcher tile / in the phone bar, where space is tight. */
  short: string
  icon: LucideIcon
  /** Only the exact path is "current" (the dashboard home). */
  exact?: boolean
  /** Pathname prefix that marks the item current when it differs from `href`. */
  match?: string
  openInNewTab?: boolean
  /** Phones get this in-panel page instead (Prisma Studio needs a desktop). */
  mobileHref?: string
}

export type AdminNavGroup = { key: string; label: string; items: AdminNavItem[] }

/**
 * Every admin destination, grouped by the job it serves. The desktop rail,
 * the phone bar and its "more" sheet all read this one list, so a page can
 * never be reachable on one and missing on another.
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    key: 'monitor',
    label: 'پایش',
    items: [
      { href: '/admin', label: 'داشبورد', short: 'داشبورد', icon: LayoutDashboard, exact: true },
      { href: '/admin/system', label: 'سلامت و خطاها', short: 'سلامت', icon: ServerCog },
    ],
  },
  {
    key: 'customers',
    label: 'مشتریان',
    items: [
      { href: '/admin/users', label: 'کاربران', short: 'کاربران', icon: Users },
      { href: '/admin/conversations', label: 'گفتگوها', short: 'گفتگوها', icon: MessagesSquare },
      { href: '/admin/agents', label: 'ایجنت‌ها', short: 'ایجنت‌ها', icon: Bot },
      { href: '/admin/mail', label: 'صندوق ایمیل', short: 'ایمیل', icon: Mail },
    ],
  },
  {
    key: 'finance',
    label: 'مالی',
    items: [
      { href: '/admin/revenue', label: 'درآمد و سود', short: 'درآمد', icon: TrendingUp },
      { href: '/admin/payments', label: 'پرداخت‌ها و فاکتورها', short: 'پرداخت‌ها', icon: CreditCard },
      { href: '/admin/usage', label: 'مصرف و هزینه AI', short: 'مصرف AI', icon: BarChart3 },
    ],
  },
  {
    key: 'ai',
    label: 'هوش مصنوعی',
    items: [
      { href: '/admin/ai', label: 'مدل‌ها و سیاست AI', short: 'مدل‌ها', icon: BrainCircuit },
      { href: '/admin/agent-core', label: 'هستهٔ ایجنت', short: 'هسته', icon: Cpu },
      { href: '/admin/skills', label: 'اسکیل‌های بهبود', short: 'اسکیل‌ها', icon: Radar },
      { href: '/admin/settings', label: 'تنظیمات پلتفرم', short: 'تنظیمات', icon: Settings2 },
    ],
  },
  {
    key: 'content',
    label: 'محتوا و داده',
    items: [
      { href: '/admin/blog', label: 'مدیریت بلاگ', short: 'بلاگ', icon: FileText },
      { href: '/admin/showcase', label: 'محتوای صفحه اصلی', short: 'صفحه اصلی', icon: LayoutTemplate },
      { href: '/admin/database/studio', label: 'دیتابیس', short: 'دیتابیس', icon: Database, match: '/admin/database', openInNewTab: true, mobileHref: '/admin/database' },
    ],
  },
]

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((group) => group.items)

/** The four destinations pinned to the phone bar; the rest live in "more". */
export const ADMIN_PRIMARY_HREFS = ['/admin', '/admin/users', '/admin/conversations', '/admin/payments']

export function isAdminNavActive(pathname: string, item: Pick<AdminNavItem, 'href' | 'exact' | 'match'>): boolean {
  if (item.exact) return pathname === item.href
  const base = item.match ?? item.href
  return pathname === base || pathname.startsWith(`${base}/`)
}
