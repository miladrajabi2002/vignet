'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { Check, Globe, House } from 'lucide-react'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { Logo } from '@/components/ui/logo'
import { MarketingMobileBottomNav } from '@/components/marketing/mobile-bottom-nav'
import { ForwardArrow, SIGNUP_HREF, toSiteLocale } from '@/components/marketing/site/ui'
import { cn } from '@/lib/utils'

const SECTION_IDS = ['capabilities', 'instagram', 'pricing', 'blog'] as const

const COPY = {
	fa: {
		home: 'خانه',
		homeAria: 'صفحه اصلی ویجنت',
		capabilities: 'قابلیت‌ها',
		instagram: 'اینستاگرام',
		solutions: 'راهکارها',
		pricing: 'قیمت‌ها',
		blog: 'بلاگ',
		start: 'شروع رایگان',
		startShort: 'شروع رایگان',
		dashboard: 'داشبورد من',
		dashboardAria: 'رفتن به داشبورد',
		login: 'ورود',
		primaryNav: 'ناوبری اصلی',
		lang: 'EN',
		langAria: 'English',
	},
	en: {
		home: 'Home',
		homeAria: 'Vigent home',
		capabilities: 'Features',
		instagram: 'Instagram',
		solutions: 'Solutions',
		pricing: 'Pricing',
		blog: 'Blog',
		start: 'Start free',
		startShort: 'Start free',
		dashboard: 'My dashboard',
		dashboardAria: 'Go to dashboard',
		login: 'Log in',
		primaryNav: 'Primary navigation',
		lang: 'فا',
		langAria: 'فارسی',
	},
} as const

/**
 * Public-site header: a floating glass bar (blur only on desktop — phones get
 * an opaque surface) with the wordmark centred. On phones the page links move
 * to the bottom tab bar; tablets (md and up) already get the full link row.
 */
export function Navbar({ authenticated }: { authenticated: boolean }) {
	const locale = toSiteLocale(useLocale())
	const copy = COPY[locale]
	const pathname = usePathname()
	const [scrolled, setScrolled] = useState(false)
	const [activeSection, setActiveSection] = useState('')
	// /en/* is the English URL of the same page, so /en is a homepage too.
	const english = pathname === '/en' || pathname.startsWith('/en/')
	const basePath = english ? pathname.slice(3) || '/' : pathname
	const isLandingPath = basePath === '/'
	const home = english ? '/en' : '/'

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 10)
		onScroll()
		window.addEventListener('scroll', onScroll, { passive: true })
		return () => window.removeEventListener('scroll', onScroll)
	}, [])

	useEffect(() => {
		if (!isLandingPath || !('IntersectionObserver' in window)) {
			setActiveSection('')
			return
		}
		const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter((section): section is HTMLElement => Boolean(section))
		const visible = new Set<string>()
		const observer = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) visible.add(entry.target.id)
				else visible.delete(entry.target.id)
			}
			setActiveSection(SECTION_IDS.find((id) => visible.has(id)) ?? '')
		}, { rootMargin: '-30% 0px -60% 0px', threshold: 0 })
		for (const section of sections) observer.observe(section)
		return () => observer.disconnect()
	}, [isLandingPath, pathname])

	const links = [
		{ id: 'capabilities', href: `${home}#capabilities`, label: copy.capabilities },
		{ id: 'instagram', href: `${home}#instagram`, label: copy.instagram },
		{ id: 'solutions', href: '/solutions', label: copy.solutions },
		{ id: 'pricing', href: `${home}#pricing`, label: copy.pricing },
		{ id: 'blog', href: '/blog', label: copy.blog },
	]

	return (
		<header className="fixed inset-x-0 top-0 z-50 px-3 pt-2 lg:px-5 lg:pt-3.5">
			<nav
				aria-label={copy.primaryNav}
				className={cn(
					'vg-glass relative mx-auto grid h-[58px] max-w-[1200px] grid-cols-[1fr_auto_1fr] items-center rounded-card border px-2 transition-[border-color,box-shadow] duration-200 md:flex md:justify-between md:px-2.5 lg:h-16',
					scrolled ? 'border-black/10 shadow-[var(--elev-1)]' : 'border-black/[0.07] shadow-[var(--elev-1)]',
				)}
			>
				<div className="col-start-1 flex items-center justify-start md:hidden">
					<LanguageSwitcher bare className="vg-press inline-flex size-11 items-center justify-center rounded-xl text-vg-sub">
						<Globe aria-hidden className="size-[18px]" strokeWidth={1.8} />
						<span className="sr-only">{copy.langAria}</span>
					</LanguageSwitcher>
				</div>

				{/* Off the homepage, a home chip leads the desktop links (the wordmark
				    is the home link on tablets, where the row is tighter). */}
				<div className="hidden items-center gap-0.5 md:flex">
				{!isLandingPath ? (
					<>
						<Link
							href={home}
							className="vg-navlink vg-press hidden min-h-11 items-center gap-1.5 rounded-xl px-3 text-[15px] text-vg-sub focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vg-signal lg:inline-flex"
						>
							<House aria-hidden className="size-4" strokeWidth={1.8} />
							{copy.home}
						</Link>
						<span aria-hidden className="mx-1 hidden h-5 w-px bg-black/10 lg:block" />
					</>
				) : null}
				<ul className="flex items-center gap-0.5">
					{links.map((link) => {
						const active = link.id === 'solutions' || link.id === 'blog'
							? pathname.startsWith(`/${link.id}`) || pathname.startsWith(`/en/${link.id}`)
							: isLandingPath && activeSection === link.id
						return (
							<li key={link.id} className={link.id === 'instagram' || link.id === 'blog' ? 'hidden xl:block' : undefined}>
								<Link
									href={link.href}
									aria-current={active ? (link.id === 'solutions' || link.id === 'blog' ? 'page' : 'location') : undefined}
									className={cn(
										'vg-press relative inline-flex min-h-11 items-center rounded-xl px-2.5 text-[13px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vg-signal lg:px-3.5 lg:text-[15px]',
										active ? 'bg-black/[0.055] font-medium text-vg-ink' : 'vg-navlink text-vg-sub',
									)}
								>
									{link.label}
									{/* Scroll-spy moves this state section by section; a soft tint and
									    a violet dot keep the Start CTA the only ink element in the bar. */}
									{active ? <span aria-hidden className="absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-vg-signal" /> : null}
								</Link>
							</li>
						)
						})}
					</ul>
					</div>

					<Link
						href={home}
						aria-label={copy.homeAria}
					className="col-start-2 inline-flex min-h-11 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vg-signal md:absolute md:left-1/2 md:-translate-x-1/2"
				>
					<Logo priority className="h-7 w-28 lg:h-[26px] lg:w-[116px]" />
				</Link>

				<div className="col-start-3 hidden items-center justify-end gap-1.5 md:flex lg:gap-2">
					<LanguageSwitcher bare className="vg-navlink vg-press inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-[13px] text-vg-sub lg:px-3">
						<Globe aria-hidden className="size-4" strokeWidth={1.8} />
						<span lang={locale === 'fa' ? 'en' : 'fa'}>{copy.lang}</span>
					</LanguageSwitcher>
					{authenticated ? (
						<Link href="/overview" aria-label={copy.dashboardAria} className="vg-press vg-btn-dark inline-flex h-11 items-center gap-2 rounded-control bg-vg-ink px-4 text-[15px] font-medium text-white">
							<span aria-hidden className="flex size-4 items-center justify-center rounded-full bg-emerald-500"><Check className="size-2.5" strokeWidth={3} /></span>
							{copy.dashboard}
						</Link>
					) : (
						<>
							<Link href="/login" className="vg-press vg-btn-ghost inline-flex h-11 items-center rounded-control border border-black/10 bg-white px-3 text-[15px] font-medium text-vg-ink lg:px-4">{copy.login}</Link>
							<Link href={SIGNUP_HREF} className="vg-press vg-btn-dark inline-flex h-11 items-center gap-2 rounded-control bg-vg-ink px-3.5 text-[15px] font-medium text-white lg:px-[18px]">
								{copy.start}
								<ForwardArrow locale={locale} />
							</Link>
						</>
					)}
				</div>

				{isLandingPath ? (
					<span aria-hidden className="col-start-3 size-11 justify-self-end md:hidden" />
				) : (
					<Link
						href={home}
						aria-label={copy.home}
						className="vg-press col-start-3 inline-flex size-11 items-center justify-center justify-self-end rounded-xl text-vg-sub focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vg-signal md:hidden"
					>
						<House aria-hidden className="size-[18px]" strokeWidth={1.8} />
					</Link>
				)}
			</nav>

			<MarketingMobileBottomNav
				authenticated={authenticated}
				homeHref={home}
				isLandingPath={isLandingPath}
				activeSection={activeSection}
				copy={{
					home: copy.home,
					capabilities: copy.capabilities,
					startFree: copy.startShort,
					pricing: copy.pricing,
					login: copy.login,
					dashboard: copy.dashboard,
					primaryNav: copy.primaryNav,
					dashboardAria: copy.dashboardAria,
				}}
			/>
		</header>
	)
}
