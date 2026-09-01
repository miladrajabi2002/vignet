'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import { Menu, X, LogOut, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/logo'
import { getDashboardNavForProfile, getDashboardNavFromModules } from '@/components/dashboard/nav-items'
import type { BusinessTypeValue, DashboardModuleKey } from '@/lib/verticals/registry'
import { getDashboardModuleLabel } from '@/lib/verticals/registry'
import { logout } from '@/app/actions/auth'

/**
 * Mobile-only navigation. Primary destinations live in the persistent bottom
 * bar; its final "More" item opens the full drawer. The dashboard header does
 * not render a second hamburger trigger.
 */
export function MobileNav({ businessType, services = [] }: { businessType?: BusinessTypeValue | null; services?: readonly string[] }) {
        const t = useTranslations('dashboard')
        const locale = useLocale()
        const pathname = usePathname()
	const [nav, setNav] = useState(() => getDashboardNavForProfile(businessType, services))
	const [newModules, setNewModules] = useState<DashboardModuleKey[]>([])
        const [open, setOpen] = useState(false)
        const [mounted, setMounted] = useState(false)
        const drawerRef = useRef<HTMLElement>(null)
        const closeRef = useRef<HTMLButtonElement>(null)
        const openTriggerRef = useRef<HTMLElement | null>(null)

        const bottomNav = (['overview', 'conversations', 'contacts'] as const).flatMap((key) => {
                const item = nav.find((candidate) => candidate.key === key)
                return item ? [item] : []
        })
        const contextualItem = nav.find(({ key }) =>
                ['products', 'services', 'appointments', 'menu', 'agents'].includes(key) &&
                !bottomNav.some((item) => item.key === key),
        )
        if (contextualItem) bottomNav.push(contextualItem)

        function showDrawer(trigger: HTMLElement) {
                openTriggerRef.current = trigger
                setOpen(true)
        }

        // The drawer is portaled to <body>. Portals require the DOM, so only enable
        // after mount to stay SSR-safe.
        useEffect(() => {
                setMounted(true)
        }, [])

	useEffect(() => {
		setNav(getDashboardNavForProfile(businessType, services))
	}, [businessType, services])

	useEffect(() => {
		function onVerticalChange(event: Event) {
			const detail = (event as CustomEvent<{ modules?: DashboardModuleKey[]; newlyEnabled?: DashboardModuleKey[] }>).detail
			if (detail?.modules) setNav(getDashboardNavFromModules(detail.modules))
			setNewModules(detail?.newlyEnabled ?? [])
		}
		window.addEventListener('vigent:vertical-changed', onVerticalChange)
		return () => window.removeEventListener('vigent:vertical-changed', onVerticalChange)
	}, [])

        // Close the drawer whenever the route changes (link tapped).
        useEffect(() => {
                setOpen(false)
        }, [pathname])

        // Lock body scroll while the drawer is open.
        useEffect(() => {
                if (!open) return
                const prev = document.body.style.overflow
                document.body.style.overflow = 'hidden'
                const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus())
                const onKeyDown = (event: KeyboardEvent) => {
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
                        document.body.style.overflow = prev
                        document.removeEventListener('keydown', onKeyDown)
                        openTriggerRef.current?.focus({ preventScroll: true })
                }
        }, [open])

        return (
                <div className="md:hidden">
                        {/*
                         * The bottom navigation and its secondary drawer are portaled to
                         * <body>. The drawer opens from the labelled "More" item below, so the
                         * header does not need a duplicate hamburger action.
                         */}
                        {mounted &&
                                createPortal(
                                        <nav
                                                aria-label={t('mobileNavigation')}
                                                className="fixed inset-x-3 z-40 mx-auto grid max-w-lg grid-cols-5 gap-1 rounded-[1.4rem] border border-black/[0.08] bg-white/90 p-1.5 shadow-[0_18px_55px_rgba(0,0,0,0.18)] backdrop-blur-xl [bottom:max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
                                        >
                                                {bottomNav.map(({ key, href, icon: Icon }) => {
                                                        const active = pathname === href || pathname.startsWith(`${href}/`)
                                                        return (
                                                                <Link
                                                                        key={key}
                                                                        href={href}
                                                                        aria-current={active ? 'page' : undefined}
                                                                        className={cn(
                                                                                'spatial-press flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-medium transition-colors',
                                                                                active
                                                                                        ? 'bg-black text-white shadow-[var(--shadow-control)]'
                                                                                        : 'text-[var(--text-muted)] hover:bg-black/[0.045] hover:text-[var(--text-primary)]',
                                                                        )}
                                                                >
                                                                        <Icon className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
                                                                        <span className="max-w-full truncate">
                                                                                {getDashboardModuleLabel(key, businessType, locale, t(key))}
                                                                        </span>
                                                                </Link>
                                                        )
                                                })}
                                                <button
                                                        type="button"
                                                        onClick={(event) => showDrawer(event.currentTarget)}
                                                        aria-haspopup="dialog"
                                                        aria-expanded={open}
                                                        aria-controls="dashboard-mobile-navigation"
                                                        aria-label={t('openNavigation')}
                                                        className="spatial-press flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-medium text-[var(--text-muted)] hover:bg-black/[0.045] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
                                                >
                                                        <Menu className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
                                                        <span>{t('more')}</span>
                                                </button>
                                        </nav>,
                                        document.body,
                                )}

                        {mounted &&
                                open &&
                                createPortal(
                                        <div className="fixed inset-0 z-[100]">
                                                {/* Backdrop */}
                                                <button
                                                        type="button"
                                                        tabIndex={-1}
                                                        aria-label={t('closeNavigation')}
                                                        onClick={() => setOpen(false)}
                                                        className="dashboard-mobile-backdrop absolute inset-0 bg-black/38 backdrop-blur-sm"
                                                />

                                                {/* Drawer panel — anchored to the inline-start edge (RTL-aware). */}
                                                <aside
                                                        ref={drawerRef}
                                                        id="dashboard-mobile-navigation"
                                                        role="dialog"
                                                        aria-modal="true"
                                                        aria-label={t('mobileNavigation')}
                                                        tabIndex={-1}
								className="dashboard-mobile-sheet spatial-control absolute start-3 flex w-80 max-w-[calc(100vw-1.5rem)] flex-col rounded-[2rem] p-4 shadow-[var(--shadow-lift)] [bottom:max(0.75rem,env(safe-area-inset-bottom))] [top:max(0.75rem,env(safe-area-inset-top))]"
                                                >
                                                        <div className="mb-4 flex items-center justify-between px-1">
                                                                <Link href="/" onClick={() => setOpen(false)} className="flex-1 flex justify-center">
                                                                        <Logo priority className="h-7 w-28" />
                                                                </Link>
                                                                <button
                                                                        ref={closeRef}
                                                                        type="button"
                                                                        onClick={() => setOpen(false)}
                                                                        aria-label={t('closeNavigation')}
                                                                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
                                                                >
                                                                        <X className="h-5 w-5" />
                                                                </button>
                                                        </div>

                                                        <Link
										href="/vigento"
                                                                onClick={() => setOpen(false)}
                                                                className="spatial-press mb-2 flex min-h-12 items-center gap-3 rounded-2xl bg-black px-3.5 text-[13px] font-semibold text-white shadow-[var(--shadow-control)]"
                                                        >
                                                                <Sparkles className="h-4 w-4" />
										<span className="flex-1">Vigento AI</span>
										<span className="text-[11px] font-normal text-white/55">هوش مصنوعی ویجنتو</span>
                                                        </Link>

                                                        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
                                                                {nav.map(({ key, href, icon: Icon }) => {
                                                                        const active = pathname === href || pathname.startsWith(`${href}/`)
                                                                        return (
                                                                                <Link
                                                                                        key={key}
                                                                                        href={href}
                                                                                        onClick={() => setOpen(false)}
                                                                                        className={cn(
														'group flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] transition-colors duration-150',
                                                                                                active
                                                                                                        ? 'bg-[var(--bg-surface)] font-medium text-[var(--text-primary)]'
                                                                                                        : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]',
                                                                                        )}
                                                                                >
                                                                                        <Icon className={cn('h-[1.05rem] w-[1.05rem] shrink-0', active ? 'text-[var(--text-primary)]' : 'text-[var(--text-hint)] group-hover:text-[var(--text-muted)]')} />
													<span className="min-w-0 flex-1 truncate">{getDashboardModuleLabel(key, businessType, locale, t(key))}</span>
													{newModules.includes(key) && <span className="rounded-full bg-black px-2 py-0.5 text-[11px] font-bold text-white">{t('newLabel')}</span>}
                                                                                </Link>
                                                                        )
                                                                })}
                                                        </nav>

                                                        <form action={logout} className="mt-2 border-t border-[var(--border-default)] pt-3">
                                                                <button
                                                                        type="submit"
                                                                        className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-red-50 hover:text-danger"
                                                                >
                                                                        <LogOut className="h-4 w-4 rtl:rotate-180" />
                                                                        {t('logout')}
                                                                </button>
                                                        </form>
                                                </aside>
                                        </div>,
                                        document.body,
                                )}
                </div>
        )
}
