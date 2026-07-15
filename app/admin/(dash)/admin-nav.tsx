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
      <button
        type="button"
        onClick={() => {
          window.dispatchEvent(new Event('vigento:open'))
          onNavigate?.()
        }}
        className="mb-2 flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.065] px-3 text-[12px] font-bold text-white shadow-[0_14px_34px_-24px_rgba(0,0,0,.8)] transition-[background-color,transform] hover:bg-white/[0.1] active:scale-[.98]"
      >
        <Sparkles className="h-4 w-4 text-emerald-300" />
        فرمان به ویجنتو
        <span className="ms-auto rounded-md border border-white/10 bg-black/15 px-1.5 py-0.5 font-mono text-[9px] text-white/40">⌘K</span>
      </button>
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact, group }, index) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <div key={href}>
            {group && <p className={cn('px-3 pb-1 pt-3 text-[10px] font-bold tracking-wide text-white/35', index === 0 && 'pt-1')}>{group}</p>}
            <Link
              href={href}
              onClick={onNavigate}
              className={cn(
                'group flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[12px] font-medium transition-[background-color,color,transform,box-shadow] duration-200 active:scale-[.98]',
                active
                  ? 'bg-white text-black shadow-[0_8px_24px_-14px_rgba(0,0,0,.85)]'
                  : 'text-white/52 hover:bg-white/[0.065] hover:text-white',
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-black' : 'text-white/35 group-hover:text-white/75')} />
              <span className="truncate">{label}</span>
              {active && <span className="ms-auto h-1.5 w-1.5 rounded-full bg-emerald-500" />}
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
      <div className="flex h-10 w-10 items-center justify-center rounded-[.9rem] bg-white text-black shadow-[0_10px_28px_-18px_rgba(0,0,0,.85)]">
        <Logo variant="dark" className="h-4 w-auto max-w-6" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-bold text-white">Vigent Control</p>
        <p className="mt-0.5 truncate text-[10px] text-white/38">OWNER OPERATING SYSTEM</p>
      </div>
    </div>
  )
}

export { NavList as AdminNavContent, BrandHeader }
