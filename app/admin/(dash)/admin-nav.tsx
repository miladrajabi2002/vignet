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
  BrainCircuit,
  BarChart3,
  Settings2,
  ServerCog,
  Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/logo'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'مرکز فرمان', icon: LayoutDashboard, exact: true },
  { href: '/admin/system', label: 'سلامت زیرساخت', icon: ServerCog },
  { href: '/admin/users', label: 'کاربرا', icon: Users },
  { href: '/admin/conversations', label: 'گفتگوها', icon: MessagesSquare },
  { href: '/admin/agents', label: 'ایجنت‌ها', icon: Bot },
  { href: '/admin/notifications', label: 'ارسال پیام', icon: Send },
  { href: '/admin/revenue', label: 'درآمد و سود', icon: TrendingUp },
  { href: '/admin/payments', label: 'پرداخت‌ها و فاکتورها', icon: CreditCard },
  { href: '/admin/usage', label: 'مصرف و هزینه AI', icon: BarChart3 },
  { href: '/admin/ai', label: 'مدل‌ها و سیاست AI', icon: BrainCircuit },
  { href: '/admin/settings', label: 'تعرفه و پلن‌ها', icon: Settings2 },
  { href: '/admin/errors', label: 'خطاها', icon: AlertTriangle },
  { href: '/admin/blog', label: 'مدیریت بلاگ', icon: FileText },
]

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <div key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              className={cn(
                'group flex min-h-9 items-center gap-2.5 rounded-xl px-3 py-1.5 text-[12px] font-medium transition-[background-color,color,transform,box-shadow] duration-200 active:scale-[.98]',
                active
                  ? 'bg-black text-white shadow-[var(--shadow-control)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]',
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-white' : 'text-[var(--text-hint)] group-hover:text-[var(--text-muted)]')} />
              <span className="truncate">{label}</span>
              {active && <span className="ms-auto h-1.5 w-1.5 rounded-full bg-white" />}
            </Link>
          </div>
        )
      })}
    </nav>
  )
}

/** Sidebar brand header — used in both desktop rail and mobile drawer. */
function BrandHeader() {
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="flex h-10 w-10 items-center justify-center rounded-[.9rem] bg-black text-white shadow-[var(--shadow-control)]">
        <Logo variant="dark" className="h-4 w-auto max-w-6 brightness-0 invert" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-bold text-black">کنترل ویجنت</p>
        <p className="mt-0.5 truncate text-[10px] text-black/38">مدیریت یکپارچه پلتفرم</p>
      </div>
    </div>
  )
}

export { NavList as AdminNavContent, BrandHeader }
