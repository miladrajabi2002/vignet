'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ExternalLink, LogOut, Menu, X } from 'lucide-react'
import { adminLogout } from '../login/actions'
import { ADMIN_NAV_GROUPS, ADMIN_NAV_ITEMS, ADMIN_PRIMARY_HREFS, isAdminNavActive } from './nav-items'
import { cn } from '@/lib/utils'

// Matches the sheet's exit transition in globals.css (.dashboard-more-sheet).
const SHEET_EXIT_MS = 220
// A downward drag past this distance, or a quick flick, dismisses the sheet.
const DISMISS_DISTANCE = 110
const DISMISS_VELOCITY = 0.55

const PRIMARY_ITEMS = ADMIN_PRIMARY_HREFS.flatMap((href) => {
  const item = ADMIN_NAV_ITEMS.find((candidate) => candidate.href === href)
  return item ? [item] : []
})

// The sheet lists only what the bar does not already show, in the rail's
// group order, as one flat grid.
const SHEET_ITEMS = ADMIN_NAV_GROUPS.flatMap((group) => group.items).filter((item) => !ADMIN_PRIMARY_HREFS.includes(item.href))

/**
 * Phone navigation for the owner console — the user dashboard's pattern (a
 * persistent bar whose last item opens a launcher sheet, no hamburger in the
 * header) in the console's ink, with the iris accent marking the current tab.
 */
export function AdminMobileNav({ mailUnreadCount = 0 }: { mailUnreadCount?: number }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [mounted, setMounted] = useState(false)
  const drawerRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const openTriggerRef = useRef<HTMLElement | null>(null)
  const dragStartRef = useRef<{ y: number; time: number } | null>(null)
  const closeTimerRef = useRef<number | null>(null)

  // "More" reads as the current tab when the open page lives inside the sheet.
  const moreActive = SHEET_ITEMS.some((item) => isAdminNavActive(pathname, item))

  function showDrawer(trigger: HTMLElement) {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
    openTriggerRef.current = trigger
    setClosing(false)
    setDragY(0)
    setOpen(true)
  }

  const requestClose = useCallback(() => {
    if (closeTimerRef.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOpen(false)
      return
    }
    setClosing(true)
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      setOpen(false)
      setClosing(false)
      setDragY(0)
    }, SHEET_EXIT_MS)
  }, [])

  // The bar and the sheet are portaled to <body>; portals need the DOM.
  useEffect(() => {
    setMounted(true)
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  useEffect(() => setOpen(false), [pathname])

  // Lock body scroll and trap focus while the sheet is open.
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }))

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        requestClose()
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
  }, [open, requestClose])

  // Drag-to-dismiss from the grab handle / title row. Upward drags rubber-band.
  function onDragStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || closing) return
    if ((event.target as HTMLElement).closest('a, button')) return
    dragStartRef.current = { y: event.clientY, time: performance.now() }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  function onDragMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current
    if (!start) return
    const delta = event.clientY - start.y
    setDragY(delta > 0 ? delta : Math.max(delta * 0.25, -18))
  }

  function onDragEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current
    if (!start) return
    dragStartRef.current = null
    setDragging(false)
    const delta = event.clientY - start.y
    const velocity = delta / Math.max(1, performance.now() - start.time)
    if (delta > DISMISS_DISTANCE || (delta > 24 && velocity > DISMISS_VELOCITY)) requestClose()
    else setDragY(0)
  }

  const sheetStyle: CSSProperties = closing
    ? { transform: 'translate3d(0, calc(100% + 2rem), 0)' }
    : dragY !== 0
      ? { transform: `translate3d(0, ${dragY}px, 0)`, transition: dragging ? 'none' : undefined }
      : {}
  const backdropStyle: CSSProperties = closing
    ? { opacity: 0 }
    : dragY > 0
      ? { opacity: Math.max(0.35, 1 - dragY / 420), transition: dragging ? 'none' : undefined }
      : {}

  if (!mounted) return null

  return (
    <>
      {createPortal(
        <nav
          aria-label="ناوبری اصلی مدیریت"
          className="admin-portal fixed inset-x-3 z-40 mx-auto grid max-w-lg grid-cols-5 gap-0.5 rounded-card border border-white/[0.08] bg-[#111] p-1 shadow-[var(--elev-2)] [bottom:max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
        >
          {PRIMARY_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isAdminNavActive(pathname, item)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'spatial-press flex min-h-[3.4rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[12px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--admin-accent-on-ink)]',
                  active ? 'font-bold text-white' : 'font-medium text-white/55',
                )}
              >
                <span className={cn('grid h-8 w-12 place-items-center rounded-full transition-colors duration-200', active && 'bg-white/[0.12] text-[var(--admin-accent-on-ink)]')}>
                  <Icon className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" strokeWidth={active ? 2.2 : 1.9} />
                </span>
                <span className="max-w-full truncate">{item.short}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={(event) => showDrawer(event.currentTarget)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls="admin-mobile-navigation"
            aria-label="باز کردن منوی مدیریت"
            className={cn(
              'spatial-press flex min-h-[3.4rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[12px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--admin-accent-on-ink)]',
              moreActive ? 'font-bold text-white' : 'font-medium text-white/55',
            )}
          >
            <span className={cn('relative grid h-8 w-12 place-items-center rounded-full transition-colors duration-200', moreActive && 'bg-white/[0.12] text-[var(--admin-accent-on-ink)]')}>
              <Menu className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" strokeWidth={moreActive ? 2.2 : 1.9} />
              {mailUnreadCount > 0 && (
                <span aria-hidden="true" className="absolute end-2.5 top-1 h-2 w-2 rounded-full bg-[var(--notif)] ring-2 ring-[#111]" />
              )}
            </span>
            <span>بیشتر</span>
          </button>
        </nav>,
        document.body,
      )}

      {open && createPortal(
        <div dir="rtl" className="admin-portal fixed inset-0 z-[100] md:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-label="بستن منوی مدیریت"
            onClick={requestClose}
            style={backdropStyle}
            className="dashboard-more-backdrop absolute inset-0 cursor-default bg-black/40 backdrop-blur-[3px]"
          />

          <aside
            ref={drawerRef}
            id="admin-mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-more-title"
            tabIndex={-1}
            style={sheetStyle}
            className="dashboard-more-sheet absolute inset-x-2 mx-auto flex max-h-[min(88dvh,40rem)] max-w-lg flex-col overflow-hidden rounded-sheet border border-white/80 bg-[var(--bg-base)] shadow-[0_-10px_40px_-12px_rgba(17,17,17,0.35)] outline-none [bottom:max(0.5rem,env(safe-area-inset-bottom))]"
          >
            {/* Grab zone: handle + title row. Dragging it down dismisses. */}
            <div
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
              className="shrink-0 cursor-grab touch-none select-none px-4 pt-2 active:cursor-grabbing"
            >
              <span aria-hidden="true" className="mx-auto block h-[5px] w-9 rounded-full bg-black/[0.14]" />
              <div className="flex items-center justify-between gap-3 pb-1 pt-2">
                <h2 id="admin-more-title" className="ps-1 text-[15px] font-bold text-[var(--text-primary)]">بیشتر</h2>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={requestClose}
                  aria-label="بستن منوی مدیریت"
                  className="grid h-9 w-9 place-items-center rounded-full bg-black/[0.05] text-[var(--text-secondary)] transition-colors hover:bg-black/[0.08] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-2 [scrollbar-width:none]">
              {/* Every remaining page as one compact launcher grid — the user
                  panel's sheet — so it reads at a glance without scrolling. */}
              <nav aria-label="بخش‌های مدیریت">
                <ul className="grid grid-cols-4 gap-x-1 gap-y-3">
                  {SHEET_ITEMS.map((item, index) => {
                    const Icon = item.icon
                    const active = isAdminNavActive(pathname, item)
                    return (
                      <li key={item.href} className="dashboard-more-row" style={{ '--row': index } as CSSProperties}>
                        <Link
                          href={item.mobileHref ?? item.href}
                          onClick={requestClose}
                          aria-current={active ? 'page' : undefined}
                          className="spatial-press group flex flex-col items-center gap-1.5 rounded-control px-0.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        >
                          <span
                            className={cn(
                              'relative grid h-[3.25rem] w-[3.25rem] place-items-center rounded-[16px] transition-colors',
                              active
                                ? 'bg-[#111] text-white shadow-[var(--shadow-control)]'
                                : 'border border-black/[0.05] bg-white text-[var(--text-primary)] shadow-[var(--elev-1)] group-active:bg-[var(--bg-surface)]',
                            )}
                          >
                            <Icon className="h-[1.2rem] w-[1.2rem]" aria-hidden="true" strokeWidth={active ? 2.1 : 1.8} />
                            {item.href === '/admin/mail' && mailUnreadCount > 0 && (
                              <span className="absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--notif)] px-1 text-[12px] font-bold leading-none tabular-nums text-[var(--notif-ink)] ring-2 ring-[var(--bg-base)]">
                                <span className="sr-only">خوانده‌نشده: </span>
                                {Math.min(mailUnreadCount, 99).toLocaleString('fa-IR')}
                              </span>
                            )}
                          </span>
                          <span className={cn('max-w-full truncate text-[12px] leading-4', active ? 'font-bold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]')}>
                            {item.short}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </nav>

              <div className="mt-3 grid grid-cols-2">
                <Link
                  href="/"
                  target="_blank"
                  rel="noreferrer"
                  onClick={requestClose}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-control text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  مشاهده سایت
                </Link>
                <form action={adminLogout}>
                  <button
                    type="submit"
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-control text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:text-danger active:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <LogOut className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                    خروج
                  </button>
                </form>
              </div>
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </>
  )
}
