'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { Menu, X, Rocket, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/logo'
import { NAV } from '@/components/dashboard/nav-items'
import { logout } from '@/app/actions/auth'

/**
 * Mobile-only navigation. The desktop Sidebar is `hidden md:flex`, so without
 * this the dashboard has no navigation at all on phones. Renders a hamburger
 * button in the Header (md:hidden) that opens a slide-in drawer mirroring the
 * Sidebar's links.
 */
export function MobileNav() {
	const t = useTranslations('dashboard')
	const pathname = usePathname()
	const [open, setOpen] = useState(false)
	const [mounted, setMounted] = useState(false)

	// The drawer is portaled to <body>. Portals require the DOM, so only enable
	// after mount to stay SSR-safe.
	useEffect(() => {
		setMounted(true)
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
		return () => {
			document.body.style.overflow = prev
		}
	}, [open])

	return (
		<div className="md:hidden">
			<button
				onClick={() => setOpen(true)}
				aria-label={t('overview')}
				className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
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
							className="absolute inset-0 bg-black/50 backdrop-blur-sm"
						/>

						{/* Drawer panel — anchored to the inline-start edge (RTL-aware). */}
						<aside className="absolute inset-y-0 start-0 flex w-72 max-w-[80vw] flex-col border-e border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-2xl">
							<div className="mb-6 flex items-center justify-between px-2">
								<Link href="/overview" onClick={() => setOpen(false)}>
									<Logo priority className="h-7 w-24" />
								</Link>
								<button
									onClick={() => setOpen(false)}
									aria-label="Close menu"
									className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
								>
									<X className="h-5 w-5" />
								</button>
							</div>

							<Link
								href="/onboarding"
								onClick={() => setOpen(false)}
								className={cn(
									'mb-4 flex items-center gap-3 rounded-xl border border-[var(--border-default)] px-3 py-2.5 text-sm transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]',
									pathname.startsWith('/onboarding')
										? 'border-[var(--border-strong)] text-[var(--text-primary)]'
										: 'text-[var(--text-secondary)]',
								)}
							>
								<Rocket className="h-4 w-4" />
								{t('onboarding')}
							</Link>

							<nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
								{NAV.map(({ key, href, icon: Icon }) => {
									const active = pathname === href || pathname.startsWith(`${href}/`)
									return (
										<Link
											key={key}
											href={href}
											onClick={() => setOpen(false)}
											className={cn(
												'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
												active
													? 'bg-[var(--white)] font-medium text-[var(--bg-base)]'
													: 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
											)}
										>
											<Icon className="h-4 w-4" />
											{t(key)}
										</Link>
									)
								})}
							</nav>

							<form action={logout} className="mt-2 border-t border-[var(--border-default)] pt-3">
								<button
									type="submit"
									className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-danger"
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
