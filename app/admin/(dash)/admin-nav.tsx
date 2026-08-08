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
  Database,
  ExternalLink,
  Mail,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/logo'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
  openInNewTab?: boolean
}

const NAV_ITEMS: NavItem[] = [
      { href: '/admin', label: 'داشبورد', icon: LayoutDashboard, exact: true },
      { href: '/admin/system', label: 'سلامت و خطاها', icon: ServerCog },
      { href: '/admin/users', label: 'کاربران', icon: Users },
      { href: '/admin/conversations', label: 'گفتگوها', icon: MessagesSquare },
      { href: '/admin/mail', label: 'صندوق ایمیل', icon: Mail },
      { href: '/admin/agents', label: 'ایجنت‌ها', icon: Bot },
      { href: '/admin/revenue', label: 'درآمد و سود', icon: TrendingUp },
      { href: '/admin/payments', label: 'پرداخت‌ها و فاکتورها', icon: CreditCard },
      { href: '/admin/usage', label: 'مصرف و هزینه AI', icon: BarChart3 },
      { href: '/admin/ai', label: 'مدل‌ها و سیاست AI', icon: BrainCircuit },
      { href: '/admin/settings', label: 'تعرفه و پلن‌ها', icon: Settings2 },
      { href: '/admin/database/studio', label: 'دیتابیس Prisma Studio', icon: Database, openInNewTab: true },
      { href: '/admin/blog', label: 'مدیریت بلاگ', icon: FileText },
]

function NavList({ onNavigate, mailUnreadCount = 0 }: { onNavigate?: () => void; mailUnreadCount?: number }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Link
        href="/admin/vigento"
        onClick={onNavigate}
        aria-current={pathname.startsWith('/admin/vigento') ? 'page' : undefined}
        className="spatial-press mb-2 flex min-h-12 items-center gap-3 rounded-2xl bg-black px-3.5 text-[13px] font-semibold text-white shadow-[var(--shadow-control)]"
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/12"><Sparkles className="h-4 w-4" /></span>
        <span className="flex-1">Vigento AI</span>
        <span className="text-[11px] font-normal text-white/65">مدیریت هوشمند</span>
      </Link>
    <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain pe-1 [scrollbar-width:thin]" aria-label="ناوبری مدیریت">
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact, openInNewTab }) => {
              const active = href === '/admin/database/studio'
                ? pathname.startsWith('/admin/database')
                : exact
                  ? pathname === href
                  : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  target={openInNewTab ? '_blank' : undefined}
                  rel={openInNewTab ? 'noreferrer' : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group flex min-h-[2.38rem] items-center gap-2.5 rounded-xl px-3 py-1.5 text-[12px] transition-[background-color,color,transform,box-shadow] duration-150 active:scale-[.98]',
                    active
                      ? 'bg-black font-semibold text-white shadow-[var(--shadow-control)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]',
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-white' : 'text-[var(--text-hint)] group-hover:text-[var(--text-muted)]')} />
                  <span className="truncate">{label}</span>
                  {href === '/admin/mail' && mailUnreadCount > 0 ? (
                    <span className={cn(
                      'ms-auto min-w-5 rounded-full px-1.5 py-0.5 text-center text-[9px] font-bold tabular-nums',
                      active ? 'bg-white text-black' : 'bg-black text-white',
                    )}>
                      {Math.min(mailUnreadCount, 99).toLocaleString('fa-IR')}
                    </span>
                  ) : openInNewTab ? (
                    <ExternalLink className="ms-auto h-3 w-3 shrink-0 opacity-45" />
                  ) : active ? (
                    <span className="ms-auto h-1.5 w-1.5 rounded-full bg-blue-400" />
                  ) : null}
                </Link>
              )
      })}
    </nav>
    </div>
  )
}

/** Sidebar brand header — used in both desktop rail and mobile drawer. */
function BrandHeader() {
  return (
    <Link href="/admin" aria-label="داشبورد مدیریت" className="flex min-h-12 items-center justify-center px-2">
      <Logo priority className="h-7 w-28" />
      <span className="ms-2 rounded-full bg-black px-2 py-0.5 text-[9px] font-semibold text-white">ADMIN</span>
    </Link>
  )
}

export { NavList as AdminNavContent, BrandHeader }
