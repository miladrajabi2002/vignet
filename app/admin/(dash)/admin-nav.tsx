'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ExternalLink, LogOut, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/logo'
import { adminLogout } from '../login/actions'
import { ADMIN_NAV_GROUPS, isAdminNavActive } from './nav-items'

/** The "ADMIN" tag that follows the wordmark wherever the console shows it. */
export function AdminTag({ className }: { className?: string }) {
  return (
    <span className={cn('rounded-full bg-[var(--signal)] px-2 py-0.5 text-[12px] font-bold leading-5 tracking-wide text-white', className)}>
      ADMIN
    </span>
  )
}

/**
 * Desktop rail. Same geometry as the user dashboard's rail (68px icon rail on
 * tablets, 17rem with labels from lg) but in ink, so the owner can tell the
 * two panels apart at a glance. Phones use MobileNav instead.
 */
export function AdminRail({ mailUnreadCount = 0, ownerName }: { mailUnreadCount?: number; ownerName: string }) {
  const pathname = usePathname()
  const vigentoActive = pathname.startsWith('/admin/vigento')

  return (
    <aside className="admin-rail sticky top-3 m-3 me-0 hidden h-[calc(100dvh-1.5rem)] w-[4.25rem] shrink-0 flex-col rounded-sheet p-2 md:flex lg:w-[17rem] lg:p-3">
      <Link href="/admin" aria-label="داشبورد مدیریت" className="mb-2 flex min-h-12 items-center justify-center gap-2 px-2">
        <Logo priority variant="white" className="hidden h-7 w-28 lg:block" />
        <span aria-hidden className="relative block h-7 w-[26px] overflow-hidden lg:hidden" dir="ltr">
          <Logo variant="white" className="absolute left-0 top-0 h-7 w-28" />
        </span>
        <AdminTag className="hidden lg:inline" />
      </Link>

      {/* The assistant is the rail's only filled block — and the one place the
          accent appears at full strength. */}
      <Link
        href="/admin/vigento"
        title="Vigento AI"
        aria-current={vigentoActive ? 'page' : undefined}
        className={cn(
          'spatial-press mb-3 flex min-h-11 items-center justify-center gap-3 rounded-control bg-[var(--signal)] text-[13px] font-medium text-white lg:justify-start lg:px-3.5',
          vigentoActive && 'ring-2 ring-white/70 ring-offset-2 ring-offset-[#111]',
        )}
      >
        <span className="grid h-7 w-7 place-items-center rounded-chip bg-white/15">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="hidden flex-1 lg:block">Vigento AI</span>
        <span className="hidden text-[12px] font-normal text-white/75 lg:block">مدیریت هوشمند</span>
      </Link>

      {/* Every page stays reachable on short screens: the list scrolls without
          a visible scrollbar and its bottom edge fades out. */}
      <nav
        aria-label="ناوبری مدیریت"
        className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain pb-6 [mask-image:linear-gradient(#000_calc(100%-1.75rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {ADMIN_NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.key} className="space-y-0.5">
            <p className="hidden px-3 pb-0.5 text-[12px] font-medium text-white/40 lg:block">{group.label}</p>
            {groupIndex > 0 && <span aria-hidden className="mx-3 mb-2 block h-px bg-white/10 lg:hidden" />}
            {group.items.map((item) => {
              const { href, label, icon: Icon, openInNewTab } = item
              const active = isAdminNavActive(pathname, item)
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  target={openInNewTab ? '_blank' : undefined}
                  rel={openInNewTab ? 'noreferrer' : undefined}
                  aria-current={active ? 'page' : undefined}
                  className="admin-rail-link"
                >
                  <Icon className="h-[1.05rem] w-[1.05rem] shrink-0" strokeWidth={active ? 2.2 : 1.9} />
                  <span className="hidden min-w-0 flex-1 truncate lg:block">{label}</span>
                  {href === '/admin/mail' && mailUnreadCount > 0 ? (
                    <>
                      <span className="hidden h-5 min-w-5 items-center justify-center rounded-full bg-[var(--notif)] px-1 text-[12px] font-bold leading-none tabular-nums text-[var(--notif-ink)] lg:inline-flex">
                        <span className="sr-only">ایمیل خوانده‌نشده: </span>
                        {Math.min(mailUnreadCount, 99).toLocaleString('fa-IR')}
                      </span>
                      <span aria-hidden className="absolute end-2.5 top-2 h-2 w-2 rounded-full bg-[var(--notif)] ring-2 ring-[#111] lg:hidden" />
                    </>
                  ) : openInNewTab ? (
                    <ExternalLink className="hidden !h-3 !w-3 shrink-0 lg:block" aria-hidden />
                  ) : null}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Who holds the console, and the one place to leave it. */}
      <div className="mt-1 flex items-center justify-center gap-2.5 border-t border-white/10 pt-2 lg:justify-start lg:ps-1">
        <span aria-hidden className="relative hidden h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-[13px] font-bold text-white lg:grid">
          {ownerName.slice(0, 1)}
          <span className="absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#111]" />
        </span>
        <div className="hidden min-w-0 flex-1 lg:block">
          <p className="truncate text-[13px] font-medium leading-5 text-white">{ownerName}</p>
          <p className="truncate text-[12px] leading-5 text-white/50">مالک پلتفرم</p>
        </div>
        <form action={adminLogout}>
          <button
            type="submit"
            aria-label="خروج از پنل مدیریت"
            title="خروج از پنل مدیریت"
            className="grid h-10 w-10 place-items-center rounded-control text-white/55 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--admin-accent-on-ink)] lg:h-9 lg:w-9"
          >
            <LogOut className="h-[1.05rem] w-[1.05rem] rtl:rotate-180" />
          </button>
        </form>
      </div>
    </aside>
  )
}
