'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, LayoutDashboard, LogIn, Menu, Sparkles, X } from 'lucide-react'
import { useLocale } from 'next-intl'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { Logo } from '@/components/ui/logo'
import { cn } from '@/lib/utils'

/**
 * Mobile navigation for the marketing header.
 *
 * The desktop nav links, the language switcher and the signup CTA are all
 * `hidden lg:flex`, so below 1024px the header collapsed to just the logo and
 * the login button: Product / Live demo / Solutions / Pricing / Blog / Docs
 * were reachable only by scrolling to the footer, and the fa/en switch was
 * unreachable entirely. This adds the missing `lg:hidden` entry point.
 *
 * A native modal dialog supplies focus containment and Escape handling. As a
 * top-layer element it also escapes the header's backdrop-filter containing
 * block, so it can reliably cover the dynamic viewport without a portal.
 */
export function MarketingMobileMenu({
	links,
	ctaHref,
	ctaLabel,
	loginLabel,
	dashboardLabel,
	openLabel,
	closeLabel,
	navLabel,
	authenticated,
	activeSection,
}: {
	links: { href: string; id: string; label: string }[]
	ctaHref: string
	ctaLabel: string
	loginLabel: string
	dashboardLabel: string
	openLabel: string
	closeLabel: string
	navLabel: string
	authenticated: boolean
	activeSection: string
}) {
	const pathname = usePathname()
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const [open, setOpen] = useState(false)
	const dialogRef = useRef<HTMLDialogElement>(null)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const closeRef = useRef<HTMLButtonElement>(null)
	const wasOpenRef = useRef(false)
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight

	// Close on navigation (an in-page #anchor tap does not change pathname, so
	// links also close it explicitly via onClick).
	useEffect(() => {
		setOpen(false)
	}, [pathname])

	useEffect(() => {
		const desktop = window.matchMedia('(min-width: 1024px)')
		const closeOnDesktop = () => {
			if (desktop.matches) setOpen(false)
		}
		desktop.addEventListener('change', closeOnDesktop)
		return () => desktop.removeEventListener('change', closeOnDesktop)
	}, [])

	useEffect(() => {
		const dialog = dialogRef.current
		if (!dialog) return

		if (open && !dialog.open) {
			dialog.showModal()
			requestAnimationFrame(() => closeRef.current?.focus())
		} else if (!open && dialog.open) {
			dialog.close()
		}

		if (!open && wasOpenRef.current) triggerRef.current?.focus()
		wasOpenRef.current = open
	}, [open])

	useEffect(() => {
		if (!open) return
		const previousBodyOverflow = document.body.style.overflow
		const previousRootOverflow = document.documentElement.style.overflow
		document.body.style.overflow = 'hidden'
		document.documentElement.style.overflow = 'hidden'
		return () => {
			document.body.style.overflow = previousBodyOverflow
			document.documentElement.style.overflow = previousRootOverflow
		}
	}, [open])

	return (
		<div className="lg:hidden">
			<button
				ref={triggerRef}
				type="button"
				onClick={() => setOpen((current) => !current)}
				aria-label={openLabel}
				aria-expanded={open}
				aria-controls="marketing-mobile-navigation"
				className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white text-black/60 transition-colors hover:bg-black/[0.035] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
			>
				<Menu className="h-5 w-5" />
			</button>

			<dialog
				ref={dialogRef}
				id="marketing-mobile-navigation"
				aria-modal="true"
				aria-labelledby="marketing-mobile-navigation-title"
				onCancel={(event) => {
					event.preventDefault()
					setOpen(false)
				}}
				onClose={() => setOpen(false)}
				className="marketing-mobile-dialog fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none border-0 bg-white p-0 text-black lg:hidden"
			>
				<div
					className="marketing-grid grid h-full min-h-0 grid-rows-[auto_1fr_auto] overflow-y-auto px-5"
					style={{
						paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
						paddingBottom: 'max(0.9rem, env(safe-area-inset-bottom))',
					}}
				>
					<header className="grid min-h-14 grid-cols-[1fr_auto_1fr] items-center">
						<button
							ref={closeRef}
							type="button"
							onClick={() => setOpen(false)}
							aria-label={closeLabel}
							className="col-start-1 inline-flex h-11 w-11 items-center justify-center justify-self-start rounded-xl border border-black/10 bg-white text-black/60 transition-colors hover:bg-black/[0.035] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black motion-reduce:transition-none"
						>
							<X className="h-5 w-5" />
						</button>
						<Link
							href="/"
							onClick={() => setOpen(false)}
							aria-label={locale === 'fa' ? 'صفحه اصلی ویجنت' : 'Vigent home'}
							className="col-start-2 inline-flex min-h-11 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
						>
							<Logo className="h-8 w-[7.25rem]" />
						</Link>
						<span aria-hidden className="col-start-3 h-11 w-11 justify-self-end" />
					</header>

					<h2 id="marketing-mobile-navigation-title" className="sr-only">{navLabel}</h2>
					<nav className="mx-auto grid w-full max-w-md content-center gap-0.5 py-2" aria-label={navLabel}>
						{links.map((link) => {
							const active =
								link.id === 'blog' || link.id === 'docs'
									? pathname.startsWith(`/${link.id}`)
									: pathname === '/' && activeSection === link.id
							return (
								<Link
									key={link.id}
									href={link.href}
									onClick={() => setOpen(false)}
									aria-current={active ? (link.id === 'blog' || link.id === 'docs' ? 'page' : 'location') : undefined}
									className={cn(
										'group flex min-h-11 items-center justify-between rounded-xl px-4 text-[15px] font-medium transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black motion-reduce:transition-none',
										active
											? 'bg-black text-white'
											: 'text-black/68 hover:bg-black/[0.045] hover:text-black',
									)}
								>
									<span>{link.label}</span>
									<Arrow className="h-4 w-4 opacity-35 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden />
								</Link>
							)
						})}
					</nav>

					<footer className="mx-auto w-full max-w-md border-t border-black/[0.08] pt-3">
						{authenticated ? (
							<div className="grid grid-cols-[auto_1fr] gap-2">
								<LanguageSwitcher />
								<Link href="/overview" onClick={() => setOpen(false)} className="marketing-pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
									<LayoutDashboard className="h-4 w-4" aria-hidden />{dashboardLabel}
								</Link>
							</div>
						) : (
							<div className="grid gap-2">
								<div className="grid grid-cols-[auto_1fr] gap-2">
									<LanguageSwitcher />
									<Link href="/login" onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm font-medium text-black/65 transition-colors hover:bg-black/[0.035] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black motion-reduce:transition-none">
										<LogIn className="h-4 w-4" aria-hidden />{loginLabel}
									</Link>
								</div>
								<Link href={ctaHref} onClick={() => setOpen(false)} className="marketing-pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
									<Sparkles className="h-4 w-4" aria-hidden />{ctaLabel}
								</Link>
							</div>
						)}
					</footer>
				</div>
			</dialog>
		</div>
	)
}
