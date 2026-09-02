'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type MobileMenuLink = {
	id: string
	href: string
	label: string
	active: boolean
}

type MobileMenuCopy = {
	open: string
	close: string
	label: string
	start: string
	account: string
	accountAria: string
}

export function MarketingMobileMenu({
	links,
	authenticated,
	copy,
}: {
	links: MobileMenuLink[]
	authenticated: boolean
	copy: MobileMenuCopy
}) {
	const [open, setOpen] = useState(false)

	function closeMenu() {
		setOpen(false)
	}

	useEffect(() => {
		if (!open) return
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setOpen(false)
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [open])

	return (
		<div className="col-start-3 justify-self-end lg:hidden">
			<button
				type="button"
				aria-label={open ? copy.close : copy.open}
				aria-expanded={open}
				aria-controls="marketing-mobile-menu"
				onClick={() => setOpen((current) => !current)}
				className="relative z-30 grid min-h-11 min-w-11 place-items-center rounded-xl text-black/65 transition-colors duration-150 hover:bg-black/[0.045] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black motion-reduce:transition-none"
			>
				{open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
			</button>

			{open ? (
				<>
					<button
						type="button"
						aria-label={copy.close}
						tabIndex={-1}
						onClick={closeMenu}
						className="fixed inset-0 z-10 cursor-default bg-black/20 backdrop-blur-[2px]"
					/>
					<div
						id="marketing-mobile-menu"
						className="material-select-menu fixed inset-x-3 top-[4.55rem] z-20 mx-auto max-h-[calc(100dvh-5.5rem)] max-w-lg overflow-y-auto rounded-[1.5rem] border border-black/10 bg-white/95 p-2.5 shadow-[0_24px_70px_rgba(0,0,0,0.2)] backdrop-blur-2xl [padding-bottom:max(0.625rem,env(safe-area-inset-bottom))]"
					>
						<p className="px-2 pb-2 pt-1 text-xs font-semibold text-black/45">{copy.label}</p>
						<ul className="grid grid-cols-2 gap-1.5">
							{links.map((link) => (
								<li key={link.id}>
									<Link
										href={link.href}
										aria-current={link.active ? (link.id === 'home' ? 'page' : 'location') : undefined}
										onClick={closeMenu}
										className={cn(
											'flex min-h-12 items-center justify-between gap-2 rounded-xl px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black motion-reduce:transition-none',
											link.active
												? 'bg-black text-white'
												: 'bg-black/[0.025] text-black/65 hover:bg-black/[0.055] hover:text-black',
										)}
									>
										<span>{link.label}</span>
										{link.active ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
									</Link>
								</li>
							))}
						</ul>

						<div className="mt-2 grid grid-cols-[0.9fr_1.1fr] gap-2 border-t border-black/[0.07] pt-2">
							<Link
								href={authenticated ? '/overview' : '/login'}
								aria-label={copy.accountAria}
								onClick={closeMenu}
								className="inline-flex min-h-12 items-center justify-center rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-black/65 transition-colors hover:bg-black/[0.035] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
							>
								{copy.account}
							</Link>
							<Link
								href="/login?next=/onboarding"
								onClick={closeMenu}
								className="marketing-pressable inline-flex min-h-12 items-center justify-center rounded-xl bg-black px-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
							>
								{copy.start}
							</Link>
						</div>
					</div>
				</>
			) : null}
		</div>
	)
}
