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
  Database,
  ExternalLink,
  BrainCircuit,
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
  { href: '/admin/ai', label: 'هوش مصنوعی و هزینه', icon: BrainCircuit },
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
      <a
        href={process.env.NEXT_PUBLIC_DB_STUDIO_URL || 'https://vigent.ir:8443'}
        target="_blank"
        rel="noopener noreferrer"
        className="group mt-1 flex items-center gap-3 rounded-xl border-t border-zinc-100 px-3 py-2 pt-3 text-sm font-medium text-zinc-600 transition-all hover:bg-zinc-100 hover:text-zinc-900"
      >
        <Database className="h-4 w-4 shrink-0 text-zinc-400 transition-colors group-hover:text-zinc-700" />
        دیتابیس (Studio)
        <ExternalLink className="ms-auto h-3.5 w-3.5 text-zinc-300" />
      </a>
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
