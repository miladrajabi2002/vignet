'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CreditCard,
  LayoutDashboard,
  Menu,
  MessagesSquare,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { AdminNavContent, BrandHeader } from './admin-nav'
import { cn } from '@/lib/utils'

const PRIMARY_ITEMS: Array<{
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
}> = [
  { href: '/admin', label: 'داشبورد', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'کاربران', icon: Users },
  { href: '/admin/conversations', label: 'گفتگوها', icon: MessagesSquare },
  { href: '/admin/payments', label: 'پرداخت‌ها', icon: CreditCard },
]

/** Adaptive mobile admin navigation: persistent primary destinations + full menu sheet. */
export function MobileNavTrigger({ mailUnreadCount = 0 }: { mailUnreadCount?: number }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const drawerRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const openTriggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => setMounted(true), [])
  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus())

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (event.key !== 'Tab') return

      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )
      if (focusable.length === 0) {
        event.preventDefault()
        drawerRef.current?.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !drawerRef.current?.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !drawerRef.current?.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      openTriggerRef.current?.focus({ preventScroll: true })
    }
  }, [open])

  function showDrawer(trigger: HTMLElement) {
    openTriggerRef.current = trigger
    setOpen(true)
  }

  const isPrimary = PRIMARY_ITEMS.some((item) => item.exact ? pathname === item.href : pathname.startsWith(item.href))

  return (
    <div className="flex min-w-0 items-center gap-1 md:hidden">
      <button
        type="button"
        onClick={(event) => showDrawer(event.currentTarget)}
        aria-label="باز کردن منوی مدیریت"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="spatial-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black/[0.08] bg-white/75 text-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/50"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>
      <div className="w-24 overflow-hidden"><BrandHeader compact /></div>

      {mounted && createPortal(
        <nav
          aria-label="ناوبری اصلی مدیریت"
          className="fixed inset-x-3 z-50 mx-auto grid max-w-lg grid-cols-5 gap-1 rounded-[1.45rem] border border-black/10 bg-white/92 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-xl [bottom:max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
        >
          {PRIMARY_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[10px] font-bold transition-colors',
                  active ? 'bg-black text-white' : 'text-black/50 hover:bg-black/[0.045] hover:text-black',
                )}
              >
                <Icon className="h-[1.05rem] w-[1.05rem]" aria-hidden="true" />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={(event) => showDrawer(event.currentTarget)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={cn(
              'relative inline-flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[10px] font-bold transition-colors',
              open || !isPrimary ? 'bg-black text-white' : 'text-black/50 hover:bg-black/[0.045] hover:text-black',
            )}
          >
            <Menu className="h-[1.05rem] w-[1.05rem]" aria-hidden="true" />
            <span>بیشتر</span>
            {mailUnreadCount > 0 && (
              <span className="absolute end-2 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[8px] text-white ring-2 ring-white">
                {Math.min(mailUnreadCount, 99).toLocaleString('fa-IR')}
              </span>
            )}
          </button>
        </nav>,
        document.body,
      )}

      {mounted && open && createPortal(
        <div className="fixed inset-0 z-[100] md:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-label="بستن منوی مدیریت"
            onClick={() => setOpen(false)}
            className="dashboard-mobile-backdrop absolute inset-0 cursor-default bg-black/45 backdrop-blur-sm"
          />
          <aside
            ref={drawerRef}
            id="admin-mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="منوی مدیریت"
            tabIndex={-1}
            className="dashboard-mobile-sheet spatial-surface absolute start-3 flex w-80 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-[2rem] p-4 shadow-[var(--shadow-lift)] outline-none [bottom:max(0.75rem,env(safe-area-inset-bottom))] [top:max(0.75rem,env(safe-area-inset-top))]"
          >
            <div className="mb-3 flex min-h-12 items-center justify-between gap-3 border-b border-black/[0.07] pb-3">
              <div className="min-w-0 flex-1"><BrandHeader /></div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="بستن منوی مدیریت"
                className="spatial-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black/[0.08] text-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/50"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <AdminNavContent onNavigate={() => setOpen(false)} mailUnreadCount={mailUnreadCount} />
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </div>
  )
}
