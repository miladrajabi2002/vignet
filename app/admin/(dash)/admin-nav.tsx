'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
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
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/logo'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'مرکز فرمان',
    items: [
      { href: '/admin', label: 'داشبورد', icon: LayoutDashboard, exact: true },
      { href: '/admin/vigento', label: 'ویجنتو', icon: Sparkles },
      { href: '/admin/system', label: 'سلامت و خطاها', icon: ServerCog },
    ],
  },
  {
    label: 'عملیات پلتفرم',
    items: [
      { href: '/admin/users', label: 'کاربران', icon: Users },
      { href: '/admin/conversations', label: 'گفتگوها', icon: MessagesSquare },
      { href: '/admin/agents', label: 'ایجنت‌ها', icon: Bot },
    ],
  },
  {
    label: 'مالی و هوش مصنوعی',
    items: [
      { href: '/admin/revenue', label: 'درآمد و سود', icon: TrendingUp },
      { href: '/admin/payments', label: 'پرداخت‌ها و فاکتورها', icon: CreditCard },
      { href: '/admin/usage', label: 'مصرف و هزینه AI', icon: BarChart3 },
      { href: '/admin/ai', label: 'مدل‌ها و سیاست AI', icon: BrainCircuit },
      { href: '/admin/settings', label: 'تعرفه و پلن‌ها', icon: Settings2 },
    ],
  },
  {
    label: 'محتوا',
    items: [{ href: '/admin/blog', label: 'مدیریت بلاگ', icon: FileText }],
  },
]

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-4" aria-label="ناوبری مدیریت">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-[9px] font-bold tracking-wide text-black/30">{group.label}</p>
          <div className="flex flex-col gap-0.5">
            {group.items.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-[12px] font-medium transition-[background-color,color,transform,box-shadow] duration-200 active:scale-[.98]',
                    active
                      ? 'bg-black text-white shadow-[var(--shadow-control)]'
                      : 'text-[var(--text-muted)] hover:bg-white/80 hover:text-[var(--text-primary)]',
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-white' : 'text-[var(--text-hint)] group-hover:text-[var(--text-muted)]')} />
                  <span className="truncate">{label}</span>
                  {active && <span className="ms-auto h-1.5 w-1.5 rounded-full bg-blue-400" />}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
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
