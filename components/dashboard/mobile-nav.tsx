'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
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
 * Mobile-only navigation. The desktop Sidebar is `hidden md:flex`, so without
 * this the dashboard has no navigation at all on phones. Renders a hamburger
 * button in the Header (md:hidden) that opens a slide-in drawer mirroring the
 * Sidebar's links.
 */
export function MobileNav({ businessType, services = [] }: { businessType?: BusinessTypeValue | null; services?: readonly string[] }) {
        const t = useTranslations('dashboard')
        const locale = useLocale()
        const pathname = usePathname()
	const [nav, setNav] = useState(() => getDashboardNavForProfile(businessType, services))
	const [newModules, setNewModules] = useState<DashboardModuleKey[]>([])
        const [open, setOpen] = useState(false)
        const [mounted, setMounted] = useState(false)

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
                const onKeyDown = (event: KeyboardEvent) => {
                        if (event.key === 'Escape') setOpen(false)
                }
                document.addEventListener('keydown', onKeyDown)
                return () => {
                        document.body.style.overflow = prev
                        document.removeEventListener('keydown', onKeyDown)
                }
        }, [open])

        return (
                <div className="md:hidden">
                        <button
                                onClick={() => setOpen(true)}
                                aria-label="Open dashboard navigation"
                                aria-expanded={open}
                                aria-controls="dashboard-mobile-navigation"
                                className="spatial-press inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white text-[var(--text-secondary)] shadow-[var(--shadow-sm)] hover:text-[var(--text-primary)]"
                        >
                                <Menu className="h-5 w-5" />
                        </button>

                        {/*
                         * Portaled to <body> on purpose. The dashboard Header wrapping this
                         * component uses `backdrop-blur`, and a `backdrop-filter` ancestor
                         * becomes the containing block for `position: fixed` descendants — so
                         * without the portal the drawer would be trapped inside the 64px-tall
                         * header and render as a broken sliver on mobile.
                         */}
                        {mounted &&
                                open &&
                                createPortal(
                                        <div className="fixed inset-0 z-[100]">
                                                {/* Backdrop */}
                                                <button
                                                        aria-label="Close menu"
                                                        onClick={() => setOpen(false)}
                                                        className="absolute inset-0 bg-black/38 backdrop-blur-sm"
                                                />

                                                {/* Drawer panel — anchored to the inline-start edge (RTL-aware). */}
                                                <aside
                                                        id="dashboard-mobile-navigation"
                                                        role="dialog"
                                                        aria-modal="true"
                                                        aria-label="Dashboard navigation"
                                                        className="spatial-control absolute inset-y-3 start-3 flex w-80 max-w-[calc(100vw-1.5rem)] flex-col rounded-[2rem] p-4 shadow-[var(--shadow-lift)]"
                                                >
                                                        <div className="mb-4 flex items-center justify-between px-1">
                                                                <Link href="/" onClick={() => setOpen(false)} className="flex-1 flex justify-center">
                                                                        <Logo priority className="h-7 w-28" />
                                                                </Link>
                                                                <button
                                                                        onClick={() => setOpen(false)}
                                                                        aria-label="Close menu"
                                                                        autoFocus
                                                                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
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
										<span className="text-[8px] font-normal text-white/55">هوش مصنوعی ویجنتو</span>
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
                                                                                                'group flex min-h-[2.5rem] items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-150',
                                                                                                active
                                                                                                        ? 'bg-[var(--bg-surface)] font-medium text-[var(--text-primary)]'
                                                                                                        : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]',
                                                                                        )}
                                                                                >
                                                                                        <Icon className={cn('h-[1.05rem] w-[1.05rem] shrink-0', active ? 'text-[var(--text-primary)]' : 'text-[var(--text-hint)] group-hover:text-[var(--text-muted)]')} />
													<span className="min-w-0 flex-1 truncate">{getDashboardModuleLabel(key, businessType, locale, t(key))}</span>
													{newModules.includes(key) && <span className="rounded-full bg-black px-2 py-0.5 text-[8px] font-bold text-white">{t('newLabel')}</span>}
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
