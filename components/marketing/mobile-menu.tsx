'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Menu, X } from 'lucide-react'
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
 * Portaled to <body> on purpose: the header uses `backdrop-blur`, and a
 * backdrop-filter ancestor becomes the containing block for `position: fixed`
 * descendants — without the portal the drawer would be trapped inside the
 * 58px-tall header. Same reasoning as components/dashboard/mobile-nav.tsx.
 */
export function MarketingMobileMenu({
	links,
	ctaHref,
	ctaLabel,
	openLabel,
	closeLabel,
	navLabel,
	authenticated,
}: {
	links: { href: string; id: string; label: string }[]
	ctaHref: string
	ctaLabel: string
	openLabel: string
	closeLabel: string
	navLabel: string
	authenticated: boolean
}) {
	const pathname = usePathname()
	const [open, setOpen] = useState(false)
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		setMounted(true)
	}, [])

	// Close on navigation (an in-page #anchor tap does not change pathname, so
	// links also close it explicitly via onClick).
	useEffect(() => {
		setOpen(false)
	}, [pathname])

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
		<div className="lg:hidden">
			<button
				type="button"
				onClick={() => setOpen(true)}
				aria-label={openLabel}
				aria-expanded={open}
				aria-controls="marketing-mobile-navigation"
				className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white text-black/60 transition-colors hover:bg-black/[0.035] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
			>
				<Menu className="h-5 w-5" />
			</button>

			{mounted &&
				open &&
				createPortal(
					<div className="fixed inset-0 z-[100]">
						<button
							type="button"
							aria-label={closeLabel}
							onClick={() => setOpen(false)}
							className="absolute inset-0 bg-black/38 backdrop-blur-sm"
						/>

						<aside
							id="marketing-mobile-navigation"
							role="dialog"
							aria-modal="true"
							aria-label={navLabel}
							className="absolute inset-x-3 top-3 flex max-h-[calc(100dvh-1.5rem)] flex-col rounded-[1.75rem] border border-black/[0.07] bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.16)]"
							style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
						>
							<div className="mb-3 flex items-center justify-between">
								<Link href="/" onClick={() => setOpen(false)} aria-label="Vigent home">
									<Logo className="h-8 w-[7.25rem]" />
								</Link>
								<button
									type="button"
									onClick={() => setOpen(false)}
									aria-label={closeLabel}
									autoFocus
									className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 text-black/60 transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
								>
									<X className="h-5 w-5" />
								</button>
							</div>

							<nav className="flex flex-col gap-0.5 overflow-y-auto" aria-label={navLabel}>
								{links.map((link) => {
									const active =
										link.id === 'blog' || link.id === 'docs'
											? pathname.startsWith(`/${link.id}`)
											: link.id === 'home' && pathname === '/'
									return (
										<Link
											key={link.id}
											href={link.href}
											onClick={() => setOpen(false)}
											className={cn(
												'flex min-h-12 items-center rounded-xl px-3 text-[13px] font-medium transition-colors',
												active
													? 'bg-black text-white'
													: 'text-black/70 hover:bg-black/[0.045] hover:text-black',
											)}
										>
											{link.label}
										</Link>
									)
								})}
							</nav>

							<div className="mt-3 flex items-center gap-2 border-t border-black/[0.07] pt-3">
								<LanguageSwitcher />
								{!authenticated && (
									<Link
										href={ctaHref}
										onClick={() => setOpen(false)}
										className="marketing-pressable flex min-h-12 flex-1 items-center justify-center rounded-xl bg-black px-3.5 text-[13px] font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
									>
										{ctaLabel}
									</Link>
								)}
							</div>
						</aside>
					</div>,
					document.body,
				)}
		</div>
	)
}
