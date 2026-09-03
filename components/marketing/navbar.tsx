'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, ArrowRight, Check, LogIn } from 'lucide-react'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { Logo } from '@/components/ui/logo'
import { MarketingMobileBottomNav } from '@/components/marketing/mobile-bottom-nav'
import { cn } from '@/lib/utils'

const SECTION_IDS = ['solutions', 'product', 'vigento', 'pricing'] as const
const HOME_VARIANT_PATH = /^\/[1-5]$/

const COPY = {
	fa: {
		home: 'صفحه اصلی',
		product: 'محصول',
		vigento: 'ویجنتو',
		solutions: 'راهکارها',
		start: 'شروع رایگان — یک ماه',
		startShort: 'شروع رایگان',
		dashboard: 'داشبورد من',
		signedIn: 'وارد شده‌اید',
		dashboardAria: 'رفتن به داشبورد',
		login: 'ورود',
		primaryNav: 'ناوبری اصلی',
	},
	en: {
		home: 'Home',
		product: 'Product',
		vigento: 'Vigento',
		solutions: 'Solutions',
		start: 'Start free — one month',
		startShort: 'Start free',
		dashboard: 'My dashboard',
		signedIn: 'Signed in',
		dashboardAria: 'Go to dashboard',
		login: 'Log in',
		primaryNav: 'Primary navigation',
	},
} as const

export function Navbar({ authenticated }: { authenticated: boolean }) {
	const t = useTranslations('nav')
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const pathname = usePathname()
	const [scrolled, setScrolled] = useState(false)
	const [activeSection, setActiveSection] = useState('')
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight
	const homeVariantPath = HOME_VARIANT_PATH.test(pathname) ? pathname : null
	const isLandingPath = pathname === '/' || homeVariantPath !== null

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 10)
		onScroll()
		window.addEventListener('scroll', onScroll, { passive: true })
		return () => window.removeEventListener('scroll', onScroll)
	}, [])

	useEffect(() => {
		if (!isLandingPath) {
			setActiveSection('')
			return
		}
		const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter((section): section is HTMLElement => Boolean(section))
		if (!('IntersectionObserver' in window)) return
		const visible = new Set<string>()
		const observer = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) visible.add(entry.target.id)
				else visible.delete(entry.target.id)
			}
			setActiveSection(SECTION_IDS.find((id) => visible.has(id)) ?? '')
		}, {
			rootMargin: '-30% 0px -60% 0px',
			threshold: 0,
		})
		for (const section of sections) observer.observe(section)
		return () => observer.disconnect()
	}, [isLandingPath, pathname])

	const links = [
		{ href: '/', id: 'home', label: copy.home },
		{ href: '/#solutions', id: 'solutions', label: copy.solutions },
		{ href: '/#product', id: 'product', label: copy.product },
		{ href: '/#vigento', id: 'vigento', label: copy.vigento },
		{ href: '/#pricing', id: 'pricing', label: t('pricing') },
		{ href: '/blog', id: 'blog', label: t('blog') },
		{ href: '/docs', id: 'docs', label: t('docs') },
	].map((link) => {
		if (!homeVariantPath) return link
		if (link.id === 'home') return { ...link, href: homeVariantPath }
		if (SECTION_IDS.some((id) => id === link.id)) {
			return { ...link, href: `${homeVariantPath}#${link.id}` }
		}
		return link
	})
	return (
		<header className="fixed inset-x-0 top-0 z-50 px-3 pt-2 sm:px-5 sm:pt-3">
			<nav
				aria-label={copy.primaryNav}
				className={cn(
					'marketing-navbar-surface relative mx-auto grid h-[58px] max-w-7xl grid-cols-[1fr_auto_1fr] items-center rounded-[1.15rem] border px-2.5 transition-[background-color,border-color,box-shadow] duration-200 lg:flex lg:justify-between lg:px-3.5',
					scrolled
						? 'border-black/10 bg-white/[0.9] shadow-[0_14px_45px_rgba(0,0,0,0.09)] backdrop-blur-xl'
						: 'border-black/[0.07] bg-white/[0.82] shadow-[0_8px_28px_rgba(0,0,0,0.055)] backdrop-blur-lg',
				)}
			>
				<div className="col-start-1 flex items-center justify-start lg:hidden">
					<LanguageSwitcher className="min-w-11 justify-center px-2 [&_span]:hidden" />
				</div>

				<div className="hidden items-center gap-1 lg:flex">
					{links.map((link) => {
						const active = link.id === 'home'
							? isLandingPath && activeSection === ''
							: link.id === 'blog' || link.id === 'docs'
							? pathname.startsWith(`/${link.id}`)
							: isLandingPath && activeSection === link.id
						return (
							<Link
								key={link.id}
								href={link.href}
								className={cn(
									'inline-flex min-h-11 items-center rounded-xl px-3 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black',
									active ? 'bg-black text-white' : 'text-black/50 hover:bg-black/[0.045] hover:text-black',
								)}
							>
								{link.label}
							</Link>
						)
					})}
				</div>

				<Link
					href={homeVariantPath ?? '/'}
					aria-label={locale === 'fa' ? 'صفحه اصلی ویجنت' : 'Vigent home'}
					className="col-start-2 inline-flex min-h-11 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black lg:absolute lg:left-1/2 lg:-translate-x-1/2"
				>
					<Logo priority className="h-8 w-[7.25rem] sm:w-32" />
				</Link>

				<div className="col-start-3 hidden items-center justify-end gap-2 lg:ms-auto lg:flex">
					<LanguageSwitcher className="hidden lg:inline-flex" />
					{authenticated ? (
						<Link
							href="/overview"
							aria-label={copy.dashboardAria}
							className="marketing-pressable inline-flex min-h-11 items-center gap-2 rounded-xl bg-black px-3 text-[11px] font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
						>
							<span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500"><Check className="h-2.5 w-2.5" /></span>
							<span className="hidden xl:inline">{copy.signedIn} ·</span>{copy.dashboard}
						</Link>
					) : (
						<>
							<Link href="/login" className="inline-flex min-h-11 min-w-12 items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white px-2.5 text-[11px] font-medium text-black/60 transition-colors hover:bg-black/[0.035] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black">
								<LogIn className="hidden h-3.5 w-3.5 sm:block" />{t('login')}
							</Link>
							<Link href="/login?next=/onboarding" className="marketing-pressable hidden min-h-11 items-center gap-1.5 rounded-xl bg-black px-3.5 text-[11px] font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 lg:inline-flex">
								{copy.start}<Arrow className="h-3.5 w-3.5" />
							</Link>
						</>
					)}
				</div>

				<span aria-hidden className="col-start-3 h-11 w-11 justify-self-end lg:hidden" />
			</nav>

			<MarketingMobileBottomNav
				authenticated={authenticated}
				homeHref={homeVariantPath ?? '/'}
				isLandingPath={isLandingPath}
				activeSection={activeSection}
				copy={{
					home: copy.home,
					docs: t('docs'),
					startFree: copy.startShort,
					pricing: t('pricing'),
					login: copy.login,
					dashboard: copy.dashboard,
					primaryNav: copy.primaryNav,
					dashboardAria: copy.dashboardAria,
				}}
			/>
		</header>
	)
}
