'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { SessionProvider, useSession } from 'next-auth/react'
import { ArrowLeft, ArrowRight, Check, LogIn, Menu, X } from 'lucide-react'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { Logo } from '@/components/ui/logo'
import { cn } from '@/lib/utils'

const SECTION_IDS = ['product', 'demo', 'businesses', 'pricing'] as const

const LOCAL_COPY = {
	fa: {
		product: 'محصول',
		demo: 'دموی زنده',
		businesses: 'برای کسب‌وکارها',
		resources: 'یادگیری',
		start: 'شروع رایگان',
		dashboard: 'داشبورد من',
		signedIn: 'وارد شده‌اید',
		dashboardAria: 'وارد شده‌اید؛ رفتن به داشبورد',
		primaryNav: 'ناوبری اصلی',
		menu: 'باز کردن منو',
		close: 'بستن منو',
	},
	en: {
		product: 'Product',
		demo: 'Live demo',
		businesses: 'For business',
		resources: 'Learn',
		start: 'Start free',
		dashboard: 'My dashboard',
		signedIn: 'Signed in',
		dashboardAria: 'Signed in; go to dashboard',
		primaryNav: 'Primary navigation',
		menu: 'Open menu',
		close: 'Close menu',
	},
} as const

export function Navbar() {
	return (
		<SessionProvider>
			<NavbarContent />
		</SessionProvider>
	)
}

function NavbarContent() {
	const t = useTranslations('nav')
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = LOCAL_COPY[locale]
	const pathname = usePathname()
	const { status } = useSession()
	const [scrolled, setScrolled] = useState(false)
	const [open, setOpen] = useState(false)
	const [activeSection, setActiveSection] = useState('')
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 12)
		onScroll()
		window.addEventListener('scroll', onScroll, { passive: true })
		return () => window.removeEventListener('scroll', onScroll)
	}, [])

	useEffect(() => {
		setOpen(false)
	}, [pathname])

	useEffect(() => {
		if (!open) return
		const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
		document.addEventListener('keydown', onKeyDown)
		document.body.style.overflow = 'hidden'
		return () => {
			document.removeEventListener('keydown', onKeyDown)
			document.body.style.overflow = ''
		}
	}, [open])

	useEffect(() => {
		if (pathname !== '/') {
			setActiveSection('')
			return
		}

		// Query on every update instead of observing the initial nodes. The live
		// demo is lazy-loaded and replaces its placeholder node, which previously
		// left the navbar observing a detached element and never activated “Demo”.
		let frame = 0
		const updateActiveSection = () => {
			cancelAnimationFrame(frame)
			frame = requestAnimationFrame(() => {
				const marker = Math.min(window.innerHeight * 0.38, 300)
				const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter(
					(el): el is HTMLElement => el !== null,
				)
				const current = sections.find((section) => {
					const rect = section.getBoundingClientRect()
					return rect.top <= marker && rect.bottom > marker
				})
				setActiveSection(current?.id ?? '')
			})
		}

		updateActiveSection()
		window.addEventListener('scroll', updateActiveSection, { passive: true })
		window.addEventListener('resize', updateActiveSection, { passive: true })
		window.addEventListener('hashchange', updateActiveSection)
		return () => {
			cancelAnimationFrame(frame)
			window.removeEventListener('scroll', updateActiveSection)
			window.removeEventListener('resize', updateActiveSection)
			window.removeEventListener('hashchange', updateActiveSection)
		}
	}, [pathname])

	const sectionLinks = [
		{ href: '/#product', id: 'product', label: copy.product },
		{ href: '/#demo', id: 'demo', label: copy.demo },
		{ href: '/#businesses', id: 'businesses', label: copy.businesses },
		{ href: '/#pricing', id: 'pricing', label: t('pricing') },
	]
	const resourceLinks = [
		{ href: '/blog', label: t('blog') },
		{ href: '/docs', label: t('docs') },
	]

	return (
		<header className={cn('fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color] duration-300', scrolled || open ? 'border-black/10 bg-white/95 backdrop-blur-xl' : 'border-transparent bg-white/80 backdrop-blur-md')}>
			<nav className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:px-8" aria-label={copy.primaryNav}>
				<Link href="/" aria-label="Vigent home" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
					<Logo priority className="h-10 w-32 sm:w-40" />
				</Link>

				<div className="hidden items-center gap-1 rounded-full border border-black/10 bg-white p-1 shadow-sm lg:flex">
					{sectionLinks.map((link) => (
						<Link key={link.id} href={link.href} className={cn('inline-flex min-h-9 items-center rounded-full px-3.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black', pathname === '/' && activeSection === link.id ? 'bg-black text-white' : 'text-black/55 hover:bg-black/[0.04] hover:text-black')}>
							{link.label}
						</Link>
					))}
					<span className="mx-1 h-4 w-px bg-black/10" />
					{resourceLinks.map((link) => (
						<Link key={link.href} href={link.href} className={cn('inline-flex min-h-9 items-center rounded-full px-3 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black', pathname.startsWith(link.href) ? 'bg-black text-white' : 'text-black/55 hover:bg-black/[0.04] hover:text-black')}>{link.label}</Link>
					))}
				</div>

				<div className="hidden items-center gap-2 lg:flex">
					<LanguageSwitcher />
					{status === 'loading' ? (
						<span aria-hidden="true" className="h-11 w-36 animate-pulse rounded-full bg-black/[0.06] motion-reduce:animate-none" />
					) : status === 'authenticated' ? (
						<Link href="/overview" aria-label={copy.dashboardAria} className="group inline-flex min-h-11 items-center gap-2 rounded-full bg-black px-4 text-[11px] font-medium text-white shadow-sm transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
							<span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-black" aria-hidden="true"><Check className="h-3 w-3 stroke-[2.5]" /></span>
							<span className="hidden xl:inline">{copy.signedIn}</span>
							<span className="hidden text-white/45 xl:inline" aria-hidden="true">·</span>
							<span>{copy.dashboard}</span>
							<Arrow className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" aria-hidden="true" />
						</Link>
					) : (
						<>
							<Link href="/login" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 text-[11px] font-medium text-black/65 shadow-sm transition-[border-color,color,background-color] hover:border-black/20 hover:bg-black/[0.025] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"><LogIn className="h-3.5 w-3.5" aria-hidden="true" />{t('login')}</Link>
							<Link href="/login?next=/onboarding" className="group inline-flex min-h-11 items-center gap-2 rounded-full bg-black px-4 text-[11px] font-medium text-white shadow-sm transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
								{copy.start}<Arrow className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" aria-hidden="true" />
							</Link>
						</>
					)}
				</div>

				<div className="flex items-center gap-2 lg:hidden">
					{status === 'loading' ? (
						<span aria-hidden="true" className="h-11 w-24 animate-pulse rounded-full bg-black/[0.06] motion-reduce:animate-none min-[360px]:w-32" />
					) : status === 'authenticated' ? (
						<Link href="/overview" aria-label={copy.dashboardAria} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-black px-3 text-[11px] font-medium text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
							<span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-black" aria-hidden="true"><Check className="h-2.5 w-2.5 stroke-[2.5]" /></span>
							{copy.dashboard}
						</Link>
					) : (
						<>
							<Link href="/login" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-black/10 bg-white px-2.5 text-[11px] font-medium text-black/70 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">{t('login')}</Link>
							<Link href="/login?next=/onboarding" className="hidden min-h-11 items-center rounded-full bg-black px-3 text-[11px] font-medium text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 min-[480px]:inline-flex">{copy.start}</Link>
						</>
					)}
					<button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="mobile-marketing-menu" aria-label={open ? copy.close : copy.menu} className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black">
						{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
					</button>
				</div>
			</nav>

			{open && (
				<div id="mobile-marketing-menu" className="h-[calc(100dvh-68px)] overflow-y-auto border-t border-black/10 bg-white px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 lg:hidden">
					<div className="mx-auto max-w-2xl">
						<p className="mb-3 text-[10px] font-medium uppercase tracking-[0.15em] text-black/50 rtl:tracking-normal">{copy.product}</p>
						<div className="divide-y divide-black/10 border-y border-black/10">
							{sectionLinks.map((link) => <Link key={link.id} href={link.href} onClick={() => setOpen(false)} className="flex min-h-14 items-center justify-between text-base font-medium text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black"><span>{link.label}</span><Arrow className="h-4 w-4 text-black/35" /></Link>)}
						</div>
						<p className="mb-3 mt-8 text-[10px] font-medium uppercase tracking-[0.15em] text-black/50 rtl:tracking-normal">{copy.resources}</p>
						<div className="grid grid-cols-2 gap-3">
							{resourceLinks.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="flex min-h-14 items-center justify-center rounded-xl border border-black/10 text-sm font-medium text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">{link.label}</Link>)}
						</div>
						<div className="mt-8 flex items-center justify-between gap-3 border-t border-black/10 pt-5">
							<LanguageSwitcher className="min-h-11" />
							{status === 'loading' ? (
								<span aria-hidden="true" className="h-11 w-28 animate-pulse rounded-full bg-black/[0.06] motion-reduce:animate-none" />
							) : status === 'authenticated' ? (
								<Link href="/overview" aria-label={copy.dashboardAria} onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-black px-4 text-sm font-medium text-white">
									<span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-black" aria-hidden="true"><Check className="h-3 w-3 stroke-[2.5]" /></span>
									{copy.dashboard}
								</Link>
							) : (
								<Link href="/login" onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 px-4 text-sm font-medium text-black/70"><LogIn className="h-4 w-4" aria-hidden="true" />{t('login')}<Arrow className="h-4 w-4" aria-hidden="true" /></Link>
							)}
						</div>
					</div>
				</div>
			)}
		</header>
	)
}
