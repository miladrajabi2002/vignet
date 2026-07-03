'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  AlertTriangle,
  MessagesSquare,
  Bot,
  Activity,
  Server,
  LogOut,
  FileText,
  Users,
  Building2,
  CreditCard,
  TrendingUp,
  X,
} from 'lucide-react'
import { adminLogout } from '../login/actions'
import { cn } from '@/lib/utils'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
}

type NavSection = {
  title: string
  items: NavItem[]
}

const SECTIONS: NavSection[] = [
  {
    title: 'نمای کلی',
    items: [{ href: '/admin', label: 'داشبورد', icon: LayoutDashboard, exact: true }],
  },
  {
    title: 'مدیریت کاربران',
    items: [
      { href: '/admin/users', label: 'کاربران', icon: Users },
      { href: '/admin/workspaces', label: 'کسب‌وکارها', icon: Building2 },
    ],
  },
  {
    title: 'مالی و درآمد',
    items: [
      { href: '/admin/revenue', label: 'درآمد و گزارش‌ها', icon: TrendingUp },
      { href: '/admin/payments', label: 'فاکتورها و پرداخت‌ها', icon: CreditCard },
    ],
  },
  {
    title: 'پلتفرم',
    items: [
      { href: '/admin/conversations', label: 'مکالمات', icon: MessagesSquare },
      { href: '/admin/agents', label: 'ایجنت‌ها و کانال‌ها', icon: Bot },
      { href: '/admin/usage', label: 'مصرف و توکن', icon: Activity },
      { href: '/admin/blog', label: 'بلاگ', icon: FileText },
    ],
  },
  {
    title: 'سیستم',
    items: [
      { href: '/admin/errors', label: 'خطاها', icon: AlertTriangle },
      { href: '/admin/system', label: 'منابع سرور', icon: Server },
    ],
  },
]

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-5">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            {section.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {section.items.map(({ href, label, icon: Icon, exact }) => {
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
          </div>
        </div>
      ))}

      <form action={adminLogout} className="mt-2 border-t border-zinc-200 pt-3">
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          خروج از پنل
        </button>
      </form>
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
