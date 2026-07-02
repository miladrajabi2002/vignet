'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Menu, X } from 'lucide-react'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Logo } from '@/components/ui/logo'
import { SocialLinks } from '@/components/marketing/social-links'
import { cn } from '@/lib/utils'

// In-page section anchors (homepage) plus the docs/blog routes.
const SECTION_IDS = ['features', 'how', 'pricing'] as const

export function Navbar() {
	const t = useTranslations('nav')
	const [scrolled, setScrolled] = useState(false)
	const [open, setOpen] = useState(false)
	const [active, setActive] = useState<string>('')

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 20)
		onScroll()
		window.addEventListener('scroll', onScroll, { passive: true })
		return () => window.removeEventListener('scroll', onScroll)
	}, [])

	// Scroll-spy: highlight the nav item for the section currently in view.
	useEffect(() => {
		const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter(
			(el): el is HTMLElement => el !== null,
		)
		if (sections.length === 0) return

		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries
					.filter((e) => e.isIntersecting)
					.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
				if (visible) setActive(visible.target.id)
			},
			{ rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 1] },
		)
		sections.forEach((s) => observer.observe(s))
		return () => observer.disconnect()
	}, [])

	const links = [
		{ href: '/', id: 'home', label: t('home') },
		{ href: '/#features', id: 'features', label: t('features') },
		{ href: '/#how', id: 'how', label: t('how') },
		{ href: '/#pricing', id: 'pricing', label: t('pricing') },
		{ href: '/blog', id: 'blog', label: t('blog') },
		{ href: '/docs', id: 'docs', label: t('docs') },
	]

	return (
		<header
			className={cn(
				'fixed inset-x-0 top-0 z-50 transition-colors duration-300',
				scrolled
					? 'border-b border-[var(--border-default)] bg-[var(--bg-base)]/70 backdrop-blur-xl'
					: 'bg-transparent',
			)}
		>
			<nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
				<Link
					href="/"
					className="text-[var(--text-primary)] transition-opacity hover:opacity-70"
					aria-label="Vigent"
				>
					<Logo className="h-5 w-auto" />
				</Link>

				<div className="hidden items-center gap-1 md:flex">
					{links.map((l) => (
						<Link
							key={l.href}
							href={l.href}
							className={cn(
								'rounded-full px-3.5 py-1.5 text-sm transition-colors',
								active === l.id
									? 'bg-[var(--white-10)] text-[var(--text-primary)]'
									: 'text-[var(--text-secondary)] hover:bg-[var(--white-05)] hover:text-[var(--text-primary)]',
							)}
						>
							{l.label}
						</Link>
					))}
				</div>

				<div className="hidden items-center gap-3 md:flex">
					<SocialLinks variant="compact" />
					<ThemeToggle />
					<LanguageSwitcher />
					<Link
						href="/login"
						className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
					>
						{t('login')}
					</Link>
					<Link
						href="/login"
						className="rounded-full bg-[var(--white)] px-5 py-2 text-sm font-medium text-[var(--bg-base)] shadow-[0_4px_16px_rgba(var(--ink-rgb),0.12)] transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(var(--ink-rgb),0.2)]"
					>
						{t('getStarted')}
					</Link>
				</div>

				<button
					className="text-[var(--text-primary)] md:hidden"
					onClick={() => setOpen((o) => !o)}
					aria-label="Menu"
				>
					{open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
				</button>
			</nav>

			{open && (
				<div className="border-t border-[var(--border-default)] bg-[var(--bg-base)] px-6 py-4 md:hidden">
					<div className="flex flex-col gap-1">
						{links.map((l) => (
							<Link
								key={l.href}
								href={l.href}
								onClick={() => setOpen(false)}
								className={cn(
									'rounded-lg px-3 py-2.5 text-sm transition-colors',
									active === l.id
										? 'bg-[var(--white-10)] text-[var(--text-primary)]'
										: 'text-[var(--text-secondary)] hover:bg-[var(--white-05)] hover:text-[var(--text-primary)]',
								)}
							>
								{l.label}
							</Link>
						))}
						<div className="flex items-center gap-3 pt-3">
							<SocialLinks variant="compact" />
							<ThemeToggle />
							<LanguageSwitcher />
							<Link
								href="/login"
								onClick={() => setOpen(false)}
								className="flex-1 rounded-full bg-[var(--white)] px-4 py-2.5 text-center text-sm font-medium text-[var(--bg-base)]"
							>
								{t('getStarted')}
							</Link>
						</div>
					</div>
				</div>
			)}
		</header>
	)
}
