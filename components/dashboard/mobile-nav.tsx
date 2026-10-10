'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronLeft, LogOut, Menu, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDashboardNavForProfile, getDashboardNavFromModules, groupDashboardNav } from '@/components/dashboard/nav-items'
import { NavigationCountBadge } from '@/components/ui/navigation-count-badge'
import type { BusinessTypeValue, CapabilityKey, DashboardModuleKey } from '@/lib/verticals/registry'
import { getDashboardModuleLabel } from '@/lib/verticals/registry'
import { logout } from '@/app/actions/auth'

/**
 * Mobile-only navigation. Primary destinations live in the persistent bottom
 * bar; its final "More" item opens a bottom sheet with every other module.
 * The dashboard header does not render a second hamburger trigger.
 */
// Stable default: a fresh `[]` per render made the nav effects below see a
// "changed" dependency every render and setState forever. That render loop
// starved React, so the page content under the layout never hydrated when
// the business profile had no capabilities.
const NO_CAPABILITIES: readonly CapabilityKey[] = []

// Matches the sheet's exit transition in globals.css (.dashboard-more-sheet).
const SHEET_EXIT_MS = 220
// A downward drag past this distance, or a quick flick, dismisses the sheet.
const DISMISS_DISTANCE = 110
const DISMISS_VELOCITY = 0.55

const FOCUS_FORM = /^\/(?:agents\/[^/]+\/)?instagram\/(?:new|[^/]+\/edit)(?:\/|$)/

function isActivePath(pathname: string, href: string) {
	return pathname === href || pathname.startsWith(`${href}/`)
}

export function MobileNav({
	businessType,
	capabilities = NO_CAPABILITIES,
	handedOffCount = 0,
	instagramConnected = false,
}: {
	businessType?: BusinessTypeValue | null
	capabilities?: readonly CapabilityKey[]
	handedOffCount?: number
	/** A live Instagram channel promotes Instagram into the bar's fourth slot. */
	instagramConnected?: boolean
}) {
	const t = useTranslations('dashboard')
	const locale = useLocale()
	const pathname = usePathname()
	const [nav, setNav] = useState(() => getDashboardNavForProfile(capabilities))
	const [newModules, setNewModules] = useState<DashboardModuleKey[]>([])
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

	const bottomNav = (['overview', 'conversations', 'contacts'] as const).flatMap((key) => {
		const item = nav.find((candidate) => candidate.key === key)
		return item ? [item] : []
	})
	// Fourth slot: Instagram once it is actually connected (the daily inbox for
	// those businesses); otherwise the vertical's own primary module.
	const contextualItem = instagramConnected
		? nav.find(({ key }) => key === 'instagram') ?? getDashboardNavFromModules(['instagram'])[0]
		: nav.find(({ key }) =>
			['products', 'services', 'appointments', 'courses', 'menu', 'agents'].includes(key) &&
			!bottomNav.some((item) => item.key === key),
		)
	if (contextualItem) bottomNav.push(contextualItem)

	// The sheet lists only what the bottom bar does not already show, in the
	// rail's group order (daily → business → setup).
	const sheetNav = groupDashboardNav(nav.filter((item) => !bottomNav.some((primary) => primary.key === item.key)))
		.flatMap((section) => section.items)
	// "More" reads as the current tab when the open page lives inside the sheet.
	const moreActive = sheetNav.some(({ href }) => isActivePath(pathname, href))
	const hasNewInSheet = sheetNav.some(({ key }) => newModules.includes(key))
	const numberLocale = locale === 'en' ? 'en-US' : 'fa-IR'

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
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		if (reduceMotion) {
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

	// The sheet is portaled to <body>. Portals require the DOM, so only enable
	// after mount to stay SSR-safe.
	useEffect(() => {
		setMounted(true)
		return () => {
			if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
		}
	}, [])

	const capabilitiesKey = capabilities.join(',')
	useEffect(() => {
		setNav(getDashboardNavForProfile(capabilitiesKey ? capabilitiesKey.split(',') as CapabilityKey[] : []))
	}, [capabilitiesKey])

	useEffect(() => {
		function onVerticalChange(event: Event) {
			const detail = (event as CustomEvent<{ modules?: DashboardModuleKey[]; capabilities?: CapabilityKey[]; newlyEnabled?: DashboardModuleKey[] }>).detail
			if (detail?.modules) setNav(getDashboardNavFromModules(detail.modules, detail.capabilities))
			setNewModules(detail?.newlyEnabled ?? [])
		}
		window.addEventListener('vigent:vertical-changed', onVerticalChange)
		return () => window.removeEventListener('vigent:vertical-changed', onVerticalChange)
	}, [])

	// Close the sheet whenever the route changes (link tapped).
	useEffect(() => {
		setOpen(false)
	}, [pathname])

	// Lock body scroll and trap focus while the sheet is open.
	useEffect(() => {
		if (!open) return
		const prev = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }))
		const onKeyDown = (event: KeyboardEvent) => {
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
			document.body.style.overflow = prev
			document.removeEventListener('keydown', onKeyDown)
			openTriggerRef.current?.focus({ preventScroll: true })
		}
	}, [open, requestClose])

	// Drag-to-dismiss from the grab handle / header. Upward drags rubber-band.
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

	// Create/edit forms carry their own bottom action bar; a second floating
	// bar under it would cover the field being filled in.
	if (FOCUS_FORM.test(pathname)) return null

	return (
		<div className="md:hidden">
			{/*
			 * The bottom navigation and its secondary sheet are portaled to
			 * <body>. The sheet opens from the labelled "More" item below, so the
			 * header does not need a duplicate hamburger action.
			 */}
			{mounted &&
				createPortal(
					<nav
						aria-label={t('mobileNavigation')}
						className="fixed inset-x-3 z-40 mx-auto grid max-w-lg grid-cols-5 gap-0.5 rounded-card border border-black/[0.08] bg-white/95 p-1 shadow-[var(--elev-2)] backdrop-blur-xl [bottom:max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
					>
						{bottomNav.map(({ key, href, icon: Icon }) => {
							const active = isActivePath(pathname, href)
							return (
								<Link
									key={key}
									href={href}
									aria-current={active ? 'page' : undefined}
									className={cn(
										'spatial-press group flex min-h-[3.4rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[12px] transition-colors',
										active ? 'font-bold text-[var(--text-primary)]' : 'font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]',
									)}
								>
									{/* Active tab: a soft pill behind the icon and ink label — calmer
										than an ink tile, which outweighed the page content. */}
									<span className={cn('relative grid h-8 w-12 place-items-center rounded-full transition-colors duration-200', active ? 'bg-black/[0.07] text-[var(--text-primary)]' : 'group-hover:bg-black/[0.045]')}>
										<Icon className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" strokeWidth={active ? 2.2 : 1.9} />
										{key === 'conversations' && (
											<NavigationCountBadge
												count={handedOffCount}
												active
												locale={numberLocale}
												label={locale === 'en' ? 'Handed to operator' : 'تحویل‌شده به اپراتور'}
												className="absolute -top-1.5 end-0 h-[1.1rem] min-w-[1.1rem] text-[12px] ring-2 ring-white"
											/>
										)}
									</span>
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
							className={cn(
								'spatial-press group flex min-h-[3.4rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
								moreActive ? 'font-bold text-[var(--text-primary)]' : 'font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]',
							)}
						>
							<span className={cn('relative grid h-8 w-12 place-items-center rounded-full transition-colors duration-200', moreActive ? 'bg-black/[0.07]' : 'group-hover:bg-black/[0.045]')}>
								<Menu className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" strokeWidth={moreActive ? 2.2 : 1.9} />
								{hasNewInSheet && (
									<span aria-hidden="true" className="absolute end-2.5 top-1 h-2 w-2 rounded-full bg-[var(--text-primary)] ring-2 ring-white" />
								)}
							</span>
							<span>{t('more')}</span>
						</button>
					</nav>,
					document.body,
				)}

			{mounted &&
				open &&
				createPortal(
					<div className="fixed inset-0 z-[100]">
						<button
							type="button"
							tabIndex={-1}
							aria-label={t('closeNavigation')}
							onClick={requestClose}
							style={backdropStyle}
							className="dashboard-more-backdrop absolute inset-0 cursor-default bg-black/40 backdrop-blur-[3px]"
						/>

						<aside
							ref={drawerRef}
							id="dashboard-mobile-navigation"
							role="dialog"
							aria-modal="true"
							aria-labelledby="dashboard-more-title"
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
									<h2 id="dashboard-more-title" className="ps-1 text-[15px] font-bold text-[var(--text-primary)]">{t('more')}</h2>
									<button
										ref={closeRef}
										type="button"
										onClick={requestClose}
										aria-label={t('closeNavigation')}
										className="grid h-9 w-9 place-items-center rounded-full bg-black/[0.05] text-[var(--text-secondary)] transition-colors hover:bg-black/[0.08] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
									>
										<X className="h-4 w-4" aria-hidden="true" />
									</button>
								</div>
							</div>

							<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-2 [scrollbar-width:none]">
								{/* Every remaining module as a compact launcher grid, so the
								    whole sheet reads at a glance without scrolling. */}
								<nav aria-label={t('more')}>
									<ul className="grid grid-cols-4 gap-x-1 gap-y-3">
										{sheetNav.map(({ key, href, icon: Icon }, index) => {
											const active = isActivePath(pathname, href)
											return (
												<li key={key} className="dashboard-more-row" style={{ '--row': index } as CSSProperties}>
													<Link
														href={href}
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
															{newModules.includes(key) && (
																<span className="absolute -end-1 -top-1 rounded-full bg-[#111] px-1.5 py-px text-[10.5px] font-bold text-white ring-2 ring-[var(--bg-base)]">{t('newLabel')}</span>
															)}
														</span>
														<span className={cn('max-w-full truncate text-[12px] leading-4', active ? 'font-bold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]')}>
															{getDashboardModuleLabel(key, businessType, locale, t(key))}
														</span>
													</Link>
												</li>
											)
										})}
									</ul>
								</nav>

								<Link
									href="/vigento"
									onClick={requestClose}
									aria-current={isActivePath(pathname, '/vigento') ? 'page' : undefined}
									style={{ '--row': sheetNav.length } as CSSProperties}
									className="dashboard-more-row spatial-press group mt-4 flex min-h-[3.25rem] items-center gap-3 rounded-control bg-[#111] px-3 text-white shadow-[var(--shadow-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
								>
									<Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
									<span className="min-w-0 flex-1 truncate text-[13px]">
										<span className="font-bold">{t('vigentoName')}</span>
										<span className="text-white/60"> · {t('vigentoTagline')}</span>
									</span>
									<ChevronLeft className="h-4 w-4 shrink-0 text-white/50 ltr:rotate-180" aria-hidden="true" />
								</Link>

								<form action={logout} className="mt-1">
									<button
										type="submit"
										className="flex min-h-11 w-full items-center justify-center gap-2 rounded-control text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:text-danger active:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
									>
										<LogOut className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
										{t('logout')}
									</button>
								</form>
							</div>
						</aside>
					</div>,
					document.body,
				)}
		</div>
	)
}
