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
  Building2,
  ServerCog,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/logo'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
}

const NAV_ITEMS: Array<NavItem & { group?: string }> = [
  { href: '/admin', label: 'مرکز فرمان', icon: LayoutDashboard, exact: true, group: 'فرماندهی' },
  { href: '/admin/system', label: 'سلامت زیرساخت', icon: ServerCog },
  { href: '/admin/users', label: 'کاربران و مسیر رشد', icon: Users, group: 'مشتری و عملیات' },
  { href: '/admin/workspaces', label: 'کسب‌وکارها', icon: Building2 },
  { href: '/admin/conversations', label: 'گفتگوها', icon: MessagesSquare },
  { href: '/admin/agents', label: 'ایجنت‌ها و کانال‌ها', icon: Bot },
  { href: '/admin/revenue', label: 'درآمد و سود', icon: TrendingUp, group: 'مالی و AI' },
  { href: '/admin/payments', label: 'پرداخت‌ها و فاکتورها', icon: CreditCard },
  { href: '/admin/usage', label: 'مصرف و هزینه AI', icon: BarChart3 },
  { href: '/admin/ai', label: 'مدل‌ها و سیاست AI', icon: BrainCircuit },
  { href: '/admin/settings', label: 'تعرفه و پلن‌ها', icon: Settings2, group: 'سیستم' },
  { href: '/admin/errors', label: 'خطاها', icon: AlertTriangle },
  { href: '/admin/blog', label: 'مدیریت بلاگ', icon: FileText },
]

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact, group }, index) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <div key={href}>
            {group && <p className={cn('px-3 pb-1 pt-3 text-[10px] font-bold tracking-wide text-black/35', index === 0 && 'pt-1')}>{group}</p>}
            <Link
              href={href}
              onClick={onNavigate}
              className={cn(
                'group flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[12px] font-medium transition-[background-color,color,transform,box-shadow] duration-200 active:scale-[.98]',
                active
                  ? 'bg-black text-white shadow-[var(--shadow-control)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]',
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-white' : 'text-[var(--text-hint)] group-hover:text-[var(--text-muted)]')} />
              <span className="truncate">{label}</span>
              {active && <span className="ms-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />}
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
        <p className="truncate text-[13px] font-bold text-black">Vigent Control</p>
        <p className="mt-0.5 truncate text-[10px] text-black/38">OWNER OPERATING SYSTEM</p>
      </div>
    </div>
  )
}

export { NavList as AdminNavContent, BrandHeader }
