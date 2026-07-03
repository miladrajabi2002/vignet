'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  AlertTriangle,
  MessagesSquare,
  Bot,
  FileText,
  Users,
  CreditCard,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
}

// Flat list — section titles removed to save vertical space and avoid scrolling.
const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'داشبورد', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'کاربران', icon: Users },
  { href: '/admin/revenue', label: 'درآمد و گزارش‌ها', icon: TrendingUp },
  { href: '/admin/payments', label: 'فاکتورها و پرداخت‌ها', icon: CreditCard },
  { href: '/admin/conversations', label: 'مکالمات', icon: MessagesSquare },
  { href: '/admin/agents', label: 'ایجنت‌ها و کانال‌ها', icon: Bot },
  { href: '/admin/blog', label: 'بلاگ', icon: FileText },
  { href: '/admin/errors', label: 'خطاها', icon: AlertTriangle },
]

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all',
              active
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4 shrink-0 transition-colors',
                active ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-700',
              )}
            />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

/** Sidebar brand header — used in both desktop rail and mobile drawer. */
function BrandHeader() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white">
        <span className="text-sm font-bold">و</span>
      </div>
      <div>
        <p className="text-sm font-bold text-zinc-900">پنل مدیریت</p>
        <p className="text-[11px] text-zinc-500">ویجنت</p>
      </div>
    </div>
  )
}

export { NavList as AdminNavContent, BrandHeader }
